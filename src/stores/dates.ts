import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { nanoid } from 'nanoid'
import type { ImportantDate, CreateDatePayload, UpdateDatePayload, UpcomingDate } from '@/types/dates'
import {
  subscribeToCollection,
  createDoc,
  updateDoc as fsUpdateDoc,
  deleteDoc as fsDeleteDoc,
  COLLECTIONS,
} from '@/services/firestoreClient'
import type { Unsubscribe } from 'firebase/firestore'

// ─── Helper ───────────────────────────────────────────────────────────────────

/** Returns the next occurrence date string (YYYY-MM-DD) and days until that date. */
function getNextOccurrence(entry: ImportantDate): { date: string; daysUntil: number } {
  const todayDate = new Date()
  todayDate.setHours(0, 0, 0, 0)

  if (entry.recurrence === 'yearly') {
    const raw = new Date(entry.date + 'T00:00:00')
    // Try this calendar year first, then next year
    const thisYear = new Date(todayDate.getFullYear(), raw.getMonth(), raw.getDate())
    const candidate = thisYear >= todayDate ? thisYear : new Date(todayDate.getFullYear() + 1, raw.getMonth(), raw.getDate())
    const daysUntil = Math.round((candidate.getTime() - todayDate.getTime()) / 86_400_000)
    const occurrenceDate = candidate.toISOString().slice(0, 10)
    return { date: occurrenceDate, daysUntil }
  }

  // For 'none', 'monthly', 'weekly' — return the raw stored date as-is
  const raw = new Date(entry.date + 'T00:00:00')
  raw.setHours(0, 0, 0, 0)
  const daysUntil = Math.round((raw.getTime() - todayDate.getTime()) / 86_400_000)
  return { date: entry.date, daysUntil }
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useImportantDatesStore = defineStore('importantDates', () => {
  const dates = ref<ImportantDate[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  
  let _unsubDates: Unsubscribe | null = null

  // ── Computed ──────────────────────────────────────────────────────────────

  const upcomingDates = computed<UpcomingDate[]>(() => {
    return dates.value
      .map((entry): UpcomingDate | null => {
        const { date: occurrenceDate, daysUntil } = getNextOccurrence(entry)
        if (daysUntil < 0 || daysUntil > 365) return null
        return { ...entry, daysUntil, occurrenceDate }
      })
      .filter((d): d is UpcomingDate => d !== null)
      .sort((a, b) => a.daysUntil - b.daysUntil)
  })

  const todayDates = computed<UpcomingDate[]>(() =>
    upcomingDates.value.filter(d => d.daysUntil === 0)
  )

  const thisWeekDates = computed<UpcomingDate[]>(() =>
    upcomingDates.value.filter(d => d.daysUntil <= 7)
  )

  const thisMonthDates = computed<UpcomingDate[]>(() =>
    upcomingDates.value.filter(d => d.daysUntil <= 30)
  )

  /** Non-recurring dates whose date has already passed and are not completed */
  const overdueDates = computed<ImportantDate[]>(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().slice(0, 10)
    return dates.value.filter(
      d => d.recurrence === 'none' && d.date < todayStr && !d.isCompleted
    )
  })

  // ── Actions ───────────────────────────────────────────────────────────────

  function loadData(userId: string) {
    loading.value = true
    _unsubDates = subscribeToCollection<ImportantDate>(
      COLLECTIONS.DATES,
      { where: [{ field: 'userId', op: '==', value: userId }] },
      (docs) => { dates.value = docs; loading.value = false },
      (err) => { error.value = err.message; loading.value = false }
    )
  }

  function unloadData() {
    _unsubDates?.(); _unsubDates = null
    dates.value = []
  }

  async function createDate(payload: CreateDatePayload & { userId: string }): Promise<ImportantDate> {
    const now = new Date().toISOString()
    const entry: ImportantDate = { ...payload, id: nanoid(), createdAt: now, updatedAt: now }
    dates.value.unshift(entry)
    try {
      const created = await createDoc<ImportantDate>(COLLECTIONS.DATES, entry as Omit<ImportantDate, 'id'>)
      const idx = dates.value.findIndex(d => d.id === entry.id)
      if (idx !== -1) dates.value[idx] = created
      return created
    } catch (err) {
      dates.value = dates.value.filter(d => d.id !== entry.id)
      throw err
    }
  }

  async function updateDate(payload: UpdateDatePayload): Promise<void> {
    const idx = dates.value.findIndex(d => d.id === payload.id)
    if (idx === -1) return
    const previous = { ...dates.value[idx]! }
    dates.value[idx] = { ...previous, ...payload, updatedAt: new Date().toISOString() } as ImportantDate
    try {
      await fsUpdateDoc<ImportantDate>(COLLECTIONS.DATES, payload.id, payload)
    } catch (err) {
      dates.value[idx] = previous
      throw err
    }
  }

  async function deleteDate(id: string): Promise<void> {
    const idx = dates.value.findIndex(d => d.id === id)
    const removed = idx !== -1 ? dates.value[idx]! : null
    if (idx !== -1) dates.value.splice(idx, 1)
    try {
      await fsDeleteDoc(COLLECTIONS.DATES, id)
    } catch (err) {
      if (removed !== null && idx !== -1) dates.value.splice(idx, 0, removed)
      throw err
    }
  }

  function markCompleted(id: string) {
    updateDate({ id, isCompleted: true })
  }

  return {
    dates,
    loading,
    error,
    upcomingDates,
    todayDates,
    thisWeekDates,
    thisMonthDates,
    overdueDates,
    loadData,
    unloadData,
    createDate,
    updateDate,
    deleteDate,
    markCompleted,
  }
})
