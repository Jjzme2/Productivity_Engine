// ─── Analytics store ──────────────────────────────────────────────────────────

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { UserInsights, WeeklySummary, ProductivityScore, ActivityEvent } from '@/types/analytics'
import * as tauri from '@/services/tauriClient'
import eventBus from '@/services/eventBus'

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAnalyticsStore = defineStore('analytics', () => {
  // ── State ──────────────────────────────────────────────────────────────────

  const insights       = ref<UserInsights | null>(null)
  const weeklyScores   = ref<ProductivityScore[]>([])
  const weeklySummaries = ref<WeeklySummary[]>([])
  const isAnalyzing    = ref(false)
  const lastAnalyzed   = ref<Date | null>(null)
  const error          = ref<string | null>(null)

  // ── Computed ───────────────────────────────────────────────────────────────

  const currentScore = computed(
    () => weeklyScores.value[weeklyScores.value.length - 1]?.score ?? 0,
  )

  const topShortcomings = computed(
    () =>
      insights.value?.shortcomings
        .filter((s) => !s.isResolved)
        .sort((a, b) => {
          const order = { high: 0, medium: 1, low: 2 }
          return order[a.severity] - order[b.severity]
        })
        .slice(0, 3) ?? [],
  )

  const topSuggestions = computed(
    () =>
      insights.value?.suggestions
        .slice()
        .sort((a, b) => b.priority - a.priority)
        .slice(0, 5) ?? [],
  )

  const hasInsights = computed(() => insights.value !== null)

  // ── Actions ────────────────────────────────────────────────────────────────

  async function loadInsights(userId: string): Promise<void> {
    try {
      const data = await tauri.getInsights(userId)
      if (data) {
        insights.value = data
        lastAnalyzed.value = new Date(data.lastAnalyzedAt)
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
    }
  }

  async function runAnalysis(userId = 'local'): Promise<void> {
    if (isAnalyzing.value) return
    isAnalyzing.value = true
    error.value = null

    try {
      const data = await tauri.runShortcomingAnalysis(userId)
      insights.value = data
      lastAnalyzed.value = new Date(data.lastAnalyzedAt)
      eventBus.emit('analytics:updated', { triggeredBy: 'manual' })
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
    } finally {
      isAnalyzing.value = false
    }
  }

  async function loadWeeklyScores(userId: string): Promise<void> {
    const summaries = await tauri.getWeeklySummaries(userId, 12)
    weeklySummaries.value = summaries
    weeklyScores.value = summaries.map((s) => s.score)
  }

  async function logActivity(event: Omit<ActivityEvent, 'id'>): Promise<void> {
    try {
      await tauri.logActivityEvent(event)
    } catch {
      // Non-critical — swallow errors so analytics never breaks the app
    }
  }

  // ── Compatibility aliases for older views ──────────────────────────────────

  const loading = isAnalyzing

  /** Compatibility: daily scores derived from weekly summaries */
  const dailyScores = computed(() =>
    weeklySummaries.value.flatMap((s) =>
      Array.isArray((s as Record<string, unknown>).dailyScores)
        ? ((s as Record<string, unknown>).dailyScores as Array<{ date: string; score: number }>)
        : [],
    ),
  )

  const productivityScore = currentScore

  const weekOverWeekDelta = computed(() => {
    const scores = weeklyScores.value
    if (scores.length < 2) return 0
    const last = scores[scores.length - 1]?.score ?? 0
    const prev = scores[scores.length - 2]?.score ?? 0
    return Math.round(last - prev)
  })

  const completionRate = computed(() => 0)

  const shortcomings = computed(() => insights.value?.shortcomings ?? [])

  const patternInsights = computed(() =>
    insights.value?.patterns?.map((p: { id: string; text: string; generatedAt: string }) => p) ?? [],
  )

  return {
    // State
    insights,
    weeklyScores,
    weeklySummaries,
    isAnalyzing,
    lastAnalyzed,
    error,
    // Computed
    currentScore,
    topShortcomings,
    topSuggestions,
    hasInsights,
    // Compatibility aliases
    loading,
    dailyScores,
    productivityScore,
    weekOverWeekDelta,
    completionRate,
    shortcomings,
    patternInsights,
    // Actions
    loadInsights,
    runAnalysis,
    loadWeeklyScores,
    logActivity,
  }
})
