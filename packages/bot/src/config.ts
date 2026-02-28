import { z } from "zod";

const envSchema = z.object({
  TWITCH_BOT_USERNAME: z.string().min(1),
  TWITCH_BOT_OAUTH: z.string().optional(),
  TWITCH_CHANNEL: z.string().min(1),
  BOT_SHARED_SECRET: z.string().min(1),
  API_BASE_URL: z.string().default("http://127.0.0.1:3000")
});

export type BotConfig = ReturnType<typeof loadConfig>;

export function loadConfig() {
  const env = envSchema.parse(process.env);
  return {
    username: env.TWITCH_BOT_USERNAME,
    oauth: env.TWITCH_BOT_OAUTH,
    channel: env.TWITCH_CHANNEL,
    botSharedSecret: env.BOT_SHARED_SECRET,
    apiBaseUrl: env.API_BASE_URL.replace(/\/$/, "")
  };
}
