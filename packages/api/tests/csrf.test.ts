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

describe("CSRF protection", () => {
  beforeEach(async () => {
    await prisma.songRequest.deleteMany();
    await prisma.settings.deleteMany();
  });

  function extractCookies(setCookieHeader: string[] | undefined) {
    if (!setCookieHeader) {
      return { cookieHeader: "", csrfToken: "" };
    }
    const cookies = setCookieHeader.map((cookie) => cookie.split(";")[0]);
    const cookieHeader = cookies.join("; ");
    const csrfCookie = cookies.find((cookie) => cookie.startsWith("csrf_token="));
    const csrfToken = csrfCookie ? csrfCookie.split("=")[1] : "";
    return { cookieHeader, csrfToken };
  }

  it("rejects missing CSRF token", async () => {
    const loginRes = await request(app)
      .post("/api/admin/login")
      .set("Host", host)
      .set("Origin", origin)
      .send({ password: process.env.ADMIN_PASSWORD });

    const { cookieHeader } = extractCookies(loginRes.headers["set-cookie"] as string[] | undefined);

    await request(app)
      .post("/api/admin/settings")
      .set("Host", host)
      .set("Origin", origin)
      .set("Cookie", cookieHeader)
      .send({ autoplay: true })
      .expect(403);
  });

  it("accepts valid CSRF token", async () => {
    const loginRes = await request(app)
      .post("/api/admin/login")
      .set("Host", host)
      .set("Origin", origin)
      .send({ password: process.env.ADMIN_PASSWORD });

    const { cookieHeader, csrfToken } = extractCookies(loginRes.headers["set-cookie"] as string[] | undefined);

    await request(app)
      .post("/api/admin/settings")
      .set("Host", host)
      .set("Origin", origin)
      .set("Cookie", cookieHeader)
      .set("x-csrf-token", csrfToken)
      .send({ autoplay: true })
      .expect(200);
  });
});
