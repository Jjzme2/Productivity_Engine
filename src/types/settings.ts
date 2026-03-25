// ─── Settings domain types ────────────────────────────────────────────────────

export type ThemeId = 'obsidian' | 'paper' | 'forest' | 'midnight'

export type CloudAiProvider = 'claude' | 'openai' | 'gemini'

export type VoiceProvider = 'local' | 'whisper_api' | 'none'

export interface AppSettings {
  /** Visual theme */
  theme: ThemeId
  /** Custom accent color (hex or CSS variable name) */
  accentColor: string
  /** Prefer on-device LLM over cloud when available */
  preferLocalAi: boolean
  /** Cloud AI fallback provider */
  cloudAiProvider: CloudAiProvider
  /** Speech-to-text provider */
  voiceProvider: VoiceProvider
  /** Pomodoro work phase duration in minutes */
  pomodoroWork: number
  /** Pomodoro short break duration in minutes */
  pomodoroShortBreak: number
  /** Pomodoro long break duration in minutes */
  pomodoroLongBreak: number
  /** Number of pomodoro intervals before a long break */
  pomodoroIntervalsBeforeLongBreak: number
  /** Auto-start daily 6 task selection each morning */
  daily6AutoSelect: boolean
  /** Launch on OS login via autostart plugin */
  startOnLogin: boolean
  /** Google Calendar sync interval in minutes (0 = manual only) */
  calendarSyncInterval: number
  /** Enable desktop notifications */
  notificationsEnabled: boolean
  /** Honor prefers-reduced-motion */
  reducedMotion: boolean
  /** Sidebar default collapsed */
  sidebarCollapsed: boolean
  /** First day of week (0=Sun, 1=Mon) */
  weekStartsOn: 0 | 1
  /** 24-hour clock display */
  use24HourClock: boolean
  /** Date format string (date-fns compatible) */
  dateFormat: string
  /** User display name */
  displayName?: string
  /** User timezone (IANA) */
  timezone: string
}

export interface ApiKeyEntry {
  provider: string
  isSet: boolean
  /** Obfuscated hint like "sk-...abc" */
  hint?: string
}
