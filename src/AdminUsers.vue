<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { AdminUserSummary } from "../shared/contracts";
import { getAdminUsers } from "./api";
import { formatMemberDate, userInitials } from "./user-format";

const users = ref<AdminUserSummary[]>([]);
const loading = ref(true);
const errorMessage = ref("");

const profileCount = computed(() => users.value.filter((user) => user.displayName).length);

async function loadUsers() {
  loading.value = true;
  errorMessage.value = "";
  try {
    users.value = await getAdminUsers();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unable to load the user list.";
  } finally {
    loading.value = false;
  }
}

onMounted(loadUsers);
</script>

<template>
  <section class="admin-users-card">
    <div class="section-heading admin-section-heading">
      <div>
        <p class="eyebrow">USER DIRECTORY</p>
        <h2>Existing users</h2>
      </div>

      <div v-if="!loading && !errorMessage" class="user-stats">
        <span
          ><strong>{{ users.length }}</strong> users</span
        >
        <span
          ><strong>{{ profileCount }}</strong> profiles</span
        >
      </div>
    </div>

    <div v-if="loading" class="inline-state" aria-live="polite">
      <span class="spinner" aria-hidden="true"></span>
      <p>Loading users from D1…</p>
    </div>

    <div v-else-if="errorMessage" class="inline-state error-state">
      <span class="state-icon" aria-hidden="true">!</span>
      <p>{{ errorMessage }}</p>
      <button class="button primary" type="button" @click="loadUsers">Try again</button>
    </div>

    <div v-else-if="users.length === 0" class="inline-state">
      <p>There are no users yet.</p>
    </div>

    <div v-else class="users-table-wrap">
      <table class="users-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Timezone</th>
            <th>Member since</th>
            <th><span class="sr-only">Role</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="listedUser in users" :key="listedUser.id">
            <td data-label="User">
              <div class="listed-user">
                <img
                  v-if="listedUser.avatarUrl"
                  class="listed-avatar"
                  :src="listedUser.avatarUrl"
                  alt=""
                  referrerpolicy="no-referrer"
                />
                <span v-else class="listed-avatar listed-avatar-fallback">
                  {{ userInitials(listedUser.displayName, listedUser.email) }}
                </span>
                <span class="listed-identity">
                  <strong>{{ listedUser.displayName || "Name not set" }}</strong>
                  <small>{{ listedUser.email }}</small>
                </span>
              </div>
            </td>
            <td data-label="Timezone">
              {{ listedUser.timezone || "Not set" }}
            </td>
            <td data-label="Member since">
              {{ formatMemberDate(listedUser.createdAt, "short") }}
            </td>
            <td data-label="Role" class="role-cell">
              <span v-if="listedUser.isAdmin" class="admin-badge">Admin</span>
              <span v-else class="member-label">Member</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
