<template>
  <div
    id="app-root"
    :class="[
      'min-h-screen font-sans antialiased flex flex-col',
      'bg-[var(--color-surface-base)] text-[var(--color-text-primary)]',
      { 'reduce-motion': reducedMotion },
    ]"
  >
    <Titlebar />

    <!--
      AppShell provides:
      - Sidebar navigation
      - Top bar with command bar trigger
      - Main content slot
    -->
    <div class="flex-1 w-full relative flex flex-col overflow-hidden">
      <RouterView v-slot="{ Component, route }">
        <Transition
          :name="reducedMotion ? '' : 'fade'"
          mode="out-in"
          appear
        >
          <component
            :is="Component"
            :key="route.fullPath"
          />
        </Transition>
      </RouterView>
    </div>

    <!-- ── Debug error overlay ──────────────────────────────────────────── -->
    <ErrorOverlay />

    <!-- ── Global toast outlet ──────────────────────────────────────────── -->
    <Teleport to="body">
      <div
        aria-live="polite"
        aria-atomic="false"
        class="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none"
      >
        <TransitionGroup
          :name="reducedMotion ? '' : 'toast'"
          tag="div"
          class="flex flex-col gap-3"
        >
          <div
            v-for="toast in toasts"
            :key="toast.id"
            :class="[
              'pointer-events-auto flex items-start gap-3',
              'rounded-xl px-4 py-3 shadow-card min-w-[280px] max-w-[400px]',
              'border backdrop-blur-sm',
              toastClasses[toast.variant],
            ]"
            role="alert"
          >
            <!-- Icon -->
            <span class="text-lg mt-0.5 shrink-0" aria-hidden="true">
              {{ toastIcons[toast.variant] }}
            </span>

            <!-- Content -->
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold leading-snug">{{ toast.title }}</p>
              <p
                v-if="toast.message"
                class="text-xs mt-0.5 opacity-80 leading-relaxed"
              >
                {{ toast.message }}
              </p>
              <button
                v-if="toast.action"
                class="text-xs mt-1.5 font-medium underline underline-offset-2 hover:opacity-100 opacity-80"
                @click="toast.action?.handler()"
              >
                {{ toast.action.label }}
              </button>
            </div>

            <!-- Dismiss button -->
            <button
              class="shrink-0 opacity-50 hover:opacity-100 transition-opacity text-sm"
              :aria-label="`Dismiss: ${toast.title}`"
              @click="clearToast(toast.id)"
            >
              ✕
            </button>
          </div>
        </TransitionGroup>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { RouterView } from 'vue-router'
import Titlebar from '@/components/layout/Titlebar.vue'
import ErrorOverlay from '@/components/debug/ErrorOverlay.vue'
import { useAppStore } from '@/stores/useAppStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { useSyncStore } from '@/stores/useSyncStore'
import { useTheme } from '@/composables/useTheme'
import { useShortcuts } from '@/composables/useShortcuts'
import type { ToastVariant } from '@/stores/useAppStore'
import { firebaseEnabled } from '@/services/firebase'
import { createLogger } from '@/services/useLogger'
import { updateSettings } from '@/services/tauriClient'

import { useTaskStore } from '@/stores/useTaskStore'
import { useHabitStore } from '@/stores/useHabitStore'
import { useCalendarStore } from '@/stores/useCalendarStore'
import { useNoteStore } from '@/stores/useNoteStore'
import { useFinanceStore } from '@/stores/finance'
import { useImportantDatesStore } from '@/stores/dates'
import { useFrameworkStore } from '@/stores/useFrameworkStore'

const log = createLogger('App')

// ── Stores ───────────────────────────────────────────────────────────────────

const appStore      = useAppStore()
const authStore     = useAuthStore()
const settingsStore = useSettingsStore()
const syncStore     = useSyncStore()

const taskStore = useTaskStore()
const habitStore = useHabitStore()
const calendarStore = useCalendarStore()
const noteStore = useNoteStore()
const financeStore = useFinanceStore()
const datesStore = useImportantDatesStore()
const frameworkStore = useFrameworkStore()

// ── Theme & shortcuts (global, app-level) ─────────────────────────────────────

const { reducedMotion, loadTheme } = useTheme()
useShortcuts()

// ── Toast bindings ────────────────────────────────────────────────────────────

const toasts    = computed(() => appStore.toasts)
const clearToast = appStore.clearToast

const toastClasses: Record<ToastVariant, string> = {
  success: 'bg-success-950/90 border-success-800 text-success-100',
  error:   'bg-danger-950/90  border-danger-800  text-danger-100',
  warning: 'bg-warning-950/90 border-warning-800 text-warning-100',
  info:    'bg-primary-950/90 border-primary-800 text-primary-100',
}

const toastIcons: Record<ToastVariant, string> = {
  success: '✓',
  error:   '✕',
  warning: '⚠',
  info:    'ℹ',
}

// ── Initialise ────────────────────────────────────────────────────────────────

onMounted(async () => {
  log.info('App boot started')

  // Wait for Firebase Auth to resolve the initial auth state.
  // This must happen before any Firestore load so we have the UID.
  // Auth is already initialised in main.ts before mount — skip re-init.

  // Load persisted settings (best-effort — falls back to defaults)
  await settingsStore.loadSettings('local')
  loadTheme()

  // Inject Google OAuth credentials into Rust settings.
  // Client ID is public metadata (safe in VITE_); secret is read from Rust env.
  const gcid = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim()
  let gcsec: string | undefined
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    gcsec = (await invoke<string | null>('read_secret_env', { name: 'GOOGLE_CLIENT_SECRET' })) ?? undefined
  } catch { /* Tauri not available — ignore */ }

  if (gcid || gcsec) {
    updateSettings({
      ...(gcid  ? { google_client_id:     gcid  } : {}),
      ...(gcsec ? { google_client_secret: gcsec } : {}),
    }).catch(() => {})
  }

  // Apply persisted UI preferences from settings
  if (settingsStore.settings.sidebarCollapsed !== undefined) {
    appStore.setSidebarCollapsed(settingsStore.settings.sidebarCollapsed)
  }

  // Start connectivity watcher + auto-flush on reconnect
  syncStore.init()

  // ── Firebase status toast ────────────────────────────────────────────────
  if (firebaseEnabled) {
    log.info('Cloud sync is active')
    appStore.addToast({ message: 'Cloud Sync Active', variant: 'success' })
  } else {
    log.warn('Firebase not connected — running in local-only mode')
    appStore.addToast({
      message: 'Local-Only Mode — Firebase is not configured. Data is saved locally only.',
      variant: 'warning',
    })
  }

  appStore.markInitialised()

  const userId = authStore.uid
  log.info('Loading all stores', { userId })
  taskStore.loadTasks(userId)
  habitStore.loadHabits(userId)
  calendarStore.loadEvents(userId)
  noteStore.loadNotes(userId)
  financeStore.loadData(userId)
  datesStore.loadData(userId)
  frameworkStore.loadFrameworks(userId)

  // Persist sidebar preference whenever it changes
  watch(
    () => appStore.isSidebarCollapsed,
    (collapsed) => {
      settingsStore.updateSettings('local', { sidebarCollapsed: collapsed }).catch(() => {})
    },
  )

  log.info('App boot complete')
})
</script>

<style>
/* ── Page transition ───────────────────────────────────────────────────────── */
.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--transition-duration, 200ms) ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* ── Toast transition ─────────────────────────────────────────────────────── */
.toast-enter-active {
  transition: all 0.25s ease-out;
}
.toast-leave-active {
  transition: all 0.2s ease-in;
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(24px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(24px);
}
.toast-move {
  transition: transform 0.2s ease;
}

/* ── Reduce motion overrides ──────────────────────────────────────────────── */
.reduce-motion *,
.reduce-motion *::before,
.reduce-motion *::after {
  animation-duration: 0.001ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.001ms !important;
}
</style>
