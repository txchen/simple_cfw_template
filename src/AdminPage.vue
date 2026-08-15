<script setup lang="ts">
import AdminUsers from "./AdminUsers.vue";
import "./styles/admin.css";
</script>

<template>
  <section class="hero admin-hero">
    <p class="eyebrow">ADMIN ONLY</p>
    <h1>User management</h1>
    <p class="hero-copy">
      This page lists everyone who has visited the app and received a D1 user record. Admin access
      comes from server configuration and is not stored in user profiles.
    </p>
  </section>

  <AdminUsers />
</template>
