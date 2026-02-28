import "dotenv/config";
import { PrismaClient } from "@prisma/client";

type ValidateResponse = {
  client_id: string;
  login: string;
  user_id: string;
  scopes?: string[] | null;
  expires_in: number;
};

const prisma = new PrismaClient();

async function run() {
  const auth = await prisma.twitchAuth.findUnique({ where: { id: 1 } });
  if (!auth) {
    throw new Error("No Twitch auth found. Run npm run -w @musicbot/api twitch:device first.");
  }

  const response = await fetch("https://id.twitch.tv/oauth2/validate", {
    headers: {
      Authorization: `OAuth ${auth.accessToken}`
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token validation failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as ValidateResponse;
  console.log(`login=${data.login}`);
  console.log(`user_id=${data.user_id}`);
  console.log(`client_id=${data.client_id}`);
  console.log(`scopes=${data.scopes?.join(", ") ?? ""}`);
  console.log(`expires_in=${data.expires_in}s`);
}

run()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
