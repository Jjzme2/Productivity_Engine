// ─── Habit domain types ───────────────────────────────────────────────────────

export type HabitFrequency = 'daily' | 'weekly' | 'weekdays' | 'weekends' | 'custom'

export type HabitStatus = 'active' | 'paused' | 'archived'

export type HabitCategory =
  | 'health'
  | 'fitness'
  | 'mindfulness'
  | 'learning'
  | 'productivity'
  | 'social'
  | 'finance'
  | 'creativity'
  | 'other'

export interface Habit {
  id: string
  userId: string
  title: string
  description?: string
  icon?: string
  color?: string
  frequency: HabitFrequency
  /** For custom frequency — days of week (0=Sun … 6=Sat) */
  customDays?: number[]
  /** Target count per occurrence (e.g. 8 glasses of water) */
  targetCount: number
  unit?: string
  reminderTime?: string
  status: HabitStatus
  category: HabitCategory
  /** ISO-8601 date string */
  startDate: string
  endDate?: string
  linkedTaskIds: string[]
  createdAt: string
  updatedAt: string
  isArchived: boolean
}

export interface HabitEntry {
  id: string
  habitId: string
  userId: string
  /** ISO-8601 date string (YYYY-MM-DD) */
  date: string
  /** How many times completed that day */
  count: number
  /** Whether the target was met */
  completed: boolean
  note?: string
  createdAt: string
}

export interface StreakData {
  current: number
  longest: number
  /** ISO-8601 date string or null if never checked */
  lastChecked: string | null
}

export interface HabitWithStreak extends Habit {
  streak: StreakData
  todayEntry?: HabitEntry
  completionRate7d: number
  completionRate30d: number
}

export interface CreateHabitPayload {
  title: string
  description?: string
  icon?: string
  color?: string
  frequency: HabitFrequency
  customDays?: number[]
  targetCount?: number
  unit?: string
  reminderTime?: string
  category: HabitCategory
  startDate?: string
  endDate?: string
}

export interface UpdateHabitPayload {
  id: string
  title?: string
  description?: string
  icon?: string
  color?: string
  frequency?: HabitFrequency
  customDays?: number[]
  targetCount?: number
  unit?: string
  reminderTime?: string
  status?: HabitStatus
  category?: HabitCategory
  endDate?: string
  isArchived?: boolean
}
