// ─── Habits composable ────────────────────────────────────────────────────────

import { computed } from 'vue'
import { useHabitStore } from '@/stores/useHabitStore'
import { useAppStore } from '@/stores/useAppStore'
import { useAnalyticsStore } from '@/stores/useAnalyticsStore'
import type { StreakData } from '@/types/habit'

// ─── Composable ───────────────────────────────────────────────────────────────

export function useHabits(userId: string) {
  const habitStore     = useHabitStore()
  const appStore       = useAppStore()
  const analyticsStore = useAnalyticsStore()

  // ── Check in ──────────────────────────────────────────────────────────────

  /**
   * Check in a habit for today.
   * Shows a toast with the updated streak.
   */
  async function checkIn(habitId: string): Promise<void> {
    try {
      const entry = await habitStore.checkInHabit(habitId, userId)
      const habit = habitStore.habits.find((h) => h.id === habitId)

      if (entry.completed) {
        const streakData = habitStore.streaks[habitId]
        const streakText = streakData ? ` — ${computeStreakDisplay(streakData)}` : ''
        appStore.showToast({
          title:   habit ? `"${habit.title}" checked in!` : 'Habit checked in!',
          message: streakText || undefined,
          variant: 'success',
          durationMs: 3000,
        })
      }

      await analyticsStore.logActivity({
        userId,
        type:       'habit_checked',
        entityId:   habitId,
        entityType: 'habit',
        timestamp:  new Date().toISOString(),
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to check in habit'
      appStore.showToast({ title: 'Error', message: msg, variant: 'error' })
    }
  }

  // ── Load today status ─────────────────────────────────────────────────────

  async function loadTodayStatus(): Promise<void> {
    await habitStore.loadTodayEntries(userId)
    await habitStore.loadStreaks(userId)
  }

  // ── Streak display ────────────────────────────────────────────────────────

  /**
   * Converts a StreakData object into a human-readable string.
   * Examples: "🔥 7-day streak", "Best: 30 days"
   */
  function computeStreakDisplay(streakData: StreakData): string {
    const { current, longest } = streakData

    if (current === 0) return 'Start your streak today!'
    if (current === 1) return '1 day streak — keep it up!'

    const parts: string[] = [`${current}-day streak`]
    if (longest > current) {
      parts.push(`Best: ${longest} days`)
    } else if (longest === current && current > 1) {
      parts.push('Personal best!')
    }

    return parts.join(' · ')
  }

  // ── Computed helpers ──────────────────────────────────────────────────────

  const todayProgress = computed(() => {
    const active = habitStore.activeHabits.length
    if (active === 0) return 100
    return Math.round((habitStore.completedTodayCount.valueOf() / active) * 100)
  })

  const streakForHabit = (habitId: string): StreakData =>
    habitStore.streaks[habitId] ?? { current: 0, longest: 0, lastChecked: null }

  const isTodayCompleted = (habitId: string): boolean =>
    habitStore.todayEntries[habitId]?.completed === true

  return {
    checkIn,
    loadTodayStatus,
    computeStreakDisplay,
    streakForHabit,
    isTodayCompleted,
    todayProgress,
    // Expose store refs
    habits:               habitStore.activeHabits,
    pendingTodayHabits:   habitStore.pendingTodayHabits,
    completedTodayCount:  habitStore.completedTodayCount,
    isLoading:            habitStore.isLoading,
    todayEntries:         habitStore.todayEntries,
  }
}
