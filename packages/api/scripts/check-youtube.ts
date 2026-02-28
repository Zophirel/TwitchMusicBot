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

const apiKey = process.env.YOUTUBE_API_KEY;
if (!apiKey) {
  console.error("YOUTUBE_API_KEY is not set. Add it to packages/api/.env or root .env.");
  process.exit(1);
}

const query = process.argv.slice(2).join(" ").trim() || "lofi hip hop";
const params = new URLSearchParams({
  part: "snippet",
  type: "video",
  maxResults: "1",
  videoEmbeddable: "true",
  q: query,
  key: apiKey
});

const url = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;

try {
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    console.error(`YouTube API error: ${response.status}`);
    console.error(text);
    process.exit(1);
  }

  const data = (await response.json()) as {
    items?: Array<{ id?: { videoId?: string }; snippet?: { title?: string } }>;
  };

  const item = data.items?.[0];
  const videoId = item?.id?.videoId;
  const title = item?.snippet?.title;

  if (!videoId || !title) {
    console.error("No results returned. Check API key, quotas, or query.");
    process.exit(1);
  }

  console.log("YouTube API OK");
  console.log(`Query: ${query}`);
  console.log(`Video ID: ${videoId}`);
  console.log(`Title: ${title}`);
} catch (error) {
  console.error("YouTube API request failed.");
  console.error(error);
  process.exit(1);
}
