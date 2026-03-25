// ─── Framework domain types ───────────────────────────────────────────────────

export type FrameworkSlug =
  | 'pomodoro'
  | 'time_blocking'
  | 'deep_work'
  | 'gtd'
  | 'daily_6'
  | 'eat_the_frog'
  | 'custom'

export type FrameworkState =
  | 'idle'
  | 'active'
  | 'paused'
  | 'completed'
  | 'interrupted'

export type PomodoroPhase = 'work' | 'short_break' | 'long_break'

export interface PomodoroState {
  phase: PomodoroPhase
  /** Elapsed time in milliseconds */
  elapsed: number
  /** Total duration of current phase in milliseconds */
  duration: number
  /** Current interval index (1-based) */
  interval: number
  /** Total intervals before long break (typically 4) */
  totalIntervals: number
}

export interface FrameworkStep {
  id: string
  title: string
  description?: string
  durationMinutes?: number
  isOptional: boolean
  actionType?: 'review' | 'plan' | 'work' | 'reflect' | 'break' | 'capture'
}

export interface FrameworkDefinition {
  slug: FrameworkSlug
  name: string
  description: string
  icon: string
  color: string
  steps: FrameworkStep[]
  defaultDurationMinutes: number
  supportsPomodoro: boolean
}

export interface Framework {
  id: string
  userId: string
  definitionSlug: FrameworkSlug
  name: string
  description?: string
  isCustom: boolean
  config?: CustomFrameworkConfig
  /** ISO-8601 dates for historical tracking */
  lastUsedAt?: string
  useCount: number
  createdAt: string
  updatedAt: string
}

export interface CustomFrameworkConfig {
  steps: FrameworkStep[]
  defaultDurationMinutes: number
  pomodoroWorkMinutes?: number
  pomodoroShortBreakMinutes?: number
  pomodoroLongBreakMinutes?: number
  intervalsBeforeLongBreak?: number
  autoStartBreaks?: boolean
  autoStartWork?: boolean
  notifyOnStepChange?: boolean
}

export interface FrameworkSession {
  id: string
  userId: string
  frameworkId: string
  frameworkSlug: FrameworkSlug
  state: FrameworkState
  currentStepId?: string
  pomodoroState?: PomodoroState
  linkedTaskIds: string[]
  /** ISO-8601 datetime */
  startedAt: string
  /** ISO-8601 datetime */
  pausedAt?: string
  /** ISO-8601 datetime */
  completedAt?: string
  totalPausedMs: number
  notes?: string
  completedIntervals: number
  createdAt: string
  updatedAt: string
}
