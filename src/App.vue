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
      error instanceof Error ? error.message : "Unable to load the current user.";
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
    successMessage.value = "Profile saved.";
  } catch (error) {
    if (error instanceof ApiError) {
      Object.assign(fieldErrors, error.fields);
      formError.value = error.message;
    } else {
      formError.value = "Unable to save. Please try again later.";
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
      <a class="brand" href="/" aria-label="Family Starter home">
        <span class="brand-mark" aria-hidden="true">F</span>
        <span>Family Starter</span>
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

    <main>
      <section v-if="loading" class="state-card" aria-live="polite">
        <span class="spinner" aria-hidden="true"></span>
        <p>Verifying your identity and loading your profile…</p>
      </section>

      <section v-else-if="loadError" class="state-card error-state">
        <span class="state-icon" aria-hidden="true">!</span>
        <h1>Unable to open your profile</h1>
        <p>{{ loadError }}</p>
        <button class="button primary" type="button" @click="load">
          Try again
        </button>
      </section>

      <template v-else-if="user && isAdminPage">
        <section v-if="user.isAdmin" class="hero admin-hero">
          <p class="eyebrow">ADMIN ONLY</p>
          <h1>User management</h1>
          <p class="hero-copy">
            This page lists everyone who has visited the app and received a D1 user record.
            Admin access comes from server configuration and is not stored in user profiles.
          </p>
        </section>

        <AdminUsers v-if="user.isAdmin" />

        <section v-else class="state-card error-state">
          <span class="state-icon" aria-hidden="true">!</span>
          <h1>Access denied</h1>
          <p>This page is available to administrators only.</p>
          <a class="button primary button-link" href="/">Back to profile</a>
        </section>
      </template>

      <template v-else-if="user">
        <section class="hero">
          <p class="eyebrow">PRIVATE FAMILY APP</p>
          <h1>
            Welcome back,
            <span>{{ user.displayName || user.email.split("@")[0] }}</span>
          </h1>
          <p class="hero-copy">
            Cloudflare Access has verified your identity. This profile belongs to the app
            and does not modify your login account.
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
              <span class="verified-dot" title="Identity verified">✓</span>
            </div>

            <h2>{{ user.displayName || "Name not set" }}</h2>
            <p>{{ user.email }}</p>

            <dl class="identity-meta">
              <div>
                <dt>Identity provider</dt>
                <dd>
                  {{
                    user.authProvider === "cloudflare-access"
                      ? "Cloudflare Access"
                      : "Local development identity"
                  }}
                </dd>
              </div>
              <div>
                <dt>Member since</dt>
                <dd>{{ memberSince }}</dd>
              </div>
            </dl>
          </aside>

          <section class="profile-card">
            <div class="section-heading">
              <div>
                <p class="eyebrow">YOUR PROFILE</p>
                <h2>Profile</h2>
              </div>
              <span class="secure-label">
                <span aria-hidden="true">●</span>
                Only you can edit
              </span>
            </div>

            <form @submit.prevent="save">
              <div class="field">
                <label for="display-name">Display name</label>
                <input
                  id="display-name"
                  v-model="form.displayName"
                  name="displayName"
                  type="text"
                  maxlength="80"
                  autocomplete="name"
                  placeholder="What should your family call you?"
                  :aria-invalid="Boolean(fieldErrors.displayName)"
                />
                <p v-if="fieldErrors.displayName" class="field-error">
                  {{ fieldErrors.displayName }}
                </p>
              </div>

              <div class="field">
                <label for="avatar-url">Avatar URL</label>
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
                <p class="field-hint">Leave blank to use your initials.</p>
                <p v-if="fieldErrors.avatarUrl" class="field-error">
                  {{ fieldErrors.avatarUrl }}
                </p>
              </div>

              <div class="field">
                <div class="label-row">
                  <label for="timezone">Timezone</label>
                  <button
                    v-if="browserTimezone"
                    class="text-button"
                    type="button"
                    @click="useBrowserTimezone"
                  >
                    Use current timezone
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
                  {{ saving ? "Saving…" : "Save profile" }}
                </button>
              </div>
            </form>
          </section>
        </div>
      </template>
    </main>

    <footer>
      Cloudflare Workers | Access | D1
    </footer>
  </div>
</template>
