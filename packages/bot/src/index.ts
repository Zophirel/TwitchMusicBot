import "dotenv/config";
import tmi from "tmi.js";
import type { ChatUserstate } from "tmi.js";
import { loadConfig } from "./config.js";
import { parseSongsPlay } from "./parse.js";
import { fetchTwitchToken, sendSongRequest, withRetry } from "./api.js";

const config = loadConfig();

let client: import("tmi.js").Client | null = null;
let refreshTimer: NodeJS.Timeout | null = null;

function scheduleRefresh(expiresAt: string) {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }
  const expires = new Date(expiresAt).getTime();
  if (!Number.isFinite(expires)) {
    return;
  }
  const delay = Math.max(expires - Date.now() - 120_000, 30_000);
  refreshTimer = setTimeout(async () => {
    try {
      const token = await fetchTwitchToken(config.apiBaseUrl, config.botSharedSecret);
      await reconnectWithToken(token.accessToken, token.expiresAt);
    } catch (error) {
      console.error("Failed to refresh Twitch token.", error);
      scheduleRefresh(expiresAt);
    }
  }, delay);
}

async function getOauthToken() {
  if (config.oauth && config.oauth.trim().length > 0) {
    const token = config.oauth.startsWith("oauth:") ? config.oauth : `oauth:${config.oauth}`;
    console.log("[bot] using TWITCH_BOT_OAUTH from env");
    return token;
  }
  console.log("[bot] fetching Twitch token from API");
  const token = await fetchTwitchToken(config.apiBaseUrl, config.botSharedSecret);
  scheduleRefresh(token.expiresAt);
  return `oauth:${token.accessToken}`;
}

async function reconnectWithToken(accessToken: string, expiresAt: string) {
  if (client) {
    await client.disconnect().catch(() => undefined);
  }
  const oauth = accessToken.startsWith("oauth:") ? accessToken : `oauth:${accessToken}`;
  client = createClient(oauth);
  scheduleRefresh(expiresAt);
  await client.connect();
}

function createClient(oauth: string) {
  console.log(`[bot] creating client for ${config.username} -> #${config.channel}`);
  const newClient = new tmi.Client({
    options: { debug: true },
    identity: {
      username: config.username,
      password: oauth
    },
    channels: [config.channel]
  });

  newClient.on("connected", (address: string, port: number) => {
    console.log(`[bot] connected to ${address}:${port}`);
  });

  newClient.on("disconnected", (reason: string) => {
    console.log(`[bot] disconnected: ${reason}`);
  });

  newClient.on("message", async (channel: string, tags: ChatUserstate, message: string, self: boolean) => {
    const userLabel = tags["display-name"] || tags.username || "unknown";
    console.log(`[bot] message in ${channel} from ${userLabel}: ${message}`);
  if (self) {
    return;
  }

  const result = parseSongsPlay(message);
  if (result.type === "ignore") {
    return;
  }

  const userLabelSafe = typeof userLabel === "string" ? userLabel : "unknown";

  const activeClient = client;
  if (!activeClient) {
    console.warn("[bot] client not ready, skipping message handling.");
    return;
  }

  if (result.type === "invalid") {
    console.log(`[bot] invalid command from ${userLabelSafe}: ${result.reason}`);
    await activeClient.say(channel, result.reason);
    return;
  }

  try {
    console.log(`[bot] handling request from ${userLabelSafe}: ${result.query}`);
    const response = await withRetry(
      () =>
        sendSongRequest(config.apiBaseUrl, config.botSharedSecret, {
          twitchUser: userLabelSafe,
          query: result.query
        }),
      2
    );
    console.log(`[bot] queued: ${response.youtubeTitle} (${response.youtubeVideoId})`);
    await activeClient.say(
      channel,
      `Queued: ${response.youtubeTitle} (requested by @${userLabelSafe}).`
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Request failed";
    console.log(`[bot] failed to queue for ${userLabelSafe}: ${msg}`);
    await activeClient.say(channel, `Could not queue song (${msg}).`);
  }
});

  return newClient;
}

getOauthToken()
  .then(async (oauth) => {
    client = createClient(oauth);
    await client.connect();
  })
  .catch((error: unknown) => {
    console.error("Failed to connect to Twitch chat.", error);
    process.exit(1);
  });
