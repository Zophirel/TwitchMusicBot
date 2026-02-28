import crypto from "node:crypto";
import request from "supertest";
import { beforeEach, describe, it } from "vitest";
import { createApp } from "../src/app";
import { loadConfig } from "../src/config";
import { createMemoryPrisma } from "./test-prisma";

process.env.HOST = "127.0.0.1";
process.env.API_PORT = "3000";
process.env.BOT_SHARED_SECRET = "test-bot-secret";
process.env.ADMIN_PASSWORD = "test-admin";
process.env.JWT_SECRET = "test-jwt-secret";
process.env.YOUTUBE_API_KEY = "test-youtube-key";

const host = "127.0.0.1:3000";
const origin = "http://127.0.0.1:3000";

const prisma = createMemoryPrisma();
const app = createApp({
  prisma: prisma as unknown as never,
  config: loadConfig(),
  youtubeSearch: async () => ({ videoId: "abc123", title: "Test Song" })
});

describe("HMAC verification", () => {
  beforeEach(async () => {
    await prisma.songRequest.deleteMany();
    await prisma.settings.deleteMany();
  });

  it("rejects missing signature", async () => {
    await request(app)
      .post("/internal/bot/song-request")
      .set("Host", host)
      .send({ twitchUser: "alice", query: "test song" })
      .expect(401);
  });

  it("accepts valid signature", async () => {
    const body = { twitchUser: "alice", query: "test song" };
    const rawBody = JSON.stringify(body);
    const ts = Date.now().toString();
    const sig = crypto
      .createHmac("sha256", process.env.BOT_SHARED_SECRET ?? "")
      .update(`${ts}.${rawBody}`)
      .digest("hex");

    await request(app)
      .post("/internal/bot/song-request")
      .set("Host", host)
      .set("Origin", origin)
      .set("x-bot-ts", ts)
      .set("x-bot-sig", sig)
      .send(body)
      .expect(201);
  });
});
