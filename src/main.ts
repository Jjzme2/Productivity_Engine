// ─── Application entry point ──────────────────────────────────────────────────
// Extend the global Window interface to include the pre-render error helper
declare global {
  interface Window {
    __clearPreRenderErrors?: () => void
  }
}

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from '@/router'
import App from '@/App.vue'

// Initialise Firebase (side-effect: establishes Firestore connection)
import '@/services/firebase'

// Global styles — Tailwind base + custom CSS variables
import './assets/main.css'

// Error reporting — must be imported before app creation
import { installGlobalErrorHandlers, reportError } from '@/services/errorReporter'

// ─── Bootstrap ────────────────────────────────────────────────────────────────

// Capture window.onerror + unhandledrejection before any other code runs
installGlobalErrorHandlers()

const app = createApp(App)

// Vue component error handler — catches errors thrown inside component lifecycle
// hooks, watchers, and event handlers
app.config.errorHandler = (err, instance, info) => {
  const source = instance?.$options?.name ?? info ?? 'vue'
  reportError(err, source)
  // Re-log to console so it still appears in any attached DevTools
  console.error(`[Vue error in ${source}]`, err)
}

// ── Pinia ──────────────────────────────────────────────────────────────────────
const pinia = createPinia()
app.use(pinia)

// ── Auth (must run before router so the navigation guard has the correct state)
// With Firebase: awaits the initial onAuthStateChanged callback (~200ms).
// Without Firebase: resolves immediately (auth is null).
import('@/stores/useAuthStore').then(async ({ useAuthStore }) => {
  const authStore = useAuthStore()
  try {
    await authStore.init()
  } catch {
    // Auth init failed — app continues in local-only mode
  }

  // ── Router ──────────────────────────────────────────────────────────────────
  app.use(router)

  // ── Mount ────────────────────────────────────────────────────────────────────
  app.mount('#app')

  // Signal to the pre-render error container that Vue mounted successfully
  if (typeof window.__clearPreRenderErrors === 'function') {
    window.__clearPreRenderErrors()
  }
}).catch((err) => {
  // Module load failure — Vue never mounts, the pre-render error div shows it
  console.error('Fatal: failed to initialise app', err)
})
