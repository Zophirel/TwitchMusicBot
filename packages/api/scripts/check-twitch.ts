import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const apiRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(apiRoot, "..");

const envCandidates = [path.join(apiRoot, ".env"), path.join(repoRoot, ".env")];
for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

const rawToken = process.env.TWITCH_BOT_OAUTH;
if (!rawToken) {
  console.error("TWITCH_BOT_OAUTH is not set. Add it to packages/api/.env or root .env.");
  process.exit(1);
}

const token = rawToken.startsWith("oauth:") ? rawToken.slice(6) : rawToken;

const validateRes = await fetch("https://id.twitch.tv/oauth2/validate", {
  headers: { Authorization: `OAuth ${token}` }
});

if (!validateRes.ok) {
  console.error(`Twitch OAuth validation failed: ${validateRes.status}`);
  console.error(await validateRes.text());
  process.exit(1);
}

const validateJson = (await validateRes.json()) as {
  client_id?: string;
  login?: string;
  scopes?: string[];
  expires_in?: number;
};

console.log("Twitch OAuth OK");
console.log(`Login: ${validateJson.login ?? "unknown"}`);
console.log(`Client ID: ${validateJson.client_id ?? "unknown"}`);
console.log(`Scopes: ${validateJson.scopes?.join(", ") ?? "none"}`);
console.log(`Expires in: ${validateJson.expires_in ?? "unknown"}s`);

const clientId = process.env.TWITCH_CLIENT_ID;
const channel = process.env.TWITCH_CHANNEL;

if (!clientId || !channel) {
  console.log("Skipping Helix user lookup (set TWITCH_CLIENT_ID and TWITCH_CHANNEL to enable)." );
  process.exit(0);
}

const userRes = await fetch(
  `https://api.twitch.tv/helix/users?login=${encodeURIComponent(channel)}`,
  {
    headers: {
      "Client-ID": clientId,
      Authorization: `Bearer ${token}`
    }
  }
);

if (!userRes.ok) {
  console.error(`Twitch Helix lookup failed: ${userRes.status}`);
  console.error(await userRes.text());
  process.exit(1);
}

const userJson = (await userRes.json()) as {
  data?: Array<{ id: string; login: string; display_name: string }>;
};

const user = userJson.data?.[0];
if (!user) {
  console.error("No user found for the configured TWITCH_CHANNEL.");
  process.exit(1);
}

console.log("Twitch Helix OK");
console.log(`Channel ID: ${user.id}`);
console.log(`Channel: ${user.display_name} (@${user.login})`);
