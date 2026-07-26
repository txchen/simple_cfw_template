<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import type { AppUser, ProfileUpdate } from "../shared/contracts";
import AdminUsers from "./AdminUsers.vue";
import { ApiError, getCurrentUser, updateProfile } from "./api";

const user = ref<AppUser | null>(null);
const loading = ref(true);
const saving = ref(false);
const loadError = ref("");
const successMessage = ref("");
const formError = ref("");
const fieldErrors = reactive<Partial<Record<keyof ProfileUpdate, string>>>({});

const form = reactive({
  displayName: "",
  avatarUrl: "",
  timezone: "",
});

const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const isAdminPage = window.location.pathname === "/admin";

const initials = computed(() => {
  const source = user.value?.displayName || user.value?.email || "?";
  return source
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
});

const memberSince = computed(() => {
  if (!user.value) return "";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(user.value.createdAt));
});

function fillForm(currentUser: AppUser) {
  form.displayName = currentUser.displayName ?? "";
  form.avatarUrl = currentUser.avatarUrl ?? "";
  form.timezone = currentUser.timezone ?? browserTimezone ?? "";
}

async function load() {
  loading.value = true;
  loadError.value = "";
  try {
    const currentUser = await getCurrentUser();
    user.value = currentUser;
    fillForm(currentUser);
  } catch (error) {
    loadError.value =
      error instanceof Error ? error.message : "无法加载当前用户。";
  } finally {
    loading.value = false;
  }
}

async function save() {
  saving.value = true;
  formError.value = "";
  successMessage.value = "";
  clearFieldErrors();

  try {
    const updatedUser = await updateProfile({
      displayName: form.displayName || null,
      avatarUrl: form.avatarUrl || null,
      timezone: form.timezone || null,
    });
    user.value = updatedUser;
    fillForm(updatedUser);
    successMessage.value = "Profile 已保存。";
  } catch (error) {
    if (error instanceof ApiError) {
      Object.assign(fieldErrors, error.fields);
      formError.value = error.message;
    } else {
      formError.value = "保存失败，请稍后再试。";
    }
  } finally {
    saving.value = false;
  }
}

function clearFieldErrors() {
  for (const key of Object.keys(fieldErrors) as Array<keyof ProfileUpdate>) {
    delete fieldErrors[key];
  }
}

function useBrowserTimezone() {
  form.timezone = browserTimezone;
}

onMounted(load);
</script>

<template>
  <div class="app-shell">
    <header class="site-header">
      <a class="brand" href="/" aria-label="Family Starter 首页">
        <span class="brand-mark" aria-hidden="true">F</span>
        <span>Family Starter</span>
      </a>

      <div v-if="user" class="header-user">
        <nav v-if="user.isAdmin" class="header-nav" aria-label="管理导航">
          <a v-if="isAdminPage" href="/">返回 Profile</a>
          <a v-else href="/admin">管理用户</a>
        </nav>
        <span class="header-email">{{ user.email }}</span>
        <a
          v-if="user.authProvider === 'cloudflare-access'"
          class="logout-link"
          href="/cdn-cgi/access/logout"
        >
          退出
        </a>
        <span v-else class="dev-badge">Local dev</span>
      </div>
    </header>

    <main>
      <section v-if="loading" class="state-card" aria-live="polite">
        <span class="spinner" aria-hidden="true"></span>
        <p>正在确认身份并加载 Profile…</p>
      </section>

      <section v-else-if="loadError" class="state-card error-state">
        <span class="state-icon" aria-hidden="true">!</span>
        <h1>暂时无法打开 Profile</h1>
        <p>{{ loadError }}</p>
        <button class="button primary" type="button" @click="load">
          重试
        </button>
      </section>

      <template v-else-if="user && isAdminPage">
        <section v-if="user.isAdmin" class="hero admin-hero">
          <p class="eyebrow">ADMIN ONLY</p>
          <h1>用户管理</h1>
          <p class="hero-copy">
            这里列出所有曾经进入过应用并在 D1 建档的用户。
            Admin 权限来自服务器配置，不保存在用户 Profile 中。
          </p>
        </section>

        <AdminUsers v-if="user.isAdmin" />

        <section v-else class="state-card error-state">
          <span class="state-icon" aria-hidden="true">!</span>
          <h1>无权访问</h1>
          <p>这个页面只允许管理员访问。</p>
          <a class="button primary button-link" href="/">返回 Profile</a>
        </section>
      </template>

      <template v-else-if="user">
        <section class="hero">
          <p class="eyebrow">PRIVATE FAMILY APP</p>
          <h1>
            欢迎回来，
            <span>{{ user.displayName || user.email.split("@")[0] }}</span>
          </h1>
          <p class="hero-copy">
            Cloudflare Access 已确认你的身份。这里保存的是应用自己的个人资料，
            不会修改你的登录账号。
          </p>
        </section>

        <div class="content-grid">
          <aside class="identity-card">
            <div class="avatar-wrap">
              <img
                v-if="user.avatarUrl"
                class="avatar"
                :src="user.avatarUrl"
                alt=""
                referrerpolicy="no-referrer"
              />
              <div v-else class="avatar avatar-fallback" aria-hidden="true">
                {{ initials }}
              </div>
              <span class="verified-dot" title="身份已验证">✓</span>
            </div>

            <h2>{{ user.displayName || "未设置姓名" }}</h2>
            <p>{{ user.email }}</p>

            <dl class="identity-meta">
              <div>
                <dt>身份来源</dt>
                <dd>
                  {{
                    user.authProvider === "cloudflare-access"
                      ? "Cloudflare Access"
                      : "本地开发身份"
                  }}
                </dd>
              </div>
              <div>
                <dt>加入时间</dt>
                <dd>{{ memberSince }}</dd>
              </div>
            </dl>
          </aside>

          <section class="profile-card">
            <div class="section-heading">
              <div>
                <p class="eyebrow">YOUR PROFILE</p>
                <h2>个人资料</h2>
              </div>
              <span class="secure-label">
                <span aria-hidden="true">●</span>
                仅你可编辑
              </span>
            </div>

            <form @submit.prevent="save">
              <div class="field">
                <label for="display-name">显示名称</label>
                <input
                  id="display-name"
                  v-model="form.displayName"
                  name="displayName"
                  type="text"
                  maxlength="80"
                  autocomplete="name"
                  placeholder="家人怎么称呼你？"
                  :aria-invalid="Boolean(fieldErrors.displayName)"
                />
                <p v-if="fieldErrors.displayName" class="field-error">
                  {{ fieldErrors.displayName }}
                </p>
              </div>

              <div class="field">
                <label for="avatar-url">头像网址</label>
                <input
                  id="avatar-url"
                  v-model="form.avatarUrl"
                  name="avatarUrl"
                  type="url"
                  maxlength="500"
                  inputmode="url"
                  placeholder="https://example.com/avatar.jpg"
                  :aria-invalid="Boolean(fieldErrors.avatarUrl)"
                />
                <p class="field-hint">留空会使用姓名首字母。</p>
                <p v-if="fieldErrors.avatarUrl" class="field-error">
                  {{ fieldErrors.avatarUrl }}
                </p>
              </div>

              <div class="field">
                <div class="label-row">
                  <label for="timezone">时区</label>
                  <button
                    v-if="browserTimezone"
                    class="text-button"
                    type="button"
                    @click="useBrowserTimezone"
                  >
                    使用当前时区
                  </button>
                </div>
                <input
                  id="timezone"
                  v-model="form.timezone"
                  name="timezone"
                  type="text"
                  maxlength="100"
                  placeholder="America/Los_Angeles"
                  :aria-invalid="Boolean(fieldErrors.timezone)"
                />
                <p v-if="fieldErrors.timezone" class="field-error">
                  {{ fieldErrors.timezone }}
                </p>
              </div>

              <div class="form-footer">
                <p
                  v-if="successMessage"
                  class="form-message success"
                  role="status"
                >
                  {{ successMessage }}
                </p>
                <p v-else-if="formError" class="form-message error" role="alert">
                  {{ formError }}
                </p>
                <span v-else></span>

                <button
                  class="button primary"
                  type="submit"
                  :disabled="saving"
                >
                  <span v-if="saving" class="button-spinner" aria-hidden="true"></span>
                  {{ saving ? "保存中…" : "保存 Profile" }}
                </button>
              </div>
            </form>
          </section>
        </div>
      </template>
    </main>

    <footer>
      Cloudflare Workers · Access · D1
    </footer>
  </div>
</template>
