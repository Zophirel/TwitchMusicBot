<template>
  <section class="admin-grid">
    <div class="panel overview">
      <div class="panel-header">
        <div>
          <h1>Admin Dashboard</h1>
          <p>Manage playback, requests, and the on-stream overlay.</p>
        </div>
        <div class="status" :class="{ online: store.socketConnected }">
          <span class="dot"></span>
          {{ store.socketConnected ? "Live" : "Offline" }}
        </div>
      </div>

      <div class="now-playing">
        <div class="label">Now Playing</div>
        <div class="title">
          {{ store.nowPlaying?.youtubeTitle || "Nothing playing" }}
        </div>
        <div class="meta" v-if="store.nowPlaying">
          Requested by @{{ store.nowPlaying.twitchUser }} � {{ store.nowPlaying.query }}
        </div>
      </div>

      <div v-if="store.updateInfo?.updateAvailable" class="update-banner">
        <div class="label">Update Available</div>
        <div class="title">New version detected.</div>
        <div class="meta">
          Latest: {{ store.updateInfo.latestSha.slice(0, 7) }} · Current:
          {{ store.updateInfo.currentSha?.slice(0, 7) ?? "unknown" }}
        </div>
      </div>

      <div class="controls">
        <button class="primary" :disabled="!store.isAdmin" @click="store.startPlayback()">
          Start
        </button>
        <button class="ghost" :disabled="!store.isAdmin" @click="store.skipPlayback()">
          Skip
        </button>
        <button class="ghost" :disabled="!store.isAdmin" @click="store.clearQueue()">
          Clear Queue
        </button>
        <button class="toggle" :disabled="!store.isAdmin" @click="toggleAutoplay">
          Autoplay: {{ store.settings.autoplay ? "On" : "Off" }}
        </button>
      </div>
    </div>

    <div class="panel queue">
      <div class="queue-header">
        <h2>Queue</h2>
        <span class="count">{{ store.queue.length }} queued</span>
      </div>
      <div v-if="store.queue.length === 0" class="empty">
        No queued songs yet.
      </div>
      <ul v-else>
        <li v-for="(song, index) in store.queue" :key="song.id" class="queue-item">
          <div class="queue-main">
            <strong>{{ song.youtubeTitle }}</strong>
            <span>Requested by @{{ song.twitchUser }}</span>
          </div>
          <div class="queue-actions">
            <button
              class="ghost"
              :disabled="!store.isAdmin || index === 0"
              @click="moveQueue(index, -1)"
            >
              Up
            </button>
            <button
              class="ghost"
              :disabled="!store.isAdmin || index === store.queue.length - 1"
              @click="moveQueue(index, 1)"
            >
              Down
            </button>
            <button class="ghost" :disabled="!store.isAdmin" @click="store.removeFromQueue(song.id)">
              Remove
            </button>
          </div>
        </li>
      </ul>
    </div>

    <div v-if="showLogin" class="modal-backdrop">
      <div class="modal">
        <div class="modal-header">
          <h2>Admin Login</h2>
        </div>
        <p>Enter the admin password to unlock controls.</p>
        <form @submit.prevent="submitLogin">
          <input v-model="password" type="password" placeholder="Admin password" required />
          <button class="primary" type="submit">Sign in</button>
          <p class="error" v-if="authError">{{ authError }}</p>
        </form>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { useAppStore } from "../stores/app";

const store = useAppStore();
const password = ref("");
const authError = ref("");
const showLogin = ref(false);

onMounted(() => {
  store.init();
});

watch(
  () => store.isAdmin,
  (isAdmin) => {
    showLogin.value = !isAdmin;
    if (!isAdmin) {
      authError.value = "";
      password.value = "";
    }
  },
  { immediate: true }
);

async function submitLogin() {
  authError.value = "";
  try {
    await store.login(password.value);
    password.value = "";
    showLogin.value = false;
  } catch (error) {
    authError.value = error instanceof Error ? error.message : "Login failed";
  }
}

async function toggleAutoplay() {
  await store.setAutoplay(!store.settings.autoplay);
}

async function moveQueue(index: number, delta: number) {
  const ids = store.queue.map((song) => song.id);
  const target = index + delta;
  if (target < 0 || target >= ids.length) {
    return;
  }
  const [moving] = ids.splice(index, 1);
  ids.splice(target, 0, moving);
  await store.reorderQueue(ids);
}
</script>

<style scoped>
.admin-grid {
  display: grid;
  gap: 24px;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  max-width: 872px;
  margin: 0 auto;
}

.panel {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 24px;
  box-shadow: var(--shadow);
}

.overview {
  grid-column: 1 / -1;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.panel-header h1 {
  margin: 0 0 6px;
  font-size: 2rem;
}

.status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(106, 95, 85, 0.1);
  color: var(--muted);
}

.status.online {
  background: rgba(46, 148, 87, 0.12);
  color: #2b6a44;
}

.status .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.now-playing {
  margin-top: 20px;
  padding: 16px 18px;
  background: rgba(239, 125, 59, 0.08);
  border-radius: 16px;
}

.update-banner {
  margin-top: 16px;
  padding: 14px 16px;
  border-radius: 14px;
  background: rgba(58, 99, 224, 0.12);
  border: 1px solid rgba(58, 99, 224, 0.25);
}

.now-playing .label {
  text-transform: uppercase;
  font-size: 0.7rem;
  letter-spacing: 0.15em;
  color: var(--muted);
}

.now-playing .title {
  font-size: 1.4rem;
  font-weight: 600;
  margin: 8px 0 4px;
}

.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 20px;
}

.primary,
.ghost,
.toggle {
  border-radius: 999px;
  padding: 10px 16px;
  border: 1px solid transparent;
  cursor: pointer;
  font-weight: 600;
}

.primary {
  background: var(--accent);
  color: #1f1a16;
}

.ghost {
  background: transparent;
  border-color: var(--border);
}

.toggle {
  background: #1f1a16;
  color: #f6f3ef;
}

.primary:disabled,
.ghost:disabled,
.toggle:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.auth h2 {
  margin-top: 0;
}

.auth form {
  display: grid;
  gap: 12px;
  margin-top: 12px;
}

.auth input {
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: white;
}

.error {
  color: #9a2f1a;
  margin: 0;
}

.queue-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
}

.count {
  font-size: 0.85rem;
  color: var(--muted);
}

.queue ul {
  list-style: none;
  margin: 16px 0 0;
  padding: 0;
  display: grid;
  gap: 12px;
}

.queue-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 12px 14px;
  border-radius: 14px;
  background: white;
  border: 1px solid var(--border);
}

.queue-main {
  display: grid;
  gap: 4px;
}

.queue-main span {
  font-size: 0.85rem;
  color: var(--muted);
}

.queue-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.empty {
  padding: 16px 0 0;
  color: var(--muted);
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 14, 13, 0.65);
  display: grid;
  place-items: center;
  z-index: 10;
  backdrop-filter: blur(4px);
}

.modal {
  width: min(420px, 92vw);
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 18px;
  padding: 20px;
  box-shadow: var(--shadow);
  display: grid;
  gap: 12px;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.modal form {
  display: grid;
  gap: 12px;
  margin-top: 8px;
}

.modal input {
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: white;
}

@media (max-width: 700px) {
  .overview {
    grid-column: 1 / -1;
  }
  .panel-header {
    flex-direction: column;
  }
  .queue-item {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
