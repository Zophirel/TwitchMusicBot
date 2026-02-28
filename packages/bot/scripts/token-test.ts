import "dotenv/config";
import { fetchTwitchToken } from "../src/api.js";
import { loadConfig } from "../src/config.js";

async function run() {
  const config = loadConfig();
  console.log(`apiBaseUrl=${config.apiBaseUrl}`);
  const token = await fetchTwitchToken(config.apiBaseUrl, config.botSharedSecret);
  console.log("Token OK");
  console.log(`expiresAt=${token.expiresAt}`);
  console.log(`accessToken=${token.accessToken.slice(0, 6)}...`);
}

run().catch((error) => {
  if (error instanceof Error) {
    console.error(error.message);
    // Surface nested fetch error causes (ECONNREFUSED, etc.)
    const anyError = error as Error & { cause?: unknown };
    if (anyError.cause) {
      console.error("cause:", anyError.cause);
    }
  } else {
    console.error(error);
  }
  process.exit(1);
});
