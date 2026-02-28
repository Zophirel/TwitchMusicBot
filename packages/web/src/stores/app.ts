import { defineStore } from "pinia";
import { io, type Socket } from "socket.io-client";
import { apiRequest, readCookie } from "../services/api";

export type SongRequest = {
  id: string;
  twitchUser: string;
  query: string;
  createdAt: string;
  youtubeVideoId: string;
  youtubeTitle: string;
  status: "QUEUED" | "PLAYING" | "PLAYED" | "REJECTED";
};

export type Settings = {
  id: number;
  autoplay: boolean;
  allowAnyone: boolean;
  whitelist: string[];
  blacklist: string[];
  updatedAt: string;
};

export type SettingsUpdate = {
  autoplay?: boolean;
  allowAnyone?: boolean;
  whitelist?: string[];
  blacklist?: string[];
};

export type QueueState = {
  nowPlaying: SongRequest | null;
  queue: SongRequest[];
  settings: Settings;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export const useAppStore = defineStore("app", {
  state: () => ({
    nowPlaying: null as SongRequest | null,
    queue: [] as SongRequest[],
    settings: {
      id: 1,
      autoplay: false,
      allowAnyone: true,
      whitelist: [],
      blacklist: [],
      updatedAt: ""
    } as Settings,
    loading: false,
    error: "" as string | null,
    initialized: false,
    isAdmin: false,
    csrfToken: null as string | null,
    socketConnected: false,
    socket: null as Socket | null,
    pollTimer: null as number | null
  }),
  actions: {
    async init() {
      if (this.initialized) {
        return;
      }
      this.loading = true;
      this.error = null;
      try {
        await this.fetchQueue();
        this.csrfToken = readCookie("csrf_token");
        this.connectSocket();
        this.startPolling();
        this.initialized = true;
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Failed to load queue";
      } finally {
        this.loading = false;
      }
    },
    connectSocket() {
      if (this.socket) {
        return;
      }
      const socket = API_BASE
        ? io(API_BASE, { path: "/socket.io", withCredentials: true })
        : io({ path: "/socket.io", withCredentials: true });

      socket.on("connect", () => {
        this.socketConnected = true;
      });
      socket.on("disconnect", () => {
        this.socketConnected = false;
        this.fetchQueue().catch(() => undefined);
      });
      socket.on("queue:update", (state: QueueState) => {
        this.nowPlaying = state.nowPlaying;
        this.queue = state.queue;
        this.settings = state.settings;
      });
      socket.on("settings:update", (settings: Settings) => {
        this.settings = settings;
      });

      this.socket = socket;
    },
    startPolling() {
      if (this.pollTimer) {
        return;
      }
      this.pollTimer = window.setInterval(() => {
        if (this.socketConnected) {
          return;
        }
        this.fetchQueue().catch(() => undefined);
      }, 5000);
    },
    async fetchQueue() {
      const state = await apiRequest<QueueState>("/api/queue");
      this.nowPlaying = state.nowPlaying;
      this.queue = state.queue;
      this.settings = state.settings;
    },
    async login(password: string) {
      await apiRequest("/api/admin/login", {
        method: "POST",
        body: { password }
      });
      this.csrfToken = readCookie("csrf_token");
      this.isAdmin = true;
    },
    async logout() {
      await apiRequest("/api/admin/logout", {
        method: "POST",
        csrfToken: this.csrfToken
      });
      this.isAdmin = false;
    },
    async updateSettings(update: SettingsUpdate) {
      const response = await apiRequest<{ settings: Settings }>("/api/admin/settings", {
        method: "POST",
        body: update,
        csrfToken: this.csrfToken
      });
      this.settings = response.settings;
      await this.fetchQueue();
    },
    async setAutoplay(autoplay: boolean) {
      await this.updateSettings({ autoplay });
    },
    async startPlayback() {
      await apiRequest("/api/admin/queue/start", {
        method: "POST",
        csrfToken: this.csrfToken
      });
      await this.fetchQueue();
    },
    async skipPlayback() {
      await apiRequest("/api/admin/queue/skip", {
        method: "POST",
        csrfToken: this.csrfToken
      });
      await this.fetchQueue();
    },
    async removeFromQueue(id: string) {
      await apiRequest(`/api/admin/queue/${id}`, {
        method: "DELETE",
        csrfToken: this.csrfToken
      });
      await this.fetchQueue();
    },
    async clearQueue() {
      await apiRequest("/api/admin/queue/clear", {
        method: "POST",
        csrfToken: this.csrfToken
      });
      await this.fetchQueue();
    },
    async reorderQueue(ids: string[]) {
      await apiRequest("/api/admin/queue/reorder", {
        method: "POST",
        body: { ids },
        csrfToken: this.csrfToken
      });
      await this.fetchQueue();
    }
  }
});
