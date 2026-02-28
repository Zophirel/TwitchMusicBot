import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SongStatus, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { Server as SocketIOServer } from "socket.io";
import { loadConfig, requireSecret, type AppConfig } from "./config.js";
import {
  createPrisma,
  ensureSettings,
  getQueueState,
  normalizeUserList,
  serializeSettings,
  startNextIfIdle
} from "./db.js";
import { searchYouTube, type YouTubeResult } from "./services/youtube.js";
import { hostCheck } from "./security/host.js";
import { ensureCsrfCookie, requireCsrf } from "./security/csrf.js";
import { requireOrigin } from "./security/origin.js";
import {
  clearAdminToken,
  issueAdminToken,
  requireAdmin,
  verifyAdminPassword
} from "./security/auth.js";
import { verifyBotSignature } from "./security/hmac.js";
import {
  exchangeDeviceCode,
  refreshAccessToken,
  requestDeviceCode,
  type TokenErrorResponse
} from "./services/twitch.js";

export type AppOptions = {
  prisma?: PrismaClient;
  config?: AppConfig;
  youtubeSearch?: (query: string, apiKey: string) => Promise<YouTubeResult | null>;
};

const botRequestSchema = z.object({
  twitchUser: z.string().min(1).max(50),
  query: z.string().min(1).max(80)
});

const loginSchema = z.object({
  password: z.string().min(1)
});

const userListSchema = z.array(z.string().trim().min(1).max(50)).max(200);

const settingsSchema = z.object({
  autoplay: z.boolean().optional(),
  allowAnyone: z.boolean().optional(),
  whitelist: userListSchema.optional(),
  blacklist: userListSchema.optional()
});

const devicePollSchema = z.object({
  deviceCode: z.string().min(1)
});

type UpdateInfo = {
  repo: string;
  latestSha: string;
  currentSha: string | null;
  updateAvailable: boolean;
  compareUrl: string | null;
};

function parseRepoSlug(repoUrl: string) {
  try {
    const url = new URL(repoUrl);
    const parts = url.pathname.replace(/\.git$/, "").split("/").filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]}/${parts[1]}`;
    }
  } catch {
    // ignore
  }
  return null;
}

async function fetchLatestCommit(repoUrl: string) {
  const slug = parseRepoSlug(repoUrl);
  if (!slug) {
    return null;
  }
  const response = await fetch(`https://api.github.com/repos/${slug}/commits?per_page=1`, {
    headers: { "User-Agent": "musicbot-update-check" }
  });
  if (!response.ok) {
    return null;
  }
  const data = (await response.json()) as Array<{ sha: string }>;
  const sha = data[0]?.sha;
  if (!sha) {
    return null;
  }
  return { slug, sha };
}

const reorderSchema = z.object({
  ids: z.array(z.string().min(1)).min(1)
});

function getWebDistPath() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.resolve(__dirname, "../../web/dist");
}

async function emitQueueUpdate(app: express.Express, prisma: PrismaClient) {
  const io = app.locals.io as SocketIOServer | undefined;
  if (!io) {
    return;
  }
  const state = await getQueueState(prisma);
  io.emit("queue:update", state);
  io.emit("settings:update", state.settings);
}

export function createApp(options: AppOptions = {}) {
  const config = options.config ?? loadConfig();
  const prisma = options.prisma ?? createPrisma();
  const youtubeSearch = options.youtubeSearch ?? searchYouTube;

  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", false);

  app.use(hostCheck(config));

  if (config.devCorsOrigins.length > 0) {
    app.use(
      cors({
        origin: (origin, callback) => {
          if (!origin) {
            return callback(null, false);
          }
          if (config.devCorsOrigins.includes(origin)) {
            return callback(null, true);
          }
          return callback(new Error("Origin not allowed"));
        },
        credentials: true
      })
    );
  }

  app.use(
    express.json({
      limit: "20kb",
      verify: (req, _res, buf) => {
        (req as express.Request).rawBody = buf.toString("utf8");
      }
    })
  );
  app.use(cookieParser());

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "https://www.youtube.com"],
          frameSrc: ["'self'", "https://www.youtube.com"],
          imgSrc: ["'self'", "https://i.ytimg.com", "data:"],
          connectSrc: ["'self'", "https://www.googleapis.com"],
          styleSrc: ["'self'", "'unsafe-inline'"]
        }
      }
    })
  );

  app.use(ensureCsrfCookie);

  const globalLimiter = rateLimit({
    windowMs: 60_000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false
  });
  app.use(globalLimiter);

  app.get("/api/queue", async (_req, res, next) => {
    try {
      const state = await getQueueState(prisma);
      res.set("Cache-Control", "no-store");
      return res.json(state);
    } catch (error) {
      return next(error);
    }
  });

  app.get("/api/update", async (_req, res, next) => {
    try {
      const repoUrl = config.updateRepoUrl;
      if (!repoUrl) {
        return res.json({ updateAvailable: false, reason: "no_repo_configured" });
      }
      const latest = await fetchLatestCommit(repoUrl);
      if (!latest) {
        return res.json({ updateAvailable: false, reason: "fetch_failed" });
      }

      const currentSha = config.updateCurrentSha ?? null;
      const updateAvailable = Boolean(currentSha && currentSha !== latest.sha);
      const payload: UpdateInfo = {
        repo: latest.slug,
        latestSha: latest.sha,
        currentSha,
        updateAvailable,
        compareUrl: currentSha
          ? `https://github.com/${latest.slug}/compare/${currentSha}...${latest.sha}`
          : null
      };
      return res.json(payload);
    } catch (error) {
      return next(error);
    }
  });

  const botIpLimiter = rateLimit({
    windowMs: 60_000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false
  });
  const botUserLimiter = rateLimit({
    windowMs: 60_000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      if (typeof req.body?.twitchUser === "string" && req.body.twitchUser.length > 0) {
        return `user:${req.body.twitchUser}`;
      }
      return ipKeyGenerator(req.ip ?? "");
    }
  });

  app.post(
    "/internal/bot/song-request",
    botIpLimiter,
    botUserLimiter,
    verifyBotSignature(requireSecret(config.botSharedSecret, "BOT_SHARED_SECRET")),
    async (req, res, next) => {
      try {
        const parsed = botRequestSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: "Invalid payload" });
        }

        const twitchUser = parsed.data.twitchUser.trim();
        const query = parsed.data.query.trim();
        if (!query) {
          return res.status(400).json({ error: "Query required" });
        }

        const settings = serializeSettings(await ensureSettings(prisma));
        const [normalizedUser] = normalizeUserList([twitchUser]);
        if (!normalizedUser) {
          return res.status(400).json({ error: "Invalid user" });
        }
        if (settings.blacklist.includes(normalizedUser)) {
          return res.status(403).json({ error: "User is blacklisted" });
        }
        if (!settings.allowAnyone && !settings.whitelist.includes(normalizedUser)) {
          return res.status(403).json({ error: "User is not whitelisted" });
        }

        const apiKey = requireSecret(config.youtubeApiKey, "YOUTUBE_API_KEY");
        const result = await youtubeSearch(query, apiKey);
        if (!result) {
          return res.status(404).json({ error: "No YouTube results" });
        }

        let status: SongStatus = SongStatus.QUEUED;
        if (settings.autoplay) {
          const playing = await prisma.songRequest.findFirst({
            where: { status: SongStatus.PLAYING },
            orderBy: { createdAt: "asc" }
          });
          if (!playing) {
            status = SongStatus.PLAYING;
          }
        }

        const created = await prisma.songRequest.create({
          data: {
            twitchUser,
            query,
            youtubeVideoId: result.videoId,
            youtubeTitle: result.title,
            status
          }
        });

        await emitQueueUpdate(app, prisma);

        return res.status(201).json({
          id: created.id,
          youtubeTitle: created.youtubeTitle,
          youtubeVideoId: created.youtubeVideoId
        });
      } catch (error) {
        return next(error);
      }
    }
  );

  const botTokenLimiter = rateLimit({
    windowMs: 60_000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false
  });

  app.post(
    "/internal/bot/twitch-token",
    botTokenLimiter,
    verifyBotSignature(requireSecret(config.botSharedSecret, "BOT_SHARED_SECRET")),
    async (_req, res, next) => {
      try {
        const clientId = requireSecret(config.twitchClientId, "TWITCH_CLIENT_ID");
        const auth = await prisma.twitchAuth.findUnique({ where: { id: 1 } });
        if (!auth) {
          return res.status(404).json({ error: "Twitch auth not configured" });
        }

        let accessToken = auth.accessToken;
        let expiresAt = auth.expiresAt;
        const now = Date.now();
        if (expiresAt.getTime() - now < 60_000) {
          const refreshed = await refreshAccessToken(
            clientId,
            config.twitchClientSecret,
            auth.refreshToken
          );
          const updated = await prisma.twitchAuth.update({
            where: { id: 1 },
            data: {
              accessToken: refreshed.access_token,
              refreshToken: refreshed.refresh_token ?? auth.refreshToken,
              scope: refreshed.scope?.join(" ") ?? auth.scope,
              expiresAt: new Date(Date.now() + refreshed.expires_in * 1000)
            }
          });
          accessToken = updated.accessToken;
          expiresAt = updated.expiresAt;
        }

        return res.json({ accessToken, expiresAt });
      } catch (error) {
        return next(error);
      }
    }
  );

  const loginLimiter = rateLimit({
    windowMs: 60_000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false
  });

  app.post("/api/admin/login", loginLimiter, requireOrigin(config), async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    const expectedPassword = requireSecret(config.adminPassword, "ADMIN_PASSWORD");
    if (!verifyAdminPassword(parsed.data.password, expectedPassword)) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    issueAdminToken(res, requireSecret(config.jwtSecret, "JWT_SECRET"));
    return res.json({ ok: true });
  });

  app.post(
    "/api/admin/logout",
    requireAdmin(requireSecret(config.jwtSecret, "JWT_SECRET")),
    requireOrigin(config),
    requireCsrf,
    (_req, res) => {
      clearAdminToken(res);
      return res.json({ ok: true });
    }
  );

  const adminRouter = express.Router();
  adminRouter.use(requireAdmin(requireSecret(config.jwtSecret, "JWT_SECRET")));
  adminRouter.use(requireOrigin(config));
  adminRouter.use(requireCsrf);

  adminRouter.post("/settings", async (req, res, next) => {
    try {
      const parsed = settingsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid payload" });
      }

      const existing = await ensureSettings(prisma);
      const next = {
        autoplay: parsed.data.autoplay ?? existing.autoplay,
        allowAnyone: parsed.data.allowAnyone ?? existing.allowAnyone,
        whitelistJson:
          parsed.data.whitelist === undefined
            ? existing.whitelistJson
            : JSON.stringify(normalizeUserList(parsed.data.whitelist)),
        blacklistJson:
          parsed.data.blacklist === undefined
            ? existing.blacklistJson
            : JSON.stringify(normalizeUserList(parsed.data.blacklist))
      };
      const settings = await prisma.settings.update({
        where: { id: existing.id },
        data: next
      });

      await emitQueueUpdate(app, prisma);
      return res.json({ settings: serializeSettings(settings) });
    } catch (error) {
      return next(error);
    }
  });

  adminRouter.post("/twitch/device/start", async (_req, res, next) => {
    try {
      const clientId = requireSecret(config.twitchClientId, "TWITCH_CLIENT_ID");
      const device = await requestDeviceCode(clientId, ["chat:read", "chat:edit"]);
      return res.json(device);
    } catch (error) {
      return next(error);
    }
  });

  adminRouter.post("/twitch/device/poll", async (req, res, next) => {
    try {
      const parsed = devicePollSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid payload" });
      }

      const clientId = requireSecret(config.twitchClientId, "TWITCH_CLIENT_ID");
      const token = await exchangeDeviceCode(
        clientId,
        config.twitchClientSecret,
        parsed.data.deviceCode
      );

      if ("error" in token) {
        const errorCode = (token as TokenErrorResponse).error;
        if (errorCode === "authorization_pending" || errorCode === "slow_down") {
          return res.status(202).json({ status: errorCode });
        }
        return res.status(400).json({ error: errorCode });
      }

      const accessToken = token.access_token;
      const refreshToken = token.refresh_token;
      if (!refreshToken) {
        return res.status(500).json({ error: "Missing refresh token" });
      }

      const expiresAt = new Date(Date.now() + token.expires_in * 1000);
      await prisma.twitchAuth.upsert({
        where: { id: 1 },
        update: {
          accessToken,
          refreshToken,
          scope: token.scope?.join(" ") ?? null,
          expiresAt
        },
        create: {
          id: 1,
          accessToken,
          refreshToken,
          scope: token.scope?.join(" ") ?? null,
          expiresAt
        }
      });

      return res.json({ ok: true, expiresAt });
    } catch (error) {
      return next(error);
    }
  });

  adminRouter.post("/queue/start", async (_req, res, next) => {
    try {
      const started = await startNextIfIdle(prisma);
      if (!started) {
        return res.status(404).json({ error: "No queued songs" });
      }
      await emitQueueUpdate(app, prisma);
      return res.json({ nowPlaying: started });
    } catch (error) {
      return next(error);
    }
  });

  adminRouter.post("/queue/skip", async (_req, res, next) => {
    try {
      const current = await prisma.songRequest.findFirst({
        where: { status: SongStatus.PLAYING },
        orderBy: { createdAt: "asc" }
      });
      if (!current) {
        return res.status(404).json({ error: "Nothing playing" });
      }

      await prisma.songRequest.update({
        where: { id: current.id },
        data: { status: SongStatus.PLAYED }
      });

      const settings = await ensureSettings(prisma);
      if (settings.autoplay) {
        await startNextIfIdle(prisma);
      }

      await emitQueueUpdate(app, prisma);
      return res.json({ ok: true });
    } catch (error) {
      return next(error);
    }
  });

  adminRouter.delete("/queue/:id", async (req, res, next) => {
    try {
      const id = req.params.id;
      const existing = await prisma.songRequest.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: "Not found" });
      }

      if (existing.status === SongStatus.PLAYING) {
        await prisma.songRequest.update({
          where: { id },
          data: { status: SongStatus.PLAYED }
        });
        const settings = await ensureSettings(prisma);
        if (settings.autoplay) {
          await startNextIfIdle(prisma);
        }
      } else {
        await prisma.songRequest.delete({ where: { id } });
      }

      await emitQueueUpdate(app, prisma);
      return res.json({ ok: true });
    } catch (error) {
      return next(error);
    }
  });

  adminRouter.post("/queue/reorder", async (req, res, next) => {
    try {
      const parsed = reorderSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid payload" });
      }

      const queued = await prisma.songRequest.findMany({
        where: { status: SongStatus.QUEUED },
        select: { id: true }
      });
      const queuedIds = new Set(queued.map((item) => item.id));
      for (const id of parsed.data.ids) {
        if (!queuedIds.has(id)) {
          return res.status(400).json({ error: "Queue id mismatch" });
        }
      }

      const base = Date.now();
      await prisma.$transaction(
        parsed.data.ids.map((id, index) =>
          prisma.songRequest.update({
            where: { id },
            data: { createdAt: new Date(base + index) }
          })
        )
      );

      await emitQueueUpdate(app, prisma);
      return res.json({ ok: true });
    } catch (error) {
      return next(error);
    }
  });

  adminRouter.post("/queue/clear", async (_req, res, next) => {
    try {
      await prisma.songRequest.updateMany({
        where: { status: SongStatus.PLAYING },
        data: { status: SongStatus.PLAYED }
      });
      await prisma.songRequest.deleteMany({ where: { status: SongStatus.QUEUED } });

      await emitQueueUpdate(app, prisma);
      return res.json({ ok: true });
    } catch (error) {
      return next(error);
    }
  });

  app.use("/api/admin", adminRouter);

  const webDist = getWebDistPath();
  app.use(express.static(webDist, { index: false }));

  app.get(["/", "/admin", "/player"], (req, res, next) => {
    if (!req.accepts("html")) {
      return next();
    }
    return res.sendFile(path.join(webDist, "index.html"));
  });

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = err instanceof Error ? err.message : "Unexpected error";
    console.error("[api] error:", err);
    return res.status(500).json({ error: message });
  });

  return app;
}
