<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import type { AppUser, ProfileUpdate } from "../shared/contracts";
import { ApiError, updateProfile } from "./api";
import { formatMemberDate, userInitials } from "./user-format";
import "./styles/profile.css";

const props = defineProps<{ user: AppUser }>();

const currentUser = ref(props.user);
const saving = ref(false);
const successMessage = ref("");
const formError = ref("");
const fieldErrors = reactive<Partial<Record<keyof ProfileUpdate, string>>>({});
const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const form = reactive({
  displayName: props.user.displayName ?? "",
  avatarUrl: props.user.avatarUrl ?? "",
  timezone: props.user.timezone ?? browserTimezone ?? "",
});

const initials = computed(() =>
  userInitials(currentUser.value.displayName, currentUser.value.email),
);
const memberSince = computed(() => formatMemberDate(currentUser.value.createdAt));

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
    currentUser.value = updatedUser;
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

function fillForm(user: AppUser) {
  form.displayName = user.displayName ?? "";
  form.avatarUrl = user.avatarUrl ?? "";
  form.timezone = user.timezone ?? browserTimezone ?? "";
}

function clearFieldErrors() {
  for (const key of Object.keys(fieldErrors) as Array<keyof ProfileUpdate>) {
    delete fieldErrors[key];
  }
}

function useBrowserTimezone() {
  form.timezone = browserTimezone;
}
</script>

<template>
  <section class="hero">
    <p class="eyebrow">PRIVATE FAMILY APP</p>
    <h1>
      Welcome back,
      <span>{{ currentUser.displayName || currentUser.email.split("@")[0] }}</span>
    </h1>
    <p class="hero-copy">
      Cloudflare Access has verified your identity. This profile belongs to the app and does not
      modify your login account.
    </p>
  </section>

  <div class="content-grid">
    <aside class="identity-card">
      <div class="avatar-wrap">
        <img
          v-if="currentUser.avatarUrl"
          class="avatar"
          :src="currentUser.avatarUrl"
          alt=""
          referrerpolicy="no-referrer"
        />
        <div v-else class="avatar avatar-fallback" aria-hidden="true">
          {{ initials }}
        </div>
        <span class="verified-dot" title="Identity verified">✓</span>
      </div>

      <h2>{{ currentUser.displayName || "Name not set" }}</h2>
      <p>{{ currentUser.email }}</p>

      <dl class="identity-meta">
        <div>
          <dt>Identity provider</dt>
          <dd>
            {{
              currentUser.authProvider === "cloudflare-access"
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
          <p v-if="successMessage" class="form-message success" role="status">
            {{ successMessage }}
          </p>
          <p v-else-if="formError" class="form-message error" role="alert">
            {{ formError }}
          </p>
          <span v-else></span>

          <button class="button primary" type="submit" :disabled="saving">
            <span v-if="saving" class="button-spinner" aria-hidden="true"></span>
            {{ saving ? "Saving…" : "Save profile" }}
          </button>
        </div>
      </form>
    </section>
  </div>
</template>
