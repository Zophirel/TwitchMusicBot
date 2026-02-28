import { z } from "zod";

const envSchema = z.object({
  HOST: z.string().default("127.0.0.1"),
  API_PORT: z.string().default("3000"),
  ADMIN_PASSWORD: z.string().optional(),
  JWT_SECRET: z.string().optional(),
  BOT_SHARED_SECRET: z.string().optional(),
  YOUTUBE_API_KEY: z.string().optional(),
  TWITCH_CLIENT_ID: z.string().optional(),
  TWITCH_CLIENT_SECRET: z.string().optional(),
  DEV_CORS_ORIGIN: z.string().optional(),
  EXTRA_ALLOWED_HOSTS: z.string().optional(),
  EXTRA_ALLOWED_ORIGINS: z.string().optional(),
  ALLOW_LOCALHOST: z.string().optional(),
  ALLOW_IPV6: z.string().optional()
});

export type AppConfig = ReturnType<typeof loadConfig>;

export function loadConfig() {
  const env = envSchema.parse(process.env);
  const port = Number(env.API_PORT);
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error("API_PORT must be a valid port number");
  }

  const allowLocalhost = env.ALLOW_LOCALHOST === "true";
  const allowIpv6 = env.ALLOW_IPV6 === "true";

  const allowedHosts = new Set<string>();
  allowedHosts.add(`127.0.0.1:${port}`);
  if (allowLocalhost) {
    allowedHosts.add(`localhost:${port}`);
  }
  if (allowIpv6) {
    allowedHosts.add(`[::1]:${port}`);
  }

  const allowedOrigins = new Set<string>();
  allowedOrigins.add(`http://127.0.0.1:${port}`);
  if (allowLocalhost) {
    allowedOrigins.add(`http://localhost:${port}`);
  }
  if (allowIpv6) {
    allowedOrigins.add(`http://[::1]:${port}`);
  }

  const devCorsOrigins = env.DEV_CORS_ORIGIN
    ? env.DEV_CORS_ORIGIN.split(",").map((value) => value.trim()).filter(Boolean)
    : [];
  for (const origin of devCorsOrigins) {
    allowedOrigins.add(origin);
  }

  const extraAllowedHosts = env.EXTRA_ALLOWED_HOSTS
    ? env.EXTRA_ALLOWED_HOSTS.split(",").map((value) => value.trim()).filter(Boolean)
    : [];
  for (const host of extraAllowedHosts) {
    allowedHosts.add(host);
  }

  const extraAllowedOrigins = env.EXTRA_ALLOWED_ORIGINS
    ? env.EXTRA_ALLOWED_ORIGINS.split(",").map((value) => value.trim()).filter(Boolean)
    : [];
  for (const origin of extraAllowedOrigins) {
    allowedOrigins.add(origin);
  }

  return {
    host: env.HOST,
    port,
    adminPassword: env.ADMIN_PASSWORD,
    jwtSecret: env.JWT_SECRET,
    botSharedSecret: env.BOT_SHARED_SECRET,
    youtubeApiKey: env.YOUTUBE_API_KEY,
    twitchClientId: env.TWITCH_CLIENT_ID,
    twitchClientSecret: env.TWITCH_CLIENT_SECRET,
    devCorsOrigins,
    extraAllowedHosts,
    extraAllowedOrigins,
    allowedHosts,
    allowedOrigins
  };
}

export function requireSecret(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}
