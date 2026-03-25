// ─── Important Dates domain types ────────────────────────────────────────────

export type DateCategory =
  | 'birthday'
  | 'anniversary'
  | 'deadline'
  | 'holiday'
  | 'appointment'
  | 'reminder'
  | 'custom'

export type RecurrenceType = 'none' | 'yearly' | 'monthly' | 'weekly'

export interface ImportantDate {
  id: string
  userId: string
  title: string
  /** Original or next occurrence date — YYYY-MM-DD */
  date: string
  category: DateCategory
  recurrence: RecurrenceType
  notes?: string
  color?: string
  /** 0 = notify day-of, 1 = 1 day before, etc. */
  notifyDaysBefore?: number
  /** Person's name associated with the date (e.g., for birthdays) */
  linkedContactName?: string
  /** For non-recurring one-time dates only */
  isCompleted?: boolean
  /** ISO-8601 datetime */
  createdAt: string
  /** ISO-8601 datetime */
  updatedAt: string
}

export type CreateDatePayload = Omit<ImportantDate, 'id' | 'createdAt' | 'updatedAt'>

export type UpdateDatePayload = Partial<ImportantDate> & { id: string }

export interface UpcomingDate extends ImportantDate {
  /** Number of days from today until this occurrence (0 = today) */
  daysUntil: number
  /** The resolved YYYY-MM-DD date of the next occurrence */
  occurrenceDate: string
}
