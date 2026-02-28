<template>
  <div :class="['app', { minimal: isMinimal }]">
    <header v-if="!isMinimal" class="topbar">
      <div class="brand">
        <span class="dot"></span>
        <div>
          <strong>MusicBot</strong>
          <span class="subtitle">Stream queue control</span>
        </div>
      </div>
      <nav class="nav">
        <RouterLink to="/admin">Admin</RouterLink>
        <RouterLink to="/admin/settings">Settings</RouterLink>
        <RouterLink :to="{ path: '/player', query: { from: 'admin' } }">Player</RouterLink>
      </nav>
    </header>
    <main class="main">
      <RouterView />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();
const isMinimal = computed(() => Boolean(route.meta.minimal));
</script>

<style scoped>
.app {
  min-height: 100vh;
  display: grid;
  grid-template-rows: auto 1fr;
}

.app.minimal {
  grid-template-rows: 1fr;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28px 48px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand strong {
  font-size: 1.1rem;
  letter-spacing: 0.04em;
}

.subtitle {
  display: block;
  font-size: 0.85rem;
  color: var(--muted);
}

.dot {
  width: 16px;
  height: 16px;
  background: var(--accent);
  border-radius: 50%;
  box-shadow: 0 0 0 6px rgba(239, 125, 59, 0.2);
}

.nav {
  display: flex;
  gap: 16px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.75rem;
}

.nav a {
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid transparent;
}

.nav a.router-link-active {
  background: var(--panel);
  border-color: var(--border);
}

.main {
  padding: 32px 48px 64px;
}

.app.minimal .main {
  padding: 0;
}

@media (max-width: 900px) {
  .topbar {
    padding: 20px 24px;
  }
  .main {
    padding: 20px 24px 48px;
  }
}
</style>
