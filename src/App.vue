<script setup lang="ts">
import { onMounted, ref } from "vue";
import type { AppUser } from "../shared/contracts";
import AdminPage from "./AdminPage.vue";
import { getCurrentUser } from "./api";
import ProfilePage from "./ProfilePage.vue";
import SiteHeader from "./SiteHeader.vue";

const user = ref<AppUser | null>(null);
const loading = ref(true);
const loadError = ref("");
const isAdminPage = window.location.pathname === "/admin";

async function load() {
  loading.value = true;
  loadError.value = "";
  try {
    user.value = await getCurrentUser();
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : "Unable to load the current user.";
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="app-shell">
    <SiteHeader :user="user" :is-admin-page="isAdminPage" />

    <main>
      <section v-if="loading" class="state-card" aria-live="polite">
        <span class="spinner" aria-hidden="true"></span>
        <p>Verifying your identity and loading your profile…</p>
      </section>

      <section v-else-if="loadError" class="state-card error-state">
        <span class="state-icon" aria-hidden="true">!</span>
        <h1>Unable to open your profile</h1>
        <p>{{ loadError }}</p>
        <button class="button primary" type="button" @click="load">Try again</button>
      </section>

      <template v-else-if="user && isAdminPage">
        <AdminPage v-if="user.isAdmin" />
        <section v-else class="state-card error-state">
          <span class="state-icon" aria-hidden="true">!</span>
          <h1>Access denied</h1>
          <p>This page is available to administrators only.</p>
          <a class="button primary button-link" href="/">Back to profile</a>
        </section>
      </template>

      <ProfilePage v-else-if="user" :user="user" />
    </main>

    <footer>Cloudflare Workers | Access | D1</footer>
  </div>
</template>
