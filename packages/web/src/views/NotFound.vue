<template>
  <section class="not-found">
    <h1>404</h1>
    <p>That page does not exist.</p>
    <RouterLink class="primary" to="/admin">Back to Admin</RouterLink>
  </section>
</template>

<script setup lang="ts"></script>

<style scoped>
.not-found {
  display: grid;
  place-items: center;
  min-height: 60vh;
  text-align: center;
  gap: 12px;
}

.primary {
  padding: 10px 18px;
  border-radius: 999px;
  background: var(--accent);
  color: #1f1a16;
  font-weight: 600;
}
</style>
