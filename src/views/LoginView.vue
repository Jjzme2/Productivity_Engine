<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/useAuthStore'
import BaseButton from '@/components/shared/BaseButton.vue'

const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

async function handleLogin() {
  if (!email.value || !password.value) {
    error.value = 'Please enter your email and password.'
    return
  }
  loading.value = true
  error.value = ''

  try {
    await authStore.login(email.value, password.value)
    router.push('/')
  } catch {
    error.value = authStore.authError ?? 'Login failed. Please try again.'
  } finally {
    loading.value = false
  }
}

async function handleGuestMode() {
  loading.value = true
  error.value = ''

  try {
    await authStore.loginAsGuest()
    router.push('/')
  } catch {
    error.value = authStore.authError ?? 'Guest login failed.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
    <div class="w-full max-w-sm space-y-6">

      <!-- Logo / brand -->
      <div class="text-center space-y-2">
        <div class="w-12 h-12 mx-auto rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
          <svg class="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <h1 class="text-xl font-bold text-zinc-100">Productivity Engine</h1>
        <p class="text-sm text-zinc-500">Sign in to your account</p>
      </div>

      <!-- Form -->
      <div class="bg-zinc-900 border border-zinc-800/50 rounded-2xl p-6 space-y-4">
        <div>
          <label class="text-xs font-medium text-zinc-400 mb-1 block">Email</label>
          <input
            id="login-email"
            v-model="email"
            type="email"
            placeholder="you@example.com"
            class="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            @keydown.enter="handleLogin"
          />
        </div>
        <div>
          <label class="text-xs font-medium text-zinc-400 mb-1 block">Password</label>
          <input
            id="login-password"
            v-model="password"
            type="password"
            placeholder="••••••••"
            class="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            @keydown.enter="handleLogin"
          />
        </div>

        <p v-if="error" class="text-xs text-rose-400">{{ error }}</p>

        <BaseButton
          id="login-submit"
          variant="primary"
          class="w-full justify-center"
          :disabled="loading"
          @click="handleLogin"
        >
          <svg v-if="loading" class="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {{ loading ? 'Signing in…' : 'Sign in' }}
        </BaseButton>

        <div class="relative flex items-center gap-2 py-1">
          <div class="flex-1 h-px bg-zinc-800" />
          <span class="text-xs text-zinc-600">or</span>
          <div class="flex-1 h-px bg-zinc-800" />
        </div>

        <BaseButton id="login-guest" variant="ghost" class="w-full justify-center" @click="handleGuestMode">
          Continue as guest
        </BaseButton>
      </div>

      <p class="text-center text-xs text-zinc-700">
        Data stored locally when offline. Sign in to enable cloud sync.
      </p>
    </div>
  </div>
</template>
