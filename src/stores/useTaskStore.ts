// ─── Task store ───────────────────────────────────────────────────────────────

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { nanoid } from 'nanoid'
import type { Task, CreateTaskPayload, UpdateTaskPayload, TaskFilter, PriorityMatrix } from '@/types/task'
import {
  subscribeToCollection,
  createDoc,
  updateDoc,
  deleteDoc,
  COLLECTIONS,
} from '@/services/firestoreClient'
import type { Unsubscribe } from 'firebase/firestore'
import eventBus from '@/services/eventBus'

// ─── Store ────────────────────────────────────────────────────────────────────

export const useTaskStore = defineStore('tasks', () => {
  // ── State ──────────────────────────────────────────────────────────────────

  const tasks          = ref<Task[]>([])
  const activeTask     = ref<Task | null>(null)
  const filter         = ref<TaskFilter>({})
  const isLoading      = ref(false)
  const priorityMatrix = ref<PriorityMatrix | null>(null)
  const error          = ref<string | null>(null)

  let _unsubscribe: Unsubscribe | null = null

  // ── Computed ───────────────────────────────────────────────────────────────

  const filteredTasks = computed(() => {
    let result = tasks.value

    const f = filter.value

    if (f.status?.length) {
      result = result.filter((t) => f.status!.includes(t.status))
    }
    if (f.priority?.length) {
      result = result.filter((t) => f.priority!.includes(t.priority))
    }
    if (f.eisenhowerQuadrant?.length) {
      result = result.filter(
        (t) => t.eisenhowerQuadrant && f.eisenhowerQuadrant!.includes(t.eisenhowerQuadrant),
      )
    }
    if (f.tags?.length) {
      result = result.filter((t) => f.tags!.some((tag) => t.tags.includes(tag)))
    }
    if (f.projectId) {
      result = result.filter((t) => t.projectId === f.projectId)
    }
    if (f.dueBefore) {
      result = result.filter((t) => t.dueDate && t.dueDate <= f.dueBefore!)
    }
    if (f.dueAfter) {
      result = result.filter((t) => t.dueDate && t.dueDate >= f.dueAfter!)
    }
    if (f.searchQuery) {
      const q = f.searchQuery.toLowerCase()
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q),
      )
    }
    if (!f.includeArchived) {
      result = result.filter((t) => !t.isArchived)
    }

    return result
  })

  const incompleteTasks = computed(() =>
    tasks.value.filter((t) => t.status !== 'done' && t.status !== 'cancelled' && !t.isArchived),
  )

  // Use a getter so date comparisons are always fresh — never stale after midnight.
  const overdueTasks = computed(() => {
    const today = new Date().toISOString().slice(0, 10)
    return incompleteTasks.value.filter((t) => t.dueDate && t.dueDate < today)
  })

  const todayTasks = computed(() => {
    const today = new Date().toISOString().slice(0, 10)
    return incompleteTasks.value.filter((t) => t.dueDate === today)
  })

  // ── Actions ────────────────────────────────────────────────────────────────

  /**
   * Subscribe to the tasks collection in Firestore for a given user.
   * Keeps the local `tasks` array in sync in real-time.
   * Call `unloadTasks()` when the component/view unmounts.
   */
  function loadTasks(userId: string) {
    isLoading.value = true
    _unsubscribe = subscribeToCollection<Task>(
      COLLECTIONS.TASKS,
      {
        where:   [{ field: 'userId', op: '==', value: userId }],
        orderBy: [{ field: 'createdAt', direction: 'desc' }],
      },
      (docs) => {
        tasks.value = docs
        isLoading.value = false
      },
      (err) => {
        error.value = err.message
        isLoading.value = false
      },
    )
  }

  function unloadTasks() {
    _unsubscribe?.()
    _unsubscribe = null
    tasks.value = []
  }

  async function createTask(
    userIdOrPayload: string | CreateTaskPayload,
    payloadArg?: CreateTaskPayload,
  ): Promise<Task> {
    const userId  = typeof userIdOrPayload === 'string' ? userIdOrPayload : 'local'
    const payload = typeof userIdOrPayload === 'string' ? payloadArg! : userIdOrPayload
    const now = new Date().toISOString()
    const optimistic: Task = {
      id:            nanoid(),
      userId,
      title:         payload.title,
      description:   payload.description,
      status:        payload.status ?? 'todo',
      priority:      payload.priority ?? 'medium',
      eisenhowerQuadrant: payload.eisenhowerQuadrant,
      dueDate:       payload.dueDate,
      estimatedMinutes: payload.estimatedMinutes,
      actualMinutes: 0,
      tags:          payload.tags ?? [],
      projectId:     payload.projectId,
      parentTaskId:  payload.parentTaskId,
      subtaskIds:    [],
      linkedNoteIds: payload.linkedNoteIds ?? [],
      linkedEventIds: payload.linkedEventIds ?? [],
      recurrenceRule: payload.recurrenceRule,
      createdAt:     now,
      updatedAt:     now,
      isArchived:    false,
    }

    // Optimistic insert
    tasks.value.unshift(optimistic)

    try {
      const created = await createDoc<Task>(COLLECTIONS.TASKS, {
        ...optimistic,
      } as Omit<Task, 'id'>)
      // Replace optimistic entry with server response (has real Firestore id)
      const idx = tasks.value.findIndex((t) => t.id === optimistic.id)
      if (idx !== -1) tasks.value[idx] = created
      eventBus.emit('task:created', created)
      return created
    } catch (err) {
      // Rollback
      tasks.value = tasks.value.filter((t) => t.id !== optimistic.id)
      throw err
    }
  }

  async function updateTask(payload: UpdateTaskPayload): Promise<void> {
    const idx = tasks.value.findIndex((t) => t.id === payload.id)
    if (idx === -1) return

    const previous = { ...tasks.value[idx]! }
    const updated: Task = {
      ...previous,
      ...payload,
      updatedAt: new Date().toISOString(),
    }

    // Optimistic update
    tasks.value[idx] = updated

    try {
      await updateDoc<Task>(COLLECTIONS.TASKS, payload.id, payload)
      eventBus.emit('task:updated', updated)
    } catch (err) {
      // Rollback
      tasks.value[idx] = previous
      throw err
    }
  }

  async function deleteTask(id: string): Promise<void> {
    const idx = tasks.value.findIndex((t) => t.id === id)
    const removed = idx !== -1 ? tasks.value[idx]! : null

    // Optimistic remove
    if (idx !== -1) tasks.value.splice(idx, 1)

    try {
      await deleteDoc(COLLECTIONS.TASKS, id)
      eventBus.emit('task:deleted', { id })
    } catch (err) {
      // Rollback
      if (removed && idx !== -1) tasks.value.splice(idx, 0, removed)
      throw err
    }
  }

  async function completeTask(id: string): Promise<void> {
    const idx = tasks.value.findIndex((t) => t.id === id)
    if (idx === -1) return

    const now = new Date().toISOString()
    const previous = { ...tasks.value[idx]! }
    const updated: Task = {
      ...previous,
      status:      'done',
      completedAt: now,
      updatedAt:   now,
    }

    tasks.value[idx] = updated

    try {
      await updateDoc<Task>(COLLECTIONS.TASKS, id, {
        status:      'done',
        completedAt: now,
      })
      eventBus.emit('task:completed', updated)
    } catch (err) {
      tasks.value[idx] = previous
      throw err
    }
  }

  async function bulkComplete(ids: string[]): Promise<void> {
    await Promise.all(ids.map((id) => completeTask(id)))
  }

  /** Compatibility alias */
  const activeFilter = filter

  function setFilter(newFilter: TaskFilter) {
    filter.value = { ...filter.value, ...newFilter }
  }

  function clearFilter() {
    filter.value = {}
  }

  function setActiveTask(task: Task | null) {
    activeTask.value = task
  }

  function setMatrix(matrix: PriorityMatrix) {
    priorityMatrix.value = matrix
  }

  return {
    // State
    tasks,
    activeTask,
    filter,
    activeFilter,
    isLoading,
    priorityMatrix,
    error,
    // Computed
    filteredTasks,
    incompleteTasks,
    overdueTasks,
    todayTasks,
    // Actions
    loadTasks,
    unloadTasks,
    createTask,
    updateTask,
    deleteTask,
    completeTask,
    bulkComplete,
    setFilter,
    clearFilter,
    setActiveTask,
    setMatrix,
  }
})
