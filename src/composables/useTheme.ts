// ─── Theme composable ─────────────────────────────────────────────────────────
// Loads/sets themes, applies CSS custom properties to :root, and detects
// system preferences for dark mode and reduced motion.

import { ref, watch, onMounted } from 'vue'
import { usePreferredDark, usePreferredReducedMotion } from '@vueuse/core'
import { useAppStore } from '@/stores/useAppStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import type { ThemeId } from '@/types/settings'

// ─── Theme token map ──────────────────────────────────────────────────────────

interface ThemeTokens {
  '--color-surface-base':    string
  '--color-surface-raised':  string
  '--color-surface-overlay': string
  '--color-surface-sunken':  string
  '--color-surface-border':  string
  '--color-surface-muted':   string
  '--color-text-primary':    string
  '--color-text-secondary':  string
  '--color-text-muted':      string
  '--color-accent':          string
}

const THEME_TOKENS: Record<ThemeId, ThemeTokens> = {
  obsidian: {
    '--color-surface-base':    '#0f0f13',
    '--color-surface-raised':  '#17171e',
    '--color-surface-overlay': '#1e1e28',
    '--color-surface-sunken':  '#0a0a0e',
    '--color-surface-border':  '#2a2a38',
    '--color-surface-muted':   '#3a3a4e',
    '--color-text-primary':    '#f0f0f8',
    '--color-text-secondary':  '#b0b0c8',
    '--color-text-muted':      '#6e6e88',
    '--color-accent':          '#8b5cf6', // violet-500
  },
  midnight: {
    '--color-surface-base':    '#060614',
    '--color-surface-raised':  '#0d0d22',
    '--color-surface-overlay': '#14143a',
    '--color-surface-sunken':  '#03030a',
    '--color-surface-border':  '#1e1e40',
    '--color-surface-muted':   '#2e2e58',
    '--color-text-primary':    '#e8e8ff',
    '--color-text-secondary':  '#9898cc',
    '--color-text-muted':      '#5858aa',
    '--color-accent':          '#6366f1', // indigo-500
  },
  forest: {
    '--color-surface-base':    '#0a110e',
    '--color-surface-raised':  '#121c17',
    '--color-surface-overlay': '#1a2820',
    '--color-surface-sunken':  '#060c09',
    '--color-surface-border':  '#203028',
    '--color-surface-muted':   '#2e4438',
    '--color-text-primary':    '#e8f5ee',
    '--color-text-secondary':  '#8ab89a',
    '--color-text-muted':      '#4e7860',
    '--color-accent':          '#10b981', // emerald-500
  },
  paper: {
    '--color-surface-base':    '#f8f7f4',
    '--color-surface-raised':  '#ffffff',
    '--color-surface-overlay': '#f0ede8',
    '--color-surface-sunken':  '#e8e4dd',
    '--color-surface-border':  '#d4cfc7',
    '--color-surface-muted':   '#b8b3aa',
    '--color-text-primary':    '#1a1814',
    '--color-text-secondary':  '#4a4640',
    '--color-text-muted':      '#8a8680',
    '--color-accent':          '#6366f1', // indigo-500
  },
}

// ─── Composable ───────────────────────────────────────────────────────────────

export function useTheme() {
  const appStore      = useAppStore()
  const settingsStore = useSettingsStore()

  const prefersDark         = usePreferredDark()
  const prefersReducedMotion = usePreferredReducedMotion()

  const currentTheme    = ref<ThemeId>(appStore.theme)
  const reducedMotion   = ref(prefersReducedMotion.value === 'reduce')

  // ── Apply tokens ──────────────────────────────────────────────────────────

  function _applyTokens(theme: ThemeId, accentColor?: string): void {
    const root   = document.documentElement
    const tokens = THEME_TOKENS[theme]

    for (const [prop, value] of Object.entries(tokens)) {
      root.style.setProperty(prop, value)
    }

    // Allow per-user accent override
    if (accentColor) {
      root.style.setProperty('--color-accent', accentColor)
    }
  }

  function _applyMotion(reduced: boolean): void {
    document.documentElement.classList.toggle('reduce-motion', reduced)
    document.documentElement.style.setProperty(
      '--transition-duration',
      reduced ? '0ms' : '200ms',
    )
  }

  // ── Set theme ─────────────────────────────────────────────────────────────

  async function setTheme(theme: ThemeId, persist = true): Promise<void> {
    currentTheme.value = theme
    appStore.setTheme(theme)
    _applyTokens(theme, settingsStore.settings.accentColor)

    if (persist) {
      await settingsStore.updateSettings('local', { theme })
    }
  }

  // ── Load theme ────────────────────────────────────────────────────────────

  function loadTheme(): void {
    // Priority: stored setting > system preference > default
    const stored = settingsStore.settings.theme
    const resolved: ThemeId = stored ?? (prefersDark.value ? 'obsidian' : 'paper')
    void setTheme(resolved, false)

    // Apply reduced motion
    const reduced =
      settingsStore.settings.reducedMotion || prefersReducedMotion.value === 'reduce'
    reducedMotion.value = reduced
    _applyMotion(reduced)
  }

  // ── Watchers ──────────────────────────────────────────────────────────────

  // Sync when OS dark-mode changes (only if user hasn't explicitly chosen a theme)
  watch(prefersDark, (dark) => {
    if (!settingsStore.settings.theme) {
      void setTheme(dark ? 'obsidian' : 'paper', false)
    }
  })

  // Respect OS reduced-motion changes in real-time
  watch(prefersReducedMotion, (val) => {
    if (!settingsStore.settings.reducedMotion) {
      reducedMotion.value = val === 'reduce'
      _applyMotion(val === 'reduce')
    }
  })

  // Apply tokens whenever accentColor setting changes
  watch(
    () => settingsStore.settings.accentColor,
    (accentColor) => {
      _applyTokens(currentTheme.value, accentColor)
    },
  )

  onMounted(() => loadTheme())

  return {
    currentTheme,
    reducedMotion,
    availableThemes: Object.keys(THEME_TOKENS) as ThemeId[],
    setTheme,
    loadTheme,
  }
}
