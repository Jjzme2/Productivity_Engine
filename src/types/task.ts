// ─── Task domain types ────────────────────────────────────────────────────────

export type TaskStatus =
  | 'todo'
  | 'in_progress'
  | 'blocked'
  | 'done'
  | 'cancelled'

export type Priority = 'urgent' | 'high' | 'medium' | 'low'

/**
 * Eisenhower matrix quadrant keys.
 * do_first   → urgent + important
 * schedule   → not urgent + important
 * delegate   → urgent + not important
 * eliminate  → not urgent + not important
 */
export type EisenhowerQuadrant =
  | 'do_first'
  | 'schedule'
  | 'delegate'
  | 'eliminate'

export interface Task {
  id: string
  userId: string
  title: string
  description?: string
  status: TaskStatus
  priority: Priority
  eisenhowerQuadrant?: EisenhowerQuadrant
  /** ISO-8601 date string (YYYY-MM-DD) */
  dueDate?: string
  /** ISO-8601 datetime string */
  completedAt?: string
  /** Estimated duration in minutes */
  estimatedMinutes?: number
  /** Actual time spent in minutes (from Pomodoro sessions) */
  actualMinutes?: number
  tags: string[]
  projectId?: string
  parentTaskId?: string
  subtaskIds: string[]
  linkedNoteIds: string[]
  linkedEventIds: string[]
  recurrenceRule?: string
  /** ISO-8601 datetime */
  createdAt: string
  /** ISO-8601 datetime */
  updatedAt: string
  /** Soft-delete flag */
  isArchived: boolean
  sortOrder?: number
}

export interface CreateTaskPayload {
  title: string
  description?: string
  status?: TaskStatus
  priority?: Priority
  eisenhowerQuadrant?: EisenhowerQuadrant
  dueDate?: string
  estimatedMinutes?: number
  tags?: string[]
  projectId?: string
  parentTaskId?: string
  linkedNoteIds?: string[]
  linkedEventIds?: string[]
  recurrenceRule?: string
}

export interface UpdateTaskPayload {
  id: string
  title?: string
  description?: string
  status?: TaskStatus
  priority?: Priority
  eisenhowerQuadrant?: EisenhowerQuadrant
  dueDate?: string
  estimatedMinutes?: number
  actualMinutes?: number
  tags?: string[]
  projectId?: string
  linkedNoteIds?: string[]
  linkedEventIds?: string[]
  recurrenceRule?: string
  isArchived?: boolean
  sortOrder?: number
}

export interface TaskFilter {
  status?: TaskStatus[]
  priority?: Priority[]
  eisenhowerQuadrant?: EisenhowerQuadrant[]
  tags?: string[]
  projectId?: string
  dueBefore?: string
  dueAfter?: string
  searchQuery?: string
  includeArchived?: boolean
}

export interface PriorityMatrix {
  doFirst: Task[]
  schedule: Task[]
  delegate: Task[]
  eliminate: Task[]
}
