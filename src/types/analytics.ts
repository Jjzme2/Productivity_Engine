// ─── Analytics domain types ───────────────────────────────────────────────────

export type ShortcomingSeverity = 'low' | 'medium' | 'high'

export type ActivityEventType =
  | 'task_created'
  | 'task_completed'
  | 'task_updated'
  | 'habit_checked'
  | 'note_created'
  | 'framework_started'
  | 'framework_completed'
  | 'pomodoro_completed'
  | 'ai_command_used'

export interface ShortcomingItem {
  id: string
  title: string
  description: string
  severity: ShortcomingSeverity
  /** e.g. 'procrastination', 'overcommitment', 'planning', 'consistency' */
  category: string
  suggestions: string[]
  /** ISO-8601 datetime */
  identifiedAt: string
  isResolved: boolean
  resolvedAt?: string
}

export interface StrengthItem {
  id: string
  title: string
  description: string
  category: string
  /** ISO-8601 datetime */
  identifiedAt: string
}

export interface Suggestion {
  id: string
  title: string
  description: string
  actionType: 'create_task' | 'reschedule' | 'delegate' | 'focus_session' | 'habit_reminder' | 'custom'
  priority: number
  relatedEntityId?: string
  relatedEntityType?: string
  expiresAt?: string
  createdAt: string
}

export interface ProductivityScore {
  /** ISO-8601 date string for the start of the week */
  weekStart: string
  overall: number
  taskCompletion: number
  habitConsistency: number
  focusTime: number
  planningQuality: number
  /** 0–100 */
  score: number
}

export interface TimeOfDayHeatmap {
  /** Hour of day (0–23) */
  hour: number
  /** Day of week (0=Sun … 6=Sat) */
  dayOfWeek: number
  /** Number of productive events in this slot */
  activityCount: number
  /** Normalized intensity 0–1 */
  intensity: number
}

export interface ActivityEvent {
  id: string
  userId: string
  type: ActivityEventType
  entityId?: string
  entityType?: string
  metadata?: Record<string, unknown>
  /** ISO-8601 datetime */
  timestamp: string
}

export interface AnalyticsStats {
  tasksCompletedToday: number
  tasksCompletedThisWeek: number
  habitsCheckedToday: number
  habitStreakAverage: number
  focusMinutesToday: number
  focusMinutesThisWeek: number
  pomodorosToday: number
  currentProductivityScore: number
}

export interface UserInsights {
  userId: string
  shortcomings: ShortcomingItem[]
  strengths: StrengthItem[]
  suggestions: Suggestion[]
  stats: AnalyticsStats
  heatmap: TimeOfDayHeatmap[]
  /** ISO-8601 datetime of last AI analysis */
  lastAnalyzedAt: string
  analysisVersion: string
}

export interface WeeklySummary {
  id: string
  userId: string
  weekStart: string
  weekEnd: string
  score: ProductivityScore
  shortcomings: ShortcomingItem[]
  strengths: StrengthItem[]
  highlights: string[]
  /** AI-generated narrative summary */
  narrative: string
  createdAt: string
}
