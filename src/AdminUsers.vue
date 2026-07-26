<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { AdminUserSummary } from "../shared/contracts";
import { getAdminUsers } from "./api";

const users = ref<AdminUserSummary[]>([]);
const loading = ref(true);
const errorMessage = ref("");

const profileCount = computed(
  () => users.value.filter((user) => user.displayName).length,
);

function initials(user: AdminUserSummary) {
  const source = user.displayName || user.email;
  return source
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

async function loadUsers() {
  loading.value = true;
  errorMessage.value = "";
  try {
    users.value = await getAdminUsers();
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "无法加载用户列表。";
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
        <h2>现有用户</h2>
      </div>

      <div v-if="!loading && !errorMessage" class="user-stats">
        <span><strong>{{ users.length }}</strong> 位用户</span>
        <span><strong>{{ profileCount }}</strong> 份 Profile</span>
      </div>
    </div>

    <div v-if="loading" class="inline-state" aria-live="polite">
      <span class="spinner" aria-hidden="true"></span>
      <p>正在读取 D1 用户…</p>
    </div>

    <div v-else-if="errorMessage" class="inline-state error-state">
      <span class="state-icon" aria-hidden="true">!</span>
      <p>{{ errorMessage }}</p>
      <button class="button primary" type="button" @click="loadUsers">
        重试
      </button>
    </div>

    <div v-else-if="users.length === 0" class="inline-state">
      <p>目前还没有用户。</p>
    </div>

    <div v-else class="users-table-wrap">
      <table class="users-table">
        <thead>
          <tr>
            <th>用户</th>
            <th>时区</th>
            <th>加入时间</th>
            <th><span class="sr-only">权限</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="listedUser in users" :key="listedUser.id">
            <td data-label="用户">
              <div class="listed-user">
                <img
                  v-if="listedUser.avatarUrl"
                  class="listed-avatar"
                  :src="listedUser.avatarUrl"
                  alt=""
                  referrerpolicy="no-referrer"
                />
                <span v-else class="listed-avatar listed-avatar-fallback">
                  {{ initials(listedUser) }}
                </span>
                <span class="listed-identity">
                  <strong>{{ listedUser.displayName || "未设置姓名" }}</strong>
                  <small>{{ listedUser.email }}</small>
                </span>
              </div>
            </td>
            <td data-label="时区">
              {{ listedUser.timezone || "未设置" }}
            </td>
            <td data-label="加入时间">
              {{ formatDate(listedUser.createdAt) }}
            </td>
            <td data-label="权限" class="role-cell">
              <span v-if="listedUser.isAdmin" class="admin-badge">Admin</span>
              <span v-else class="member-label">Member</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
