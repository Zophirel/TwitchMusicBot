import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { requireSecret } from "../src/config.js";
import { exchangeDeviceCode, requestDeviceCode, type TokenErrorResponse } from "../src/services/twitch.js";

const prisma = new PrismaClient();

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  const clientId = requireSecret(process.env.TWITCH_CLIENT_ID, "TWITCH_CLIENT_ID");
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  const device = await requestDeviceCode(clientId, ["chat:read", "chat:edit"]);
  const expiresAt = Date.now() + device.expires_in * 1000;

  console.log("Authorize the bot:");
  console.log(`  Open: ${device.verification_uri}`);
  console.log(`  Code: ${device.user_code}`);
  console.log("Waiting for authorization...");
  
  await sleep(10000)
  
  while (Date.now() < expiresAt) {
    const token = await exchangeDeviceCode(clientId, clientSecret, device.device_code);
    if ("error" in token) {
      const errorCode = (token as TokenErrorResponse).error;
      if (errorCode === "authorization_pending") {
        await sleep(device.interval * 1000);
        continue;
      }
      if (errorCode === "slow_down") {
        await sleep((device.interval + 5) * 1000);
        continue;
      }
      throw new Error(`Device flow failed (${errorCode}).`);
    }

    console.log("Token response:", token);

    if (!token.refresh_token) {
      console.error("No refresh token returned. Ensure offline_access scope and client secret are set.");
      process.exitCode = 1;
      return;
    }

    await prisma.twitchAuth.upsert({
      where: { id: 1 },
      update: {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        scope: token.scope?.join(" ") ?? null,
        expiresAt: new Date(Date.now() + token.expires_in * 1000)
      },
      create: {
        id: 1,
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        scope: token.scope?.join(" ") ?? null,
        expiresAt: new Date(Date.now() + token.expires_in * 1000)
      }
    });

    console.log("Twitch device authorization saved.");
    return;
  }

  throw new Error("Device authorization expired.");
}

run()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
