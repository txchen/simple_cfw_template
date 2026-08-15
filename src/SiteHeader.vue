<script setup lang="ts">
import type { AppUser } from "../shared/contracts";

defineProps<{
  user: AppUser | null;
  isAdminPage: boolean;
}>();
</script>

<template>
  <header class="site-header">
    <a class="brand" href="/" aria-label="Family App home">
      <span class="brand-mark" aria-hidden="true">F</span>
      <span>Family App</span>
    </a>

    <div v-if="user" class="header-user">
      <nav v-if="user.isAdmin" class="header-nav" aria-label="Admin navigation">
        <a v-if="isAdminPage" href="/">Back to profile</a>
        <a v-else href="/admin">Manage users</a>
      </nav>
      <span class="header-email">{{ user.email }}</span>
      <a
        v-if="user.authProvider === 'cloudflare-access'"
        class="logout-link"
        href="/cdn-cgi/access/logout"
      >
        Log out
      </a>
      <span v-else class="dev-badge">Local dev</span>
    </div>
  </header>
</template>
