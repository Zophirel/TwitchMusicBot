import crypto from "node:crypto";

export type BotRequestPayload = {
  twitchUser: string;
  query: string;
};

export type BotRequestResult = {
  youtubeTitle: string;
  youtubeVideoId: string;
};

export type BotTokenResult = {
  accessToken: string;
  expiresAt: string;
};

async function signedPost<T>(
  apiBaseUrl: string,
  sharedSecret: string,
  path: string,
  payload: unknown
) {
  const ts = Date.now().toString();
  const rawBody = JSON.stringify(payload);
  const sig = crypto.createHmac("sha256", sharedSecret).update(`${ts}.${rawBody}`).digest("hex");

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-bot-ts": ts,
      "x-bot-sig": sig
    },
    body: rawBody
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `API error (${response.status})`);
  }

  return (await response.json()) as T;
}

export async function sendSongRequest(
  apiBaseUrl: string,
  sharedSecret: string,
  payload: BotRequestPayload
) {
  return signedPost<BotRequestResult>(apiBaseUrl, sharedSecret, "/internal/bot/song-request", payload);
}

export async function fetchTwitchToken(apiBaseUrl: string, sharedSecret: string) {
  return signedPost<BotTokenResult>(apiBaseUrl, sharedSecret, "/internal/bot/twitch-token", {});
}

export async function withRetry<T>(fn: () => Promise<T>, retries = 2) {
  let attempt = 0;
  let lastError: unknown;
  while (attempt <= retries) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === retries) {
        break;
      }
      const delay = Math.min(1000 * 2 ** attempt, 4000) + Math.random() * 200;
      await new Promise((resolve) => setTimeout(resolve, delay));
      attempt += 1;
    }
  }
  throw lastError;
}
