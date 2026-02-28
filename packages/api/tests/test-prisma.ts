import crypto from "node:crypto";
import { SongStatus } from "@prisma/client";

type SongRequest = {
  id: string;
  twitchUser: string;
  query: string;
  createdAt: Date;
  youtubeVideoId: string;
  youtubeTitle: string;
  status: SongStatus;
};

type Settings = {
  id: number;
  autoplay: boolean;
  allowAnyone: boolean;
  whitelistJson: string;
  blacklistJson: string;
  updatedAt: Date;
};

export function createMemoryPrisma() {
  let songs: SongRequest[] = [];
  let settings: Settings | null = null;

  const songRequest = {
    findFirst: async ({ where }: { where?: { status?: SongStatus } } = {}) => {
      const list = where?.status
        ? songs.filter((song) => song.status === where.status)
        : [...songs];
      return list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0] ?? null;
    },
    findMany: async ({ where }: { where?: { status?: SongStatus } } = {}) => {
      const list = where?.status
        ? songs.filter((song) => song.status === where.status)
        : [...songs];
      return list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    },
    findUnique: async ({ where }: { where: { id: string } }) => {
      return songs.find((song) => song.id === where.id) ?? null;
    },
    create: async ({ data }: { data: Omit<SongRequest, "id" | "createdAt"> }) => {
      const created: SongRequest = {
        id: crypto.randomUUID(),
        createdAt: new Date(),
        ...data
      };
      songs.push(created);
      return created;
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<SongRequest> }) => {
      const index = songs.findIndex((song) => song.id === where.id);
      if (index < 0) {
        throw new Error("Not found");
      }
      songs[index] = { ...songs[index], ...data } as SongRequest;
      return songs[index];
    },
    updateMany: async ({ where, data }: { where?: { status?: SongStatus }; data: Partial<SongRequest> }) => {
      let count = 0;
      songs = songs.map((song) => {
        if (where?.status && song.status !== where.status) {
          return song;
        }
        count += 1;
        return { ...song, ...data } as SongRequest;
      });
      return { count };
    },
    delete: async ({ where }: { where: { id: string } }) => {
      const index = songs.findIndex((song) => song.id === where.id);
      if (index < 0) {
        throw new Error("Not found");
      }
      const [removed] = songs.splice(index, 1);
      return removed;
    },
    deleteMany: async ({ where }: { where?: { status?: SongStatus } } = {}) => {
      if (!where?.status) {
        const count = songs.length;
        songs = [];
        return { count };
      }
      const remaining = songs.filter((song) => song.status !== where.status);
      const count = songs.length - remaining.length;
      songs = remaining;
      return { count };
    }
  };

  const settingsStore = {
    upsert: async ({ where, update, create }: { where: { id: number }; update: Partial<Settings>; create: Settings }) => {
      if (!settings || settings.id !== where.id) {
        settings = { ...create, updatedAt: new Date() };
        return settings;
      }
      settings = { ...settings, ...update, updatedAt: new Date() } as Settings;
      return settings;
    },
    update: async ({ where, data }: { where: { id: number }; data: Partial<Settings> }) => {
      if (!settings || settings.id !== where.id) {
        throw new Error("Not found");
      }
      settings = { ...settings, ...data, updatedAt: new Date() } as Settings;
      return settings;
    },
    deleteMany: async () => {
      settings = null;
      return { count: 1 };
    }
  };

  return {
    songRequest,
    settings: settingsStore,
    $transaction: async (ops: Array<Promise<unknown>>) => Promise.all(ops)
  };
}
