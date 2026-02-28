<template>
  <section class="player-page">
    <RouterLink v-if="showBack" to="/admin" class="back-link" aria-label="Back to admin">
      <span class="arrow">←</span>
      Back to Admin
    </RouterLink>
    <div class="player-grid">
      <div class="panel overview">
        <div class="panel-header">
          <div class="header-main">
            <div class="eyebrow">Player</div>
            <h1>Stream Playback</h1>
            <p>Monitor the queue and current song from the overlay view.</p>
          </div>

        </div>

        <div class="player-card">
          <PlayerFrame :key="playerKey" :video-id="store.nowPlaying?.youtubeVideoId" :autoplay="store.settings.autoplay"
            @ended="handleEnded" />
        </div>
      </div>

      <div class="panel info">
        <div class="info-block">
          <div class="label">Now Playing</div>
          <div class="title">
            {{ store.nowPlaying?.youtubeTitle || "Waiting for a song" }}
          </div>
          <div class="meta" v-if="store.nowPlaying">
            Requested by @{{ store.nowPlaying.twitchUser }}
          </div>
        </div>
        <div class="info-block">
          <div class="label">Autoplay</div>
          <div class="title">{{ store.settings.autoplay ? "Enabled" : "Manual" }}</div>
          <div class="meta">
            {{ store.settings.autoplay ? "Next song will auto-start" : "Admin must press Start" }}
          </div>
        </div>
        <div class="info-block" v-if="nextUp">
          <div class="label">Next Up</div>
          <div class="title">{{ nextUp.youtubeTitle }}</div>
          <div class="meta">Requested by @{{ nextUp.twitchUser }}</div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useAppStore } from "../stores/app";
import PlayerFrame from "../components/PlayerFrame.vue";

const store = useAppStore();
const endingId = ref<string | null>(null);
const playerKey = computed(() => store.nowPlaying?.id ?? "idle");
const route = useRoute();
const showBack = computed(() => route.query.from === "admin");

onMounted(() => {
  store.init();
});

const nextUp = computed(() => store.queue[0]);

watch(
  () => store.nowPlaying?.id,
  (id) => {
    if (id && endingId.value === id) {
      return;
    }
    endingId.value = null;
  }
);

async function handleEnded() {
  const currentId = store.nowPlaying?.id;
  if (!currentId || endingId.value === currentId) {
    return;
  }
  endingId.value = currentId;
  try {
    await store.skipPlayback();
  } catch {
    // Ignore if not authenticated; admin session is required to advance queue.
  }
}
</script>

<style scoped>
.player-page {
  min-height: 100vh;
  padding: 32px 48px 64px;
  background:
    radial-gradient(900px 500px at 10% -10%, rgba(239, 125, 59, 0.18), transparent 60%),
    radial-gradient(800px 500px at 95% 0%, rgba(58, 99, 224, 0.18), transparent 55%),
    #0f0e0d;
  color: #f6f3ef;
}

.player-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(280px, 1fr);
  gap: 24px;
  align-items: start;
}

.panel {
  background: rgba(20, 18, 16, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  padding: 24px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
}

.overview {
  display: grid;
  gap: 20px;
}

.info-block {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 16px 18px;
  border-radius: 16px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.header-main h1 {
  margin: 6px 0;
  font-size: 2rem;
}

.header-main p {
  margin: 0;
  color: rgba(255, 255, 255, 0.65);
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.3em;
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.5);
}

.back-link {
  position: relative;
  margin-bottom: 30px;
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.85);
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  background: rgba(15, 14, 13, 0.7);
  backdrop-filter: blur(6px);
  z-index: 1;
}

.back-link .arrow {
  font-size: 1.1rem;
}

.player-card {
  background: #141210;
  padding: 18px;
  border-radius: 20px;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.05);
}

.info {
  display: grid;
  gap: 16px;
}

.label {
  text-transform: uppercase;
  font-size: 0.65rem;
  letter-spacing: 0.2em;
  color: rgba(255, 255, 255, 0.6);
}

.title {
  font-size: 1.2rem;
  margin: 8px 0 4px;
}

.meta {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.6);
}

@media (max-width: 900px) {
  .player-page {
    padding: 20px 24px 48px;
  }

  .player-grid {
    grid-template-columns: 1fr;
  }

  .panel-header {
    flex-direction: column;
  }

  .back-link {
    align-self: flex-start;
  }
}
</style>
