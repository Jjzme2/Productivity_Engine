// ─── Habit store ──────────────────────────────────────────────────────────────

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { nanoid } from 'nanoid'
import type {
  Habit,
  HabitEntry,
  CreateHabitPayload,
  UpdateHabitPayload,
  StreakData,
} from '@/types/habit'
import {
  subscribeToCollection,
  createDoc,
  updateDoc,
  deleteDoc,
  queryCollection,
  COLLECTIONS,
} from '@/services/firestoreClient'
import type { Unsubscribe } from 'firebase/firestore'
import eventBus from '@/services/eventBus'

// ─── Store ────────────────────────────────────────────────────────────────────

export const useHabitStore = defineStore('habits', () => {
  // ── State ──────────────────────────────────────────────────────────────────

  const habits       = ref<Habit[]>([])
  /** Map of habitId → today's HabitEntry (may be undefined if not checked) */
  const todayEntries = ref<Record<string, HabitEntry>>({})
  /** Map of habitId → StreakData */
  const streaks      = ref<Record<string, StreakData>>({})
  const isLoading    = ref(false)
  const error        = ref<string | null>(null)

  let _unsubHabits: Unsubscribe | null = null
  let _unsubEntries: Unsubscribe | null = null

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Always returns the current calendar date as YYYY-MM-DD — never stale. */
  function getTodayStr(): string {
    return new Date().toISOString().slice(0, 10)
  }

  // ── Computed ───────────────────────────────────────────────────────────────

  const activeHabits = computed(() =>
    habits.value.filter((h) => h.status === 'active' && !h.isArchived),
  )

  const pendingTodayHabits = computed(() =>
    activeHabits.value.filter((h) => !todayEntries.value[h.id]?.completed),
  )

  const completedTodayCount = computed(
    () => activeHabits.value.filter((h) => todayEntries.value[h.id]?.completed).length,
  )

  /** Compatibility: flat entries array derived from todayEntries map */
  const entries = computed(() => Object.values(todayEntries.value))

  /** Compatibility: habits with streak + todayEntry attached */
  const habitsWithStreak = computed(() =>
    activeHabits.value.map((h) => ({
      ...h,
      streak: streaks.value[h.id] ?? { current: 0, longest: 0, lastChecked: null },
      todayEntry: todayEntries.value[h.id] ?? null,
    })),
  )

  const todayTotal     = computed(() => activeHabits.value.length)
  const todayCompleted = completedTodayCount

  /** Compatibility: synchronous check-in (fire-and-forget async) */
  function checkIn(habitId: string, _count = 1) {
    checkInHabit(habitId, 'local').catch(() => {})
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  function loadHabits(userId: string) {
    isLoading.value = true

    // ── Subscribe to habits ──
    _unsubHabits = subscribeToCollection<Habit>(
      COLLECTIONS.HABITS,
      {
        where:   [{ field: 'userId', op: '==', value: userId }],
        orderBy: [{ field: 'createdAt', direction: 'asc' }],
      },
      (docs) => {
        habits.value = docs
        // Derive streaks from habit docs
        const result: Record<string, StreakData> = {}
        for (const habit of docs) {
          result[habit.id] = (habit as Habit & { streakData?: StreakData }).streakData ?? {
            current:     0,
            longest:     0,
            lastChecked: null,
          }
        }
        streaks.value = result
        isLoading.value = false
      },
      (err) => {
        error.value = err.message
        isLoading.value = false
      },
    )

    // ── Subscribe to today's entries (real-time) ──
    // This ensures check-in state is live and survives page reload.
    _unsubEntries = subscribeToCollection<HabitEntry>(
      COLLECTIONS.HABIT_ENTRIES,
      {
        where: [
          { field: 'userId', op: '==', value: userId },
          { field: 'date',   op: '==', value: getTodayStr() },
        ],
      },
      (docs) => {
        const map: Record<string, HabitEntry> = {}
        for (const entry of docs) map[entry.habitId] = entry
        todayEntries.value = map
      },
      (err) => {
        error.value = err.message
      },
    )
  }

  function unloadHabits() {
    _unsubHabits?.()
    _unsubHabits = null
    _unsubEntries?.()
    _unsubEntries = null
    habits.value = []
    todayEntries.value = {}
    streaks.value = {}
  }

  async function createHabit(userIdOrPayload: string | CreateHabitPayload, payloadArg?: CreateHabitPayload): Promise<Habit> {
    const userId  = typeof userIdOrPayload === 'string' ? userIdOrPayload : 'local'
    const payload = typeof userIdOrPayload === 'string' ? payloadArg! : userIdOrPayload
    const now = new Date().toISOString()
    const draft: Habit = {
      id:           nanoid(),
      userId,
      title:        payload.title,
      description:  payload.description,
      icon:         payload.icon,
      color:        payload.color,
      frequency:    payload.frequency,
      customDays:   payload.customDays,
      targetCount:  payload.targetCount ?? 1,
      unit:         payload.unit,
      reminderTime: payload.reminderTime,
      status:       'active',
      category:     payload.category,
      startDate:    payload.startDate ?? getTodayStr(),
      endDate:      payload.endDate,
      linkedTaskIds: [],
      createdAt:    now,
      updatedAt:    now,
      isArchived:   false,
    }

    habits.value.push(draft)

    try {
      const created = await createDoc<Habit>(COLLECTIONS.HABITS, draft as Omit<Habit, 'id'>)
      const idx = habits.value.findIndex((h) => h.id === draft.id)
      if (idx !== -1) habits.value[idx] = created
      eventBus.emit('habit:created', created)
      return created
    } catch (err) {
      // Rollback optimistic insert
      habits.value = habits.value.filter((h) => h.id !== draft.id)
      throw err
    }
  }

  async function updateHabit(payload: UpdateHabitPayload): Promise<void> {
    const idx = habits.value.findIndex((h) => h.id === payload.id)
    if (idx === -1) return

    const previous = { ...habits.value[idx]! }
    habits.value[idx] = { ...previous, ...payload, updatedAt: new Date().toISOString() }

    try {
      await updateDoc<Habit>(COLLECTIONS.HABITS, payload.id, payload)
    } catch (err) {
      habits.value[idx] = previous
      throw err
    }
  }

  async function deleteHabit(id: string): Promise<void> {
    const idx = habits.value.findIndex((h) => h.id === id)
    const removed = idx !== -1 ? habits.value[idx]! : null
    if (idx !== -1) habits.value.splice(idx, 1)

    try {
      await deleteDoc(COLLECTIONS.HABITS, id)
    } catch (err) {
      if (removed && idx !== -1) habits.value.splice(idx, 0, removed)
      throw err
    }
  }

  /**
   * Check in a habit for today (increment count / mark completed).
   * Creates or updates the HabitEntry document.
   */
  async function checkInHabit(habitId: string, userId: string): Promise<HabitEntry> {
    const habit = habits.value.find((h) => h.id === habitId)
    if (!habit) throw new Error(`Habit ${habitId} not found`)

    const todayStr = getTodayStr()
    const existing = todayEntries.value[habitId]
    const newCount = (existing?.count ?? 0) + 1
    const completed = newCount >= habit.targetCount
    const now = new Date().toISOString()

    if (existing) {
      // Optimistic update
      const updated: HabitEntry = { ...existing, count: newCount, completed }
      todayEntries.value[habitId] = updated

      try {
        await updateDoc<HabitEntry>(COLLECTIONS.HABIT_ENTRIES, existing.id, { count: newCount, completed })
        if (completed) await _recalcStreak(habitId, todayStr)
        eventBus.emit('habit:checked', { habit, entry: updated })
        return updated
      } catch (err) {
        // Rollback
        todayEntries.value[habitId] = existing
        throw err
      }
    } else {
      // Create new entry
      const entry: HabitEntry = {
        id:        nanoid(),
        habitId,
        userId,
        date:      todayStr,
        count:     newCount,
        completed,
        createdAt: now,
      }
      todayEntries.value[habitId] = entry

      try {
        const created = await createDoc<HabitEntry>(COLLECTIONS.HABIT_ENTRIES, entry as Omit<HabitEntry, 'id'>)
        todayEntries.value[habitId] = created
        if (completed) await _recalcStreak(habitId, todayStr)
        eventBus.emit('habit:checked', { habit, entry: created })
        return created
      } catch (err) {
        // Rollback
        delete todayEntries.value[habitId]
        throw err
      }
    }
  }

  async function loadTodayEntries(userId: string): Promise<void> {
    const entries = await queryCollection<HabitEntry>(COLLECTIONS.HABIT_ENTRIES, {
      where: [
        { field: 'userId', op: '==', value: userId },
        { field: 'date',   op: '==', value: getTodayStr() },
      ],
    })
    const map: Record<string, HabitEntry> = {}
    for (const e of entries) map[e.habitId] = e
    todayEntries.value = map
  }

  async function loadStreaks(userId: string): Promise<void> {
    const result: Record<string, StreakData> = {}
    for (const habit of habits.value) {
      result[habit.id] = (habit as Habit & { streakData?: StreakData }).streakData ?? {
        current:     0,
        longest:     0,
        lastChecked: null,
      }
    }
    streaks.value = result
  }

  /** Internal: recalculate streak for a habit after a check-in. */
  async function _recalcStreak(habitId: string, todayStr: string): Promise<void> {
    const current = streaks.value[habitId] ?? { current: 0, longest: 0, lastChecked: null }
    const newCurrent = current.lastChecked === todayStr
      ? current.current
      : current.current + 1
    const updated: StreakData = {
      current:     newCurrent,
      longest:     Math.max(newCurrent, current.longest),
      lastChecked: todayStr,
    }
    streaks.value[habitId] = updated
    // Persist onto the habit document for easy querying
    await updateDoc<Habit & { streakData: StreakData }>(
      COLLECTIONS.HABITS,
      habitId,
      { streakData: updated } as Partial<Omit<Habit & { streakData: StreakData }, 'id'>>,
    )
  }

  return {
    // State
    habits,
    todayEntries,
    streaks,
    isLoading,
    error,
    // Computed
    activeHabits,
    pendingTodayHabits,
    completedTodayCount,
    entries,
    habitsWithStreak,
    todayTotal,
    todayCompleted,
    checkIn,
    // Actions
    loadHabits,
    unloadHabits,
    createHabit,
    updateHabit,
    deleteHabit,
    checkInHabit,
    loadTodayEntries,
    loadStreaks,
  }
})
