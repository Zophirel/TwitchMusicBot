<template>
  <div ref="shellRef" class="player-shell">
    <div ref="frameRef" :id="containerId" class="player-frame"></div>
    <div v-if="needsUserAction" class="player-overlay">
      <div class="overlay-card">
        <p>Audio blocked by the browser.</p>
        <button class="primary" @click="enableAudio">Click to enable audio</button>
      </div>
    </div>
    <div v-if="error" class="player-error">{{ error }}</div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from "vue";

const props = defineProps<{ videoId?: string | null; autoplay: boolean }>();
const emit = defineEmits<{ (event: "ended"): void }>();

const containerId = `yt-player-${Math.random().toString(36).slice(2)}`;
const shellRef = ref<HTMLElement | null>(null);
const frameRef = ref<HTMLElement | null>(null);
const playerRef = ref<YT.Player | null>(null);
const isReady = ref(false);
const needsUserAction = ref(false);
const error = ref("");
const userActivated = ref(false);
const STORAGE_KEY = "musicbot_audio_enabled";
let autoplayCheckTimer: number | null = null;
let endCheckTimer: number | null = null;
let currentVideoId: string | null = null;
let endedEmittedFor: string | null = null;
let visibilityHandler: (() => void) | null = null;

let youtubeApiPromise: Promise<void> | null = null;

function loadYouTubeApi() {
  if (window.YT?.Player) {
    return Promise.resolve();
  }
  if (youtubeApiPromise) {
    return youtubeApiPromise;
  }
  youtubeApiPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector("script[data-youtube-iframe]");
    if (existing) {
      window.onYouTubeIframeAPIReady = () => resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.dataset.youtubeIframe = "true";
    script.onload = () => {
      if (window.YT?.Player) {
        resolve();
      }
    };
    script.onerror = () => reject(new Error("Failed to load YouTube API"));
    window.onYouTubeIframeAPIReady = () => resolve();
    document.head.appendChild(script);
  });
  return youtubeApiPromise;
}

function loadPersistedAudioState() {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === null) {
    window.localStorage.setItem(STORAGE_KEY, "true");
    return true;
  }
  return stored === "true";
}

function persistAudioState(enabled: boolean) {
  window.localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
}

function loadVideo(videoId?: string | null) {
  const player = playerRef.value;
  if (!player || !videoId) {
    return;
  }
  currentVideoId = videoId;
  endedEmittedFor = null;
  if (props.autoplay && userActivated.value) {
    player.loadVideoById(videoId);
    player.playVideo();
    needsUserAction.value = false;
    if (autoplayCheckTimer) {
      window.clearTimeout(autoplayCheckTimer);
    }
    autoplayCheckTimer = window.setTimeout(() => {
      if (player.getPlayerState() !== 1) {
        needsUserAction.value = true;
        userActivated.value = false;
      }
    }, 1200);
  } else {
    player.cueVideoById(videoId);
    needsUserAction.value = true;
  }
}

function enableAudio() {
  const player = playerRef.value;
  if (!player) {
    return;
  }
  userActivated.value = true;
  persistAudioState(true);
  needsUserAction.value = false;
  player.playVideo();
}

function stopEndCheck() {
  if (endCheckTimer) {
    window.clearInterval(endCheckTimer);
    endCheckTimer = null;
  }
}

function emitEndedOnce() {
  if (!currentVideoId || endedEmittedFor === currentVideoId) {
    return;
  }
  endedEmittedFor = currentVideoId;
  emit("ended");
}

function startEndCheck() {
  const player = playerRef.value;
  if (!player || endCheckTimer) {
    return;
  }
  endCheckTimer = window.setInterval(() => {
    const state = player.getPlayerState();
    if (state === 0) {
      stopEndCheck();
      emitEndedOnce();
      return;
    }
    if (state !== 1) {
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const duration = (player as any).getDuration();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const current = (player as any).getCurrentTime();
    if (duration > 0 && current >= duration - 0.5) {
      stopEndCheck();
      emitEndedOnce();
    }
  }, 1000);
}

onMounted(async () => {
  try {
    userActivated.value = loadPersistedAudioState();
    await loadYouTubeApi();
    const player = new window.YT!.Player(frameRef.value ?? containerId, {
      width: "100%",
      height: "100%",
      videoId: props.videoId ?? undefined,
      playerVars: {
        modestbranding: 1,
        rel: 0,
        playsinline: 1,
        enablejsapi: 1
      },
      events: {
        onReady: () => {
          isReady.value = true;
          loadVideo(props.videoId);
        },
        onStateChange: (event) => {
          if (event.data === 1 && !userActivated.value) {
            userActivated.value = true;
            persistAudioState(true);
            needsUserAction.value = false;
          }
          if (event.data === 1) {
            startEndCheck();
          } else {
            stopEndCheck();
          }
          if (event.data === 0) {
            emitEndedOnce();
          }
        },
        onError: (event) => {
          console.log(event)
          error.value = "Failed to load YouTube video.";
        }
      }
    });
    playerRef.value = player;
    visibilityHandler = () => {
      if (document.visibilityState !== "visible") {
        return;
      }
      const activePlayer = playerRef.value;
      if (!activePlayer || !props.videoId) {
        return;
      }
      const state = activePlayer.getPlayerState();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const duration = (activePlayer as any).getDuration();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const current = (activePlayer as any).getCurrentTime();
      if (state === 0 || (duration > 0 && current >= duration - 0.5)) {
        emitEndedOnce();
        return;
      }
      if (!props.autoplay || !userActivated.value) {
        return;
      }
      if (state !== 1) {
        activePlayer.playVideo();
      }
    };
    document.addEventListener("visibilitychange", visibilityHandler);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to load YouTube API";
  }
});

onBeforeUnmount(() => {
  if (autoplayCheckTimer) {
    window.clearTimeout(autoplayCheckTimer);
  }
  stopEndCheck();
  if (visibilityHandler) {
    document.removeEventListener("visibilitychange", visibilityHandler);
    visibilityHandler = null;
  }
  playerRef.value?.destroy();
  playerRef.value = null;
});

watch(
  () => props.videoId,
  (videoId) => {
    if (isReady.value) {
      loadVideo(videoId);
    }
  }
);

watch(
  () => props.autoplay,
  (autoplay) => {
    if (autoplay && props.videoId && userActivated.value) {
      playerRef.value?.playVideo();
    }
  }
);
</script>

<style scoped>
.player-shell {
  position: relative;
  width: 50vw;
  min-width: 500px !important;
  max-width: 100%;
  aspect-ratio: 16 / 9;
  background: #0f0e0d;
  border-radius: 18px;
  overflow: hidden;
}

.player-frame {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.player-frame :deep(iframe) {
  position: absolute;
  inset: 0;
  width: 100% !important;
  height: 100% !important;
  border: 0;
}

.player-overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(15, 14, 13, 0.65);
  backdrop-filter: blur(6px);
}

.overlay-card {
  background: #1f1a16;
  color: #f6f3ef;
  padding: 20px 24px;
  border-radius: 14px;
  display: grid;
  gap: 12px;
  text-align: center;
}

.primary {
  background: #ef7d3b;
  color: #1f1a16;
  border: none;
  padding: 10px 16px;
  border-radius: 999px;
  font-weight: 600;
  cursor: pointer;
}

.player-error {
  position: absolute;
  bottom: 16px;
  left: 16px;
  right: 16px;
  background: rgba(255, 255, 255, 0.9);
  color: #9a2f1a;
  padding: 8px 12px;
  border-radius: 10px;
  font-size: 0.9rem;
}
</style>
