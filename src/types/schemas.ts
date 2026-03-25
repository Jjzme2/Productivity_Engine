// ─── Zod Schemas for Firestore Documents ──────────────────────────────────────
// Runtime validation for all Firestore collections. Used by firestoreClient
// to catch malformed data before it reaches Firestore.
//
// Why Zod?
// TypeScript types vanish at runtime. Zod schemas provide runtime validation
// to prevent malformed data from corrupting collections.

import { z } from 'zod'
import type { CollectionName } from '@/services/firestoreClient'
import { COLLECTIONS } from '@/services/firestoreClient'

// ─── Shared fields ───────────────────────────────────────────────────────────

const baseFields = {
  userId: z.string().min(1),
}

const isoDatetime = z.string().datetime().optional()

// ─── Tasks ───────────────────────────────────────────────────────────────────

export const TaskSchema = z.object({
  ...baseFields,
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['todo', 'in_progress', 'blocked', 'done', 'cancelled']),
  priority: z.enum(['urgent', 'high', 'medium', 'low']),
  eisenhowerQuadrant: z.enum(['do_first', 'schedule', 'delegate', 'eliminate']).optional(),
  dueDate: z.string().optional(),
  completedAt: isoDatetime,
  estimatedMinutes: z.number().nonnegative().optional(),
  actualMinutes: z.number().nonnegative().optional(),
  tags: z.array(z.string()),
  projectId: z.string().optional(),
  parentTaskId: z.string().optional(),
  subtaskIds: z.array(z.string()),
  linkedNoteIds: z.array(z.string()),
  linkedEventIds: z.array(z.string()),
  recurrenceRule: z.string().optional(),
  isArchived: z.boolean(),
  sortOrder: z.number().optional(),
}).passthrough()

// ─── Notes ───────────────────────────────────────────────────────────────────

const NoteLinkSchema = z.object({
  entityType: z.enum(['task', 'habit', 'event', 'framework_session']),
  entityId: z.string(),
  entityTitle: z.string(),
})

export const NoteSchema = z.object({
  ...baseFields,
  title: z.string(),
  content: z.string().optional(),
  excerpt: z.string(),
  tags: z.array(z.string()),
  links: z.array(NoteLinkSchema),
  isPinned: z.boolean(),
  isArchived: z.boolean(),
  wordCount: z.number().nonnegative(),
  color: z.string().optional(),
  r2Url: z.string().optional(),
}).passthrough()

// ─── Habits ──────────────────────────────────────────────────────────────────

export const HabitSchema = z.object({
  ...baseFields,
  name: z.string().min(1),
}).passthrough()

export const HabitEntrySchema = z.object({
  ...baseFields,
}).passthrough()

// ─── Events ──────────────────────────────────────────────────────────────────

export const EventSchema = z.object({
  ...baseFields,
  title: z.string().min(1),
}).passthrough()

// ─── Frameworks ──────────────────────────────────────────────────────────────

export const FrameworkSchema = z.object({
  ...baseFields,
}).passthrough()

export const FrameworkSessionSchema = z.object({
  ...baseFields,
}).passthrough()

// ─── Analytics / Activity ────────────────────────────────────────────────────

export const ActivityLogSchema = z.object({
  ...baseFields,
}).passthrough()

export const UserInsightsSchema = z.object({
  ...baseFields,
}).passthrough()

export const WeeklySummarySchema = z.object({
  ...baseFields,
}).passthrough()

// ─── Settings ────────────────────────────────────────────────────────────────

export const SettingsSchema = z.object({
  ...baseFields,
}).passthrough()

// ─── Finance ─────────────────────────────────────────────────────────────────

export const AccountSchema = z.object({
  ...baseFields,
}).passthrough()

export const TransactionSchema = z.object({
  ...baseFields,
}).passthrough()

export const BudgetSchema = z.object({
  ...baseFields,
}).passthrough()

export const FinancialGoalSchema = z.object({
  ...baseFields,
}).passthrough()

export const NetWorthSchema = z.object({
  ...baseFields,
}).passthrough()

// ─── Dates ───────────────────────────────────────────────────────────────────

export const DateSchema = z.object({
  ...baseFields,
}).passthrough()

// ─── Schema registry ────────────────────────────────────────────────────────
// Maps collection names to their Zod schemas for generic validation.

export const collectionSchemas: Partial<Record<CollectionName, z.ZodTypeAny>> = {
  [COLLECTIONS.TASKS]:              TaskSchema,
  [COLLECTIONS.HABITS]:             HabitSchema,
  [COLLECTIONS.HABIT_ENTRIES]:      HabitEntrySchema,
  [COLLECTIONS.NOTES]:              NoteSchema,
  [COLLECTIONS.EVENTS]:             EventSchema,
  [COLLECTIONS.FRAMEWORKS]:         FrameworkSchema,
  [COLLECTIONS.FRAMEWORK_SESSIONS]: FrameworkSessionSchema,
  [COLLECTIONS.ACTIVITY_LOG]:       ActivityLogSchema,
  [COLLECTIONS.USER_INSIGHTS]:      UserInsightsSchema,
  [COLLECTIONS.WEEKLY_SUMMARIES]:   WeeklySummarySchema,
  [COLLECTIONS.SETTINGS]:           SettingsSchema,
  [COLLECTIONS.ACCOUNTS]:           AccountSchema,
  [COLLECTIONS.TRANSACTIONS]:       TransactionSchema,
  [COLLECTIONS.BUDGETS]:            BudgetSchema,
  [COLLECTIONS.FINANCIAL_GOALS]:    FinancialGoalSchema,
  [COLLECTIONS.NET_WORTH]:          NetWorthSchema,
  [COLLECTIONS.DATES]:              DateSchema,
}
