// ─── Global application state ─────────────────────────────────────────────────

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { nanoid } from 'nanoid'
import type { ThemeId } from '@/types/settings'

// ─── Toast type ───────────────────────────────────────────────────────────────

export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  title: string
  message?: string
  variant: ToastVariant
  durationMs: number
  action?: {
    label: string
    handler: () => void
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAppStore = defineStore('app', () => {
  // ── State ──────────────────────────────────────────────────────────────────

  const isLoading          = ref(false)
  const error              = ref<string | null>(null)
  const theme              = ref<ThemeId>('obsidian')
  const isSidebarCollapsed = ref(false)
  const isFocusMode        = ref(false)
  const commandBarOpen     = ref(false)
  const activeView         = ref('dashboard')
  const toasts             = ref<Toast[]>([])
  const isInitialised      = ref(false)
  const aiProvider         = ref<'claude' | 'ollama' | 'openai' | 'gemini'>('claude')
  const ollamaModel        = ref<string>('llama3')
  const aiProviderMode     = ref<'local_first' | 'cloud_first'>('local_first')
  const calendarConnected  = ref(false)
  const lastCalendarSync   = ref<string | null>(null)
  const calendarSyncState  = ref<'idle' | 'syncing' | 'error' | 'unauthorized'>('unauthorized')

  // ── Aliases for layout components (use the same backing refs) ──────────────
  const sidebarCollapsed = isSidebarCollapsed
  const focusMode        = isFocusMode

  // ── Computed ───────────────────────────────────────────────────────────────

  const hasError = computed(() => error.value !== null)

  // ── Actions ────────────────────────────────────────────────────────────────

  function setTheme(newTheme: ThemeId) {
    theme.value = newTheme
    document.documentElement.setAttribute('data-theme', newTheme)
    const darkThemes: ThemeId[] = ['obsidian', 'midnight', 'forest']
    document.documentElement.classList.toggle('dark', darkThemes.includes(newTheme))
  }

  function toggleSidebar() {
    isSidebarCollapsed.value = !isSidebarCollapsed.value
  }

  function setSidebarCollapsed(value: boolean) {
    isSidebarCollapsed.value = value
  }

  function toggleFocusMode() {
    isFocusMode.value = !isFocusMode.value
    if (isFocusMode.value) isSidebarCollapsed.value = true
  }

  function enterFocusMode() {
    isFocusMode.value = true
    isSidebarCollapsed.value = true
  }

  function exitFocusMode() {
    isFocusMode.value = false
  }

  function openCommandBar() {
    commandBarOpen.value = true
  }

  function closeCommandBar() {
    commandBarOpen.value = false
  }

  function setActiveView(view: string) {
    activeView.value = view
  }

  function setLoading(value: boolean) {
    isLoading.value = value
  }

  function setError(msg: string | null) {
    error.value = msg
  }

  function clearError() {
    error.value = null
  }

  function showToast(options: Omit<Toast, 'id' | 'durationMs'> & { durationMs?: number }): string {
    const id = nanoid(8)
    const duration = options.durationMs ?? 4000
    toasts.value.push({ ...options, id, durationMs: duration })
    if (duration > 0) setTimeout(() => clearToast(id), duration)
    return id
  }

  function clearToast(id: string) {
    const idx = toasts.value.findIndex((t) => t.id === id)
    if (idx !== -1) toasts.value.splice(idx, 1)
  }

  // Alias used by older layout components
  const removeToast = clearToast

  /** Compatibility alias: views call addToast({ message, variant }) */
  function addToast(opts: { message: string; variant: ToastVariant; durationMs?: number }): string {
    const payload: Omit<Toast, 'id' | 'durationMs'> & { durationMs?: number } = { title: opts.message, variant: opts.variant }
    if (opts.durationMs !== undefined) payload.durationMs = opts.durationMs
    return showToast(payload)
  }

  function clearAllToasts() {
    toasts.value = []
  }

  function markInitialised() {
    isInitialised.value = true
  }

  return {
    // State
    isLoading,
    error,
    theme,
    aiProvider,
    ollamaModel,
    aiProviderMode,
    calendarConnected,
    lastCalendarSync,
    calendarSyncState,
    isSidebarCollapsed,
    sidebarCollapsed,
    isFocusMode,
    focusMode,
    commandBarOpen,
    activeView,
    toasts,
    activeToasts: toasts,
    isInitialised,
    // Computed
    hasError,
    // Actions
    setTheme,
    toggleSidebar,
    setSidebarCollapsed,
    toggleFocusMode,
    enterFocusMode,
    exitFocusMode,
    openCommandBar,
    closeCommandBar,
    setActiveView,
    setLoading,
    setError,
    clearError,
    showToast,
    clearToast,
    removeToast,
    addToast,
    clearAllToasts,
    markInitialised,
  }
})
