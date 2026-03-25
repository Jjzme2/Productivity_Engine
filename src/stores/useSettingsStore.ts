// ─── Settings store ───────────────────────────────────────────────────────────

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AppSettings } from '@/types/settings'
import * as tauri from '@/services/tauriClient'

// ─── Default settings ─────────────────────────────────────────────────────────

export const DEFAULT_SETTINGS: AppSettings = {
  theme:                          'obsidian',
  accentColor:                    '#8b5cf6', // violet-500
  preferLocalAi:                  false,
  cloudAiProvider:                'claude',
  voiceProvider:                  'none',
  pomodoroWork:                   25,
  pomodoroShortBreak:             5,
  pomodoroLongBreak:              15,
  pomodoroIntervalsBeforeLongBreak: 4,
  daily6AutoSelect:               false,
  startOnLogin:                   false,
  calendarSyncInterval:           30,
  notificationsEnabled:           true,
  reducedMotion:                  false,
  sidebarCollapsed:               false,
  weekStartsOn:                   1, // Monday
  use24HourClock:                 false,
  dateFormat:                     'MMM d, yyyy',
  timezone:                       Intl.DateTimeFormat().resolvedOptions().timeZone,
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useSettingsStore = defineStore('settings', () => {
  // ── State ──────────────────────────────────────────────────────────────────

  const settings        = ref<AppSettings>({ ...DEFAULT_SETTINGS })
  const apiKeyStatuses  = ref<Record<string, boolean>>({})
  const isLoading       = ref(false)
  const error           = ref<string | null>(null)

  // ── Computed ───────────────────────────────────────────────────────────────

  const isDarkTheme = computed(() =>
    ['obsidian', 'midnight', 'forest'].includes(settings.value.theme),
  )

  const hasCloudAiKey = computed(
    () => apiKeyStatuses.value[settings.value.cloudAiProvider] === true,
  )

  const hasVoiceKey = computed(
    () =>
      settings.value.voiceProvider === 'none' ||
      settings.value.voiceProvider === 'local' ||
      apiKeyStatuses.value['whisper_api'] === true,
  )

  // ── Actions ────────────────────────────────────────────────────────────────

  async function loadSettings(userId: string): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      const loaded = await tauri.loadSettings(userId)
      settings.value = { ...DEFAULT_SETTINGS, ...loaded }
    } catch {
      // Fall back to defaults on first launch or Tauri unavailability
      settings.value = { ...DEFAULT_SETTINGS }
    } finally {
      isLoading.value = false
    }
  }

  async function updateSettings(
    userId: string,
    patch: Partial<AppSettings>,
  ): Promise<void> {
    const previous = { ...settings.value }
    settings.value = { ...settings.value, ...patch }

    try {
      await tauri.saveSettings(userId, patch)
    } catch (err) {
      settings.value = previous
      error.value = err instanceof Error ? err.message : String(err)
      throw err
    }
  }

  async function setApiKey(provider: string, key: string): Promise<void> {
    await tauri.setApiKey(provider, key)
    apiKeyStatuses.value[provider] = true
  }

  async function checkApiKeyStatuses(): Promise<void> {
    try {
      const statuses = await tauri.checkApiKeyStatuses()
      apiKeyStatuses.value = statuses
    } catch {
      // Non-fatal
    }
  }

  async function exportData(userId: string): Promise<string> {
    return tauri.exportData(userId)
  }

  async function importData(
    userId: string,
    json: string,
  ): Promise<{ imported: number; errors: string[] }> {
    return tauri.importData(userId, json)
  }

  return {
    // State
    settings,
    apiKeyStatuses,
    isLoading,
    error,
    // Computed
    isDarkTheme,
    hasCloudAiKey,
    hasVoiceKey,
    // Actions
    loadSettings,
    updateSettings,
    setApiKey,
    checkApiKeyStatuses,
    exportData,
    importData,
  }
})
