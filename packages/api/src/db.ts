import { PrismaClient, SongStatus, type Settings as SettingsRecord } from "@prisma/client";

export type QueueState = {
  nowPlaying: Awaited<ReturnType<PrismaClient["songRequest"]["findFirst"]>>;
  queue: Awaited<ReturnType<PrismaClient["songRequest"]["findMany"]>>;
  settings: SettingsDTO;
};

export type SettingsDTO = {
  id: number;
  autoplay: boolean;
  allowAnyone: boolean;
  whitelist: string[];
  blacklist: string[];
  updatedAt: Date;
};

export function normalizeUserList(list: string[]) {
  const normalized = list
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);
  return Array.from(new Set(normalized));
}

function parseUserList(raw: string | null | undefined) {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return normalizeUserList(parsed.map((value) => String(value)));
    }
  } catch {
    return [];
  }
  return [];
}

export function serializeSettings(settings: SettingsRecord): SettingsDTO {
  return {
    id: settings.id,
    autoplay: settings.autoplay,
    allowAnyone: settings.allowAnyone,
    whitelist: parseUserList(settings.whitelistJson),
    blacklist: parseUserList(settings.blacklistJson),
    updatedAt: settings.updatedAt
  };
}

export function createPrisma() {
  return new PrismaClient();
}

export async function ensureSettings(prisma: PrismaClient) {
  return prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      autoplay: false,
      allowAnyone: true,
      whitelistJson: "[]",
      blacklistJson: "[]"
    }
  });
}

export async function getQueueState(prisma: PrismaClient): Promise<QueueState> {
  const settings = serializeSettings(await ensureSettings(prisma));
  const nowPlaying = await prisma.songRequest.findFirst({
    where: { status: SongStatus.PLAYING },
    orderBy: { createdAt: "asc" }
  });
  const queue = await prisma.songRequest.findMany({
    where: { status: SongStatus.QUEUED },
    orderBy: { createdAt: "asc" }
  });
  return { nowPlaying, queue, settings };
}

export async function startNextIfIdle(prisma: PrismaClient) {
  const current = await prisma.songRequest.findFirst({
    where: { status: SongStatus.PLAYING },
    orderBy: { createdAt: "asc" }
  });
  if (current) {
    return current;
  }
  const next = await prisma.songRequest.findFirst({
    where: { status: SongStatus.QUEUED },
    orderBy: { createdAt: "asc" }
  });
  if (!next) {
    return null;
  }
  return prisma.songRequest.update({
    where: { id: next.id },
    data: { status: SongStatus.PLAYING }
  });
}
