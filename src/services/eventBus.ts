// ─── Typed mitt event bus ─────────────────────────────────────────────────────

import mitt from 'mitt'
import type { Task } from '@/types/task'
import type { Habit, HabitEntry } from '@/types/habit'
import type { Note } from '@/types/note'
import type { FrameworkSession, PomodoroState } from '@/types/framework'
import type { ParsedIntent, ExecutionResult } from '@/types/nlp'

// ─── Toast notification payload ───────────────────────────────────────────────

export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

export interface ToastPayload {
  id?: string
  title: string
  message?: string
  variant: ToastVariant
  durationMs?: number
  action?: {
    label: string
    handler: () => void
  }
}

// ─── Sync event payload ───────────────────────────────────────────────────────

export interface SyncConflictPayload {
  entityType: string
  entityId: string
  localVersion: unknown
  remoteVersion: unknown
}

// ─── Full event map ───────────────────────────────────────────────────────────

export type AppEvents = {
  // ── Task events ────────────────────────────────────────────────────────────
  'task:created':   Task
  'task:updated':   Task
  'task:deleted':   { id: string }
  'task:completed': Task

  // ── Habit events ───────────────────────────────────────────────────────────
  'habit:created':  Habit
  'habit:checked':  { habit: Habit; entry: HabitEntry }

  // ── Note events ────────────────────────────────────────────────────────────
  'note:created':   Note

  // ── Framework events ───────────────────────────────────────────────────────
  'framework:started':  FrameworkSession
  'framework:stopped':  FrameworkSession

  // ── Pomodoro events ────────────────────────────────────────────────────────
  'pomodoro:tick':      PomodoroState
  'pomodoro:completed': { sessionId: string; completedIntervals: number }

  // ── Sync events ────────────────────────────────────────────────────────────
  'sync:started':   { entityType?: string }
  'sync:completed': { entityType?: string; count: number }
  'sync:conflict':  SyncConflictPayload

  // ── AI events ──────────────────────────────────────────────────────────────
  'ai:intent-parsed':   ParsedIntent
  'ai:intent-executed': ExecutionResult

  // ── Analytics events ───────────────────────────────────────────────────────
  'analytics:updated': { triggeredBy: string }

  // ── UI notifications ───────────────────────────────────────────────────────
  'notification:show': ToastPayload
}

// ─── Singleton bus instance ───────────────────────────────────────────────────

const bus = mitt<AppEvents>()

export const eventBus = {
  on:   bus.on.bind(bus),
  off:  bus.off.bind(bus),
  emit: bus.emit.bind(bus),
}

export default eventBus
