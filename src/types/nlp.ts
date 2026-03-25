// ─── NLP / AI domain types ────────────────────────────────────────────────────

export type IntentAction =
  | 'create_task'
  | 'update_task'
  | 'delete_task'
  | 'complete_task'
  | 'create_habit'
  | 'check_habit'
  | 'create_note'
  | 'create_event'
  | 'start_framework'
  | 'stop_framework'
  | 'start_pomodoro'
  | 'get_summary'
  | 'search'
  | 'navigate'
  | 'unknown'

export interface IntentEntities {
  title?: string
  description?: string
  priority?: string
  dueDate?: string
  tags?: string[]
  taskId?: string
  habitId?: string
  noteId?: string
  eventId?: string
  frameworkSlug?: string
  startTime?: string
  endTime?: string
  duration?: string
  recurrence?: string
  query?: string
  view?: string
  raw?: Record<string, unknown>
}

export interface ParsedIntent {
  action: IntentAction
  entities: IntentEntities
  /** Confidence score 0–1 */
  confidence: number
  /** Raw user input */
  rawInput: string
  /** Human-readable interpretation string */
  interpretation: string
  /** Whether this intent modifies or deletes data */
  isDestructive: boolean
  /** Model used for parsing */
  modelUsed?: string
  /** Parse latency in ms */
  latencyMs?: number
}

export interface ExecutionResult {
  success: boolean
  action: IntentAction
  entityId?: string
  entityType?: string
  message: string
  /** Any data returned from the execution */
  data?: unknown
  error?: string
}

export interface SuggestionContext {
  recentTasks: Array<{ id: string; title: string }>
  recentHabits: Array<{ id: string; title: string }>
  currentView: string
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night'
  pendingTasks: number
  pendingHabits: number
}

export interface UserContext {
  userId: string
  currentView: string
  openTasks: number
  overdueTaskIds: string[]
  recentTaskTitles: string[]
  pendingHabitIds: string[]
  activeFrameworkSlug?: string
  preferences: {
    preferLocalAi: boolean
    cloudAiProvider: string
  }
}

export interface DailyBrief {
  greeting: string
  date: string
  topTasks: Array<{ id: string; title: string; priority: string }>
  habitsDue: Array<{ id: string; title: string }>
  upcomingEvents: Array<{ id: string; title: string; startTime: string }>
  suggestion: string
  productivityScore?: number
  motivationalQuote?: string
}

export interface AiProviderStatus {
  provider: string
  isLocal: boolean
  isAvailable: boolean
  model: string
  latencyMs?: number
  errorMessage?: string
}
