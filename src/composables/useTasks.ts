// ─── Task CRUD composable with optimistic updates ─────────────────────────────

import { useTaskStore } from '@/stores/useTaskStore'
import { useAppStore } from '@/stores/useAppStore'
import { useAnalyticsStore } from '@/stores/useAnalyticsStore'
import type { CreateTaskPayload, UpdateTaskPayload, Task } from '@/types/task'
import eventBus from '@/services/eventBus'

// ─── Composable ───────────────────────────────────────────────────────────────

export function useTasks(userId: string) {
  const taskStore      = useTaskStore()
  const appStore       = useAppStore()
  const analyticsStore = useAnalyticsStore()

  // ── Create ────────────────────────────────────────────────────────────────

  /**
   * Optimistically creates a task:
   * 1. Immediately inserts into the store (instant UI feedback).
   * 2. Writes to Firestore in the background.
   * 3. Rolls back the store insertion if Firestore write fails.
   */
  async function createTask(payload: CreateTaskPayload): Promise<Task | null> {
    try {
      const task = await taskStore.createTask(userId, payload)
      await analyticsStore.logActivity({
        userId,
        type:       'task_created',
        entityId:   task.id,
        entityType: 'task',
        timestamp:  new Date().toISOString(),
      })
      return task
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create task'
      appStore.showToast({ title: 'Error', message: msg, variant: 'error' })
      return null
    }
  }

  // ── Update ────────────────────────────────────────────────────────────────

  /**
   * Optimistically updates a task in the store and syncs to Firestore.
   * Rolls back on error.
   */
  async function updateTask(payload: UpdateTaskPayload): Promise<boolean> {
    try {
      await taskStore.updateTask(payload)
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update task'
      appStore.showToast({ title: 'Error', message: msg, variant: 'error' })
      return false
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  /**
   * Optimistically removes the task and syncs the deletion to Firestore.
   * Rolls back on error.
   */
  async function deleteTask(taskId: string): Promise<boolean> {
    try {
      await taskStore.deleteTask(taskId)
      appStore.showToast({ title: 'Task deleted', variant: 'success', durationMs: 3000 })
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete task'
      appStore.showToast({ title: 'Error', message: msg, variant: 'error' })
      return false
    }
  }

  // ── Complete ──────────────────────────────────────────────────────────────

  /**
   * Marks a task as done, triggers the completion animation event,
   * and logs the activity.
   */
  async function completeTask(taskId: string): Promise<boolean> {
    try {
      await taskStore.completeTask(taskId)

      // Trigger confetti / animation via event bus
      const completedTask = taskStore.tasks.find((t) => t.id === taskId)
      if (completedTask) {
        eventBus.emit('task:completed', completedTask)
      }

      await analyticsStore.logActivity({
        userId,
        type:       'task_completed',
        entityId:   taskId,
        entityType: 'task',
        timestamp:  new Date().toISOString(),
      })

      appStore.showToast({ title: 'Task completed!', variant: 'success', durationMs: 2500 })
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to complete task'
      appStore.showToast({ title: 'Error', message: msg, variant: 'error' })
      return false
    }
  }

  // ── Bulk complete ─────────────────────────────────────────────────────────

  async function bulkComplete(taskIds: string[]): Promise<void> {
    await Promise.all(taskIds.map((id) => completeTask(id)))
  }

  return {
    createTask,
    updateTask,
    deleteTask,
    completeTask,
    bulkComplete,
    // Expose store refs for template binding
    tasks:          taskStore.filteredTasks,
    incompleteTasks: taskStore.incompleteTasks,
    overdueTasks:   taskStore.overdueTasks,
    isLoading:      taskStore.isLoading,
    filter:         taskStore.filter,
    setFilter:      taskStore.setFilter,
    clearFilter:    taskStore.clearFilter,
    setActiveTask:  taskStore.setActiveTask,
    activeTask:     taskStore.activeTask,
  }
}
