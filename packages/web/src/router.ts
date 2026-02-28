import { createRouter, createWebHistory } from "vue-router";
import AdminView from "./views/AdminView.vue";
import AdminSettingsView from "./views/AdminSettingsView.vue";
import PlayerView from "./views/PlayerView.vue";
import NotFound from "./views/NotFound.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/admin" },
    { path: "/admin", name: "admin", component: AdminView },
    { path: "/admin/settings", name: "admin-settings", component: AdminSettingsView },
    { path: "/player", name: "player", component: PlayerView, meta: { minimal: true } },
    { path: "/:pathMatch(.*)*", name: "not-found", component: NotFound }
  ],
  scrollBehavior() {
    return { top: 0 };
  }
});

export default router;
