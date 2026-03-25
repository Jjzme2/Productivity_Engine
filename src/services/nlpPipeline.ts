// ─── Client-side NLP pre-processing ──────────────────────────────────────────
// Runs before the Tauri invoke so we can sanitise, build context, and decide
// whether to auto-execute without showing a confirmation dialog.

import type { ParsedIntent, UserContext } from '@/types/nlp'
import type { useTaskStore } from '@/stores/useTaskStore'
import type { useHabitStore } from '@/stores/useHabitStore'
import type { useNlpStore } from '@/stores/useNlpStore'
import type { useAppStore } from '@/stores/useAppStore'

// ─── Types ────────────────────────────────────────────────────────────────────

type TaskStoreInstance  = ReturnType<typeof useTaskStore>
type HabitStoreInstance = ReturnType<typeof useHabitStore>
type NlpStoreInstance   = ReturnType<typeof useNlpStore>
type AppStoreInstance   = ReturnType<typeof useAppStore>

export interface StoreRefs {
  taskStore:  TaskStoreInstance
  habitStore: HabitStoreInstance
  nlpStore:   NlpStoreInstance
  appStore:   AppStoreInstance
}

// ─── NON-DESTRUCTIVE action set ───────────────────────────────────────────────
// These are safe to auto-execute when confidence is high enough.

const NON_DESTRUCTIVE_ACTIONS = new Set([
  'create_task',
  'create_habit',
  'create_note',
  'create_event',
  'check_habit',
  'start_framework',
  'get_summary',
  'search',
  'navigate',
])

// ─── sanitizeInput ────────────────────────────────────────────────────────────

/**
 * Strips control characters, trims whitespace, and collapses repeated spaces.
 * Enforces a max length of 1000 characters.
 */
export function sanitizeInput(raw: string): string {
  return raw
    // Remove ASCII control chars except newlines/tabs
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Collapse multiple spaces/tabs into a single space
    .replace(/[ \t]+/g, ' ')
    // Collapse multiple newlines into max two
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 1000)
}

// ─── buildUserContext ─────────────────────────────────────────────────────────

/**
 * Assembles a `UserContext` snapshot from the current Pinia stores.
 * This is sent alongside every NLP request so the AI has situational
 * awareness (e.g. what view is active, how many tasks are overdue, etc.).
 */
export function buildUserContext(stores: StoreRefs): UserContext {
  const { taskStore, habitStore, nlpStore, appStore } = stores

  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10) // YYYY-MM-DD

  // Overdue = tasks with a dueDate in the past that are not done/cancelled
  const overdueTaskIds = taskStore.tasks
    .filter(
      (t) =>
        t.dueDate &&
        t.dueDate < todayStr &&
        t.status !== 'done' &&
        t.status !== 'cancelled',
    )
    .map((t) => t.id)

  const recentTaskTitles = taskStore.tasks
    .filter((t) => t.status !== 'done' && t.status !== 'cancelled')
    .slice(0, 10)
    .map((t) => t.title)

  const pendingHabitIds = habitStore.habits
    .filter((h) => {
      const entry = habitStore.todayEntries[h.id]
      return !entry?.completed
    })
    .map((h) => h.id)

  return {
    userId:        'local', // replaced by auth uid in calling code
    currentView:   appStore.activeView,
    openTasks:     taskStore.tasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled').length,
    overdueTaskIds,
    recentTaskTitles,
    pendingHabitIds,
    preferences: {
      preferLocalAi:    false,
      cloudAiProvider:  'claude',
    },
  }
}

// ─── shouldAutoExecute ────────────────────────────────────────────────────────

/**
 * Returns `true` when the intent should be executed immediately without
 * prompting the user for confirmation.
 *
 * Criteria:
 *  1. Confidence > 0.95
 *  2. The action is non-destructive (create / search / navigate)
 */
export function shouldAutoExecute(intent: ParsedIntent): boolean {
  if (intent.confidence <= 0.95) return false
  if (intent.isDestructive) return false
  return NON_DESTRUCTIVE_ACTIONS.has(intent.action)
}

// ─── formatIntentDisplay ──────────────────────────────────────────────────────

/**
 * Formats a ParsedIntent into a human-readable confirmation string.
 * Shown in the command bar before the user confirms execution.
 *
 * Example output:
 *   "Create task: "Buy groceries" — Priority: high — Due: tomorrow"
 */
export function formatIntentDisplay(intent: ParsedIntent): string {
  const { action, entities, confidence } = intent
  const pct = Math.round(confidence * 100)

  const actionLabels: Record<string, string> = {
    create_task:      'Create task',
    update_task:      'Update task',
    delete_task:      'Delete task',
    complete_task:    'Complete task',
    create_habit:     'Create habit',
    check_habit:      'Check in habit',
    create_note:      'Create note',
    create_event:     'Create event',
    start_framework:  'Start framework',
    stop_framework:   'Stop framework',
    start_pomodoro:   'Start Pomodoro',
    get_summary:      'Get summary',
    search:           'Search',
    navigate:         'Navigate',
    unknown:          'Unknown action',
  }

  const label = actionLabels[action] ?? action

  const parts: string[] = []

  if (entities.title)          parts.push(`"${entities.title}"`)
  if (entities.priority)       parts.push(`Priority: ${entities.priority}`)
  if (entities.dueDate)        parts.push(`Due: ${entities.dueDate}`)
  if (entities.frameworkSlug)  parts.push(`Framework: ${entities.frameworkSlug}`)
  if (entities.query)          parts.push(`Query: "${entities.query}"`)
  if (entities.view)           parts.push(`View: ${entities.view}`)

  const detail = parts.length > 0 ? ` — ${parts.join(' — ')}` : ''

  return `${label}${detail}  (${pct}% confidence)`
}
