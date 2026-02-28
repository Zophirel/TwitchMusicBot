<template>
  <section class="settings-grid">
    <div class="panel intro">
      <h1>Request Access</h1>
      <p>
        Control who can add songs from Twitch chat. The blacklist always blocks users, even
        when “let anyone play” is enabled.
      </p>
    </div>

    <div class="panel auth" v-if="!store.isAdmin">
      <h2>Admin Login</h2>
      <p>Sign in to edit settings.</p>
      <form @submit.prevent="submitLogin">
        <input v-model="password" type="password" placeholder="Admin password" required />
        <button class="primary" type="submit">Sign in</button>
        <p class="error" v-if="authError">{{ authError }}</p>
      </form>
    </div>

    <div class="panel form" v-else>
      <form @submit.prevent="saveSettings">
        <label class="toggle">
          <input type="checkbox" v-model="allowAnyone" @change="markDirty" />
          <span>Let anyone play (ignore whitelist only)</span>
        </label>

        <div class="field">
          <label>Whitelist</label>
          <p class="hint">One Twitch username per line. Ignored when “let anyone play” is on.</p>
          <textarea
            v-model="whitelistText"
            rows="6"
            placeholder="alice&#10;bob"
            @input="markDirty"
          ></textarea>
        </div>

        <div class="field">
          <label>Blacklist</label>
          <p class="hint">These users can never request songs.</p>
          <textarea
            v-model="blacklistText"
            rows="6"
            placeholder="troll123"
            @input="markDirty"
          ></textarea>
        </div>

        <div class="actions">
          <button class="primary" type="submit" :disabled="!canSave">
            {{ saving ? "Saving..." : "Save settings" }}
          </button>
          <span class="success" v-if="saveNote">{{ saveNote }}</span>
          <span class="error" v-if="saveError">{{ saveError }}</span>
        </div>
      </form>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useAppStore } from "../stores/app";

const store = useAppStore();
const password = ref("");
const authError = ref("");
const allowAnyone = ref(true);
const whitelistText = ref("");
const blacklistText = ref("");
const saving = ref(false);
const saveError = ref("");
const saveNote = ref("");
const dirty = ref(false);

const canSave = computed(() => store.isAdmin && dirty.value && !saving.value);

onMounted(() => {
  store.init();
});

watch(
  () => store.settings,
  (settings) => {
    if (dirty.value) {
      return;
    }
    allowAnyone.value = settings.allowAnyone;
    whitelistText.value = settings.whitelist.join("\n");
    blacklistText.value = settings.blacklist.join("\n");
  },
  { immediate: true }
);

function markDirty() {
  dirty.value = true;
  saveNote.value = "";
}

function parseList(value: string) {
  return value
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

async function submitLogin() {
  authError.value = "";
  try {
    await store.login(password.value);
    password.value = "";
  } catch (error) {
    authError.value = error instanceof Error ? error.message : "Login failed";
  }
}

async function saveSettings() {
  if (!store.isAdmin) {
    return;
  }
  saving.value = true;
  saveError.value = "";
  saveNote.value = "";
  try {
    await store.updateSettings({
      allowAnyone: allowAnyone.value,
      whitelist: parseList(whitelistText.value),
      blacklist: parseList(blacklistText.value)
    });
    dirty.value = false;
    saveNote.value = "Saved.";
  } catch (error) {
    saveError.value = error instanceof Error ? error.message : "Save failed";
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.settings-grid {
  display: grid;
  gap: 24px;
}

.panel {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 24px;
  box-shadow: var(--shadow);
}

.intro {
  grid-column: 1 / -1;
}

.intro h1 {
  margin-top: 0;
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

.form form {
  display: grid;
  gap: 18px;
}

.toggle {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  font-weight: 600;
}

.toggle input {
  width: 18px;
  height: 18px;
}

.field {
  display: grid;
  gap: 8px;
}

.field label {
  font-weight: 600;
}

.hint {
  margin: 0;
  font-size: 0.85rem;
  color: var(--muted);
}

textarea {
  resize: vertical;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--border);
  font-family: "Spline Sans Mono", ui-monospace, SFMono-Regular, Consolas, monospace;
}

.actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.primary {
  border-radius: 999px;
  padding: 10px 16px;
  border: 1px solid transparent;
  cursor: pointer;
  font-weight: 600;
  background: var(--accent);
  color: #1f1a16;
}

.primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.success {
  color: #2b6a44;
  font-weight: 600;
}

.error {
  color: #9a2f1a;
  margin: 0;
}

@media (max-width: 700px) {
  .actions {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
