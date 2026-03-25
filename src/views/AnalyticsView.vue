<script setup lang="ts">
import { computed } from 'vue'
import { useAnalyticsStore } from '@/stores/analytics'
import { useHabitStore } from '@/stores/habits'
import BaseCard from '@/components/shared/BaseCard.vue'
import BaseButton from '@/components/shared/BaseButton.vue'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'

const analyticsStore = useAnalyticsStore()
const habitStore = useHabitStore()

const severityColor: Record<string, string> = {
  critical: 'border-rose-500/30 bg-rose-500/5 text-rose-300',
  high:     'border-amber-500/30 bg-amber-500/5 text-amber-300',
  medium:   'border-yellow-500/30 bg-yellow-500/5 text-yellow-300',
  low:      'border-zinc-600/30 bg-zinc-800/30 text-zinc-400',
}

const deltaColor = computed(() =>
  analyticsStore.weekOverWeekDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'
)

const deltaPrefix = computed(() =>
  analyticsStore.weekOverWeekDelta >= 0 ? '+' : ''
)

const last7Days = computed(() => {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const dateStr = d.toISOString().slice(0, 10)
    const score = analyticsStore.dailyScores.find(s => s.date === dateStr)
    return {
      date: dateStr,
      label: d.toLocaleDateString('en-US', { weekday: 'short' }),
      score: score?.score ?? 0,
    }
  })
})

const maxScore = computed(() => Math.max(...last7Days.value.map(d => d.score), 1))
</script>

<template>
  <div class="h-full overflow-y-auto">
    <div class="max-w-5xl mx-auto px-6 py-8 space-y-8">

      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-zinc-100">Analytics</h1>
          <p class="text-sm text-zinc-500 mt-0.5">Track your productivity patterns over time</p>
        </div>
        <BaseButton
          variant="ghost"
          size="sm"
          :disabled="analyticsStore.loading"
          @click="analyticsStore.runAnalysis()"
        >
          <LoadingSpinner v-if="analyticsStore.loading" size="sm" class="mr-1.5" />
          <svg v-else class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Run analysis
        </BaseButton>
      </div>

      <!-- Key metrics -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <BaseCard class="p-5 text-center">
          <p class="text-4xl font-bold text-zinc-100 mb-1">{{ analyticsStore.productivityScore }}</p>
          <p class="text-xs text-zinc-500 uppercase tracking-wide">7-day avg score</p>
          <p class="text-xs mt-1" :class="deltaColor">
            {{ deltaPrefix }}{{ analyticsStore.weekOverWeekDelta }} vs last week
          </p>
        </BaseCard>

        <BaseCard class="p-5 text-center">
          <p class="text-4xl font-bold text-zinc-100 mb-1">{{ analyticsStore.completionRate }}%</p>
          <p class="text-xs text-zinc-500 uppercase tracking-wide">Task completion rate</p>
          <p class="text-xs text-zinc-600 mt-1">Last 7 days</p>
        </BaseCard>

        <BaseCard class="p-5 text-center">
          <p class="text-4xl font-bold text-zinc-100 mb-1">
            {{ habitStore.habitsWithStreak.filter(h => h.streak.current > 0).length }}
          </p>
          <p class="text-xs text-zinc-500 uppercase tracking-wide">Active streaks</p>
          <p class="text-xs text-zinc-600 mt-1">
            {{ habitStore.activeHabits.length }} habits tracked
          </p>
        </BaseCard>
      </div>

      <!-- Productivity chart (last 7 days) -->
      <BaseCard class="p-5">
        <h2 class="text-sm font-semibold text-zinc-300 mb-4">Daily Score — Last 7 Days</h2>
        <div v-if="analyticsStore.dailyScores.length > 0" class="flex items-end gap-2 h-32">
          <div
            v-for="day in last7Days"
            :key="day.date"
            class="flex-1 flex flex-col items-center gap-1"
          >
            <div class="w-full flex items-end justify-center" style="height: 96px;">
              <div
                class="w-full rounded-t-lg transition-all duration-500"
                :class="day.score > 0 ? 'bg-indigo-500/60' : 'bg-zinc-800/40'"
                :style="{ height: `${Math.max(4, (day.score / maxScore) * 96)}px` }"
                :title="`${day.date}: ${day.score}`"
              />
            </div>
            <span class="text-[10px] text-zinc-600">{{ day.label }}</span>
          </div>
        </div>
        <div v-else class="h-32 flex items-center justify-center text-zinc-600 text-sm">
          No data yet — run an analysis to generate insights
        </div>
      </BaseCard>

      <!-- Shortcomings -->
      <div v-if="analyticsStore.shortcomings.length > 0">
        <h2 class="text-sm font-semibold text-zinc-300 mb-3">Identified Shortcomings</h2>
        <div class="space-y-3">
          <BaseCard
            v-for="item in analyticsStore.shortcomings"
            :key="item.id"
            class="p-4 border"
            :class="severityColor[item.severity]"
          >
            <div class="flex items-start gap-3">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <h3 class="text-sm font-semibold">{{ item.title }}</h3>
                  <span class="text-[10px] uppercase tracking-wide font-medium px-1.5 py-0.5 rounded-md border border-current/30 opacity-70">
                    {{ item.severity }}
                  </span>
                </div>
                <p class="text-xs leading-relaxed opacity-80">{{ item.description }}</p>
                <ul v-if="item.suggestions.length" class="mt-2 space-y-1">
                  <li v-for="s in item.suggestions" :key="s" class="text-xs opacity-70 flex gap-1.5">
                    <span class="opacity-50">→</span>
                    {{ s }}
                  </li>
                </ul>
              </div>
            </div>
          </BaseCard>
        </div>
      </div>

      <!-- Pattern insights -->
      <div v-if="analyticsStore.patternInsights.length > 0">
        <h2 class="text-sm font-semibold text-zinc-300 mb-3">Pattern Insights</h2>
        <div class="space-y-2">
          <BaseCard
            v-for="insight in analyticsStore.patternInsights"
            :key="insight.id"
            class="p-4 flex items-start gap-3"
          >
            <div class="w-6 h-6 rounded-lg bg-violet-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg class="w-3.5 h-3.5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm text-zinc-200">{{ insight.text }}</p>
              <p v-if="insight.actionPrompt" class="text-xs text-indigo-400 mt-1">{{ insight.actionPrompt }}</p>
            </div>
          </BaseCard>
        </div>
      </div>

      <!-- Empty state -->
      <div
        v-if="!analyticsStore.loading && analyticsStore.dailyScores.length === 0 && analyticsStore.shortcomings.length === 0"
        class="text-center py-16 text-zinc-600"
      >
        <svg class="w-12 h-12 mx-auto mb-4 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p class="text-sm">No analytics data yet</p>
        <p class="text-xs text-zinc-700 mt-1">Use the app for a few days, then run an analysis.</p>
      </div>

    </div>
  </div>
</template>
