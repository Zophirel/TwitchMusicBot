import "dotenv/config";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server as SocketIOServer } from "socket.io";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const app = createApp({ config });
const server = http.createServer(app);

const io = new SocketIOServer(server, {
  path: "/socket.io",
  cors: config.devCorsOrigins.length > 0
    ? {
        origin: config.devCorsOrigins,
        credentials: true
      }
    : undefined
});

app.locals.io = io;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webDist = path.resolve(__dirname, "../../web/dist");
const indexHtml = path.join(webDist, "index.html");
if (!fs.existsSync(indexHtml)) {
  console.warn(`[api] web build missing: ${indexHtml}`);
}

server.listen(config.port, config.host, () => {
  console.log(`api listening on http://${config.host}:${config.port}`);
});
