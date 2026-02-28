You are an expert full‑stack engineer. Generate a production‑minded monorepo (npm workspaces) with three packages: bot (Node.js Twitch chat bot), api (Node.js local backend), web (Vue 3 frontend). Use TypeScript everywhere. Provide complete code (not pseudocode) and include .env.example, setup instructions, and minimal tests.
Use Volta to pin Node/npm versions (add a olta block in the root package.json).


Core goal
Twitch viewer types: !songsplay <songname> in chat.

Bot receives the command and creates a song request.

Backend searches YouTube for the song and maintains a playlist/queue.

Frontend shows the queue + player and lets the streamer control playback (autoplay or manual).

Playback must be via YouTube IFrame Player API (embed only; do not download audio).

Deployment/security constraints (IMPORTANT)
This system is intended for single-host local use (streamer PC). Implement it as a local backend that listens only on loopback:

API must bind to 127.0.0.1 (and optionally ::1), never 0.0.0.0.

Provide a single-origin setup by default: the Node backend serves the Vue build so UI+API are the same origin (avoid CORS in production). In dev, you may use Vite on a separate port, but keep prod same-origin.

Threat model: the main risks are browser-to-localhost attacks (CSRF/DNS rebinding/CORS mistakes). Harden accordingly:

Do not enable permissive CORS. Prefer no CORS needed (same-origin). If dev CORS is needed, allowlist only http://127.0.0.1:<vitePort>; never *, never allow null origin.

Add admin authentication for all privileged endpoints (start/skip/remove/reorder/settings).

Add CSRF protection for state-changing admin routes (token or double-submit, plus Origin/Host checks).

Validate Host header against an allowlist (127.0.0.1:<port>, localhost:<port> if you choose to support it).

Use Helmet, rate limiting, and strict input validation.

Secrets:

YouTube API key and Twitch bot OAuth must never be shipped to the browser.

Store secrets in the local backend/bot via env vars.

Architecture
bot: connects to Twitch chat via tmi.js, listens for commands, forwards requests securely to api.

api: Express/Fastify (choose one) + Prisma + SQLite, Socket.IO for realtime queue updates to web, serves the built Vue app and /player overlay route.

web: Vue 3 + Vite + Pinia. Has two UI modes:

/admin dashboard (requires login)

/player minimal overlay for OBS Browser Source (player + current song + optional next)

Bot behavior
Parse !songsplay with remainder as query (trim, max length 80, reject empty).

Send POST to http://127.0.0.1:<API_PORT>/internal/bot/song-request.

On success, reply in chat: Queued: <title> (requested by @user).

On failure, reply with a short error.

Bot → API request authentication (HMAC + anti-replay)
Implement request signing so random local webpages can’t easily spoof bot requests:

Headers:

x-bot-ts: unix ms timestamp

x-bot-sig: hex(HMAC_SHA256(BOT_SHARED_SECRET, ${ts}.${rawBody}))

API verifies:

timestamp within 30 seconds

signature matches

rate-limit per Twitch username + per IP (even if loopback, still do it)

YouTube search + storage
Use YouTube Data API v3 search.list:

q=<songname>, type=video, maxResults=1

Prefer embeddable results if possible; store youtubeVideoId and youtubeTitle

Persist in SQLite via Prisma.

Data model (Prisma)
SongRequest:

id (uuid/cuid)

twitchUser (string)

query (string)

createdAt (datetime)

youtubeVideoId (string)

youtubeTitle (string)

status enum: QUEUED | PLAYING | PLAYED | REJECTED

Settings (singleton):

id fixed (e.g., 1)

autoplay boolean

updatedAt datetime

API endpoints
Public read:

GET /api/queue → current queue + now playing + settings (no secrets)

Internal (bot only, HMAC protected):

POST /internal/bot/song-request → create request (body includes twitchUser, query)

Admin auth:

POST /api/admin/login → password from env, issue JWT in HttpOnly cookie

POST /api/admin/logout

Admin actions (all require auth + CSRF):

POST /api/admin/settings → set autoplay on/off

POST /api/admin/queue/start → start playing (if manual)

POST /api/admin/queue/skip → mark current as played, move to next

DELETE /api/admin/queue/:id → remove

POST /api/admin/queue/reorder → reorder by array of ids

POST /api/admin/queue/clear

Realtime:

Socket.IO namespace or path (same-origin) that broadcasts:

queue:update

player:state (optional)

settings:update

Frontend requirements (Vue 3)
Admin page:

Login form

Queue list with status badges

Buttons: Start/Stop, Skip, Remove, Clear, Toggle Autoplay

Optional reorder UI (drag & drop)

Player page (/player for OBS):

YouTube IFrame Player API integration

Shows current title + requester

If autoplay is enabled, load/play next automatically when a new request becomes PLAYING

If manual, waits for admin “Start”

Autoplay caveat:

Implement “manual start” as the reliable default if autoplay is blocked by browser policies; keep a visible “Click to enable audio” on /player when needed.

Dev scripts
npm run dev runs:

api (tsx/nodemon) on 127.0.0.1:3000

web (Vite) on 127.0.0.1:5173 in dev only

bot on Node

npm run build builds web and packages it to be served by api in production.

npm run start runs api (serving static web) + bot.

Deliverables
Full repo tree and all key files:

workspace package.json (npm workspaces)

api Express/Fastify app with security middlewares, auth, CSRF, Host checks, HMAC verify, Prisma + migrations, Socket.IO, static serving for Vue build, /player route

bot tmi.js bot with command parsing, HTTP client with HMAC signing, retry/backoff

web Vue 3 app with Pinia store, Socket.IO client, admin + player routes, YouTube IFrame Player API wrapper component

.env.example for each package (or root) including:

TWITCH_BOT_USERNAME, TWITCH_BOT_OAUTH

TWITCH_CHANNEL

YOUTUBE_API_KEY

BOT_SHARED_SECRET

ADMIN_PASSWORD

JWT_SECRET

PORT, HOST=127.0.0.1

Minimal tests:

API: HMAC verification test, CSRF-protected admin endpoint test

Bot: command parsing test

Generate the code now.
