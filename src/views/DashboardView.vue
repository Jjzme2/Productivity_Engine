<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useTaskStore } from '@/stores/tasks'
import { useHabitStore } from '@/stores/habits'
import { useCalendarStore } from '@/stores/calendar'
import { useAppStore } from '@/stores/app'
import { useFinanceStore } from '@/stores/finance'
import { useImportantDatesStore } from '@/stores/dates'
import NlpInput from '@/components/nlp/NlpInput.vue'
import IntentConfirm from '@/components/nlp/IntentConfirm.vue'
import TaskCard from '@/components/tasks/TaskCard.vue'
import HabitCard from '@/components/habits/HabitCard.vue'
import BaseCard from '@/components/shared/BaseCard.vue'
import EmptyState from '@/components/shared/EmptyState.vue'
import { parseNlpIntent } from '@/services/tauriClient'
import { sanitizeInput, buildUserContext } from '@/services/nlpPipeline'
import { useNlpStore } from '@/stores/useNlpStore'
import type { ParsedIntent } from '@/types/nlp'

const router = useRouter()
const taskStore = useTaskStore()
const habitStore = useHabitStore()
const calendarStore = useCalendarStore()
const app = useAppStore()
const financeStore = useFinanceStore()
const datesStore = useImportantDatesStore()
const nlpStore = useNlpStore()

// ── NLP intent ────────────────────────────────────────────────────────────────
const pendingIntent = ref<{ summary: string; confidence: number; actionType: string } | null>(null)
const fullIntent = ref<ParsedIntent | null>(null)
const isParsingNlp = ref(false)

// Maps ParsedIntent action strings to the actionType expected by IntentConfirm
function actionToType(action: string): string {
  if (action.includes('habit')) return 'habit'
  if (action.includes('note')) return 'note'
  if (action.includes('event') || action === 'query_calendar') return 'event'
  return 'task'
}

async function handleNlpSubmit(text: string) {
  const sanitized = sanitizeInput(text)
  if (!sanitized) return

  isParsingNlp.value = true
  pendingIntent.value = null
  fullIntent.value = null

  try {
    const context = buildUserContext({
      taskStore,
      habitStore,
      nlpStore,
      appStore: app,
    })
    const intent = await parseNlpIntent({ rawInput: sanitized, userContext: context })
    fullIntent.value = intent
    pendingIntent.value = {
      summary: intent.interpretation || sanitized,
      confidence: intent.confidence,
      actionType: actionToType(intent.action),
    }
  } catch {
    // Fallback: simple keyword classification when backend is unavailable
    const lower = sanitized.toLowerCase()
    let actionType = 'task'
    if (lower.includes('habit') || lower.includes('daily') || lower.includes('track')) actionType = 'habit'
    else if (lower.includes('note') || lower.includes('write')) actionType = 'note'
    else if (lower.includes('event') || lower.includes('meeting') || lower.includes('schedule')) actionType = 'event'
    pendingIntent.value = { summary: sanitized, confidence: 0.6, actionType }
  } finally {
    isParsingNlp.value = false
  }
}

function confirmIntent() {
  if (!pendingIntent.value) return
  const { actionType, summary } = pendingIntent.value
  if (actionType === 'task') {
    const title = fullIntent.value?.entities.title ?? summary
    taskStore.createTask({ title, tags: fullIntent.value?.entities.tags ?? [] })
    app.addToast({ message: 'Task created', variant: 'success' })
  } else {
    router.push(`/${actionType === 'event' ? 'calendar' : actionType + 's'}`)
  }
  pendingIntent.value = null
  fullIntent.value = null
}

// ── Today's data ──────────────────────────────────────────────────────────────
const todayTasks = computed(() => taskStore.todayTasks.slice(0, 6))

const habitsRemaining = computed(() =>
  habitStore.habitsWithStreak.filter(h => !h.todayEntry?.completed).slice(0, 4)
)

const upcomingEvents = computed(() => {
  const now = new Date().toISOString()
  return calendarStore.eventsToday.filter(e => e.startTime >= now).slice(0, 4)
})

const habitProgressPercent = computed(() => {
  const total = habitStore.habitsWithStreak.length
  if (!total) return 0
  const done = habitStore.habitsWithStreak.filter(h => h.todayEntry?.completed).length
  return Math.round((done / total) * 100)
})

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
})

const todayLabel = computed(() =>
  new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
)

function formatEventTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
</script>

<template>
  <div class="relative z-0 h-full overflow-y-auto">
    <div class="max-w-5xl mx-auto px-6 py-8 space-y-8">

      <!-- Header -->
      <div>
        <h1 class="text-2xl font-bold text-zinc-100">{{ greeting }}</h1>
        <p class="text-sm text-zinc-500 mt-0.5">{{ todayLabel }}</p>
      </div>

      <!-- NLP input -->
      <BaseCard class="p-4">
        <NlpInput @submit="handleNlpSubmit" />
        <!-- Parsing indicator -->
        <div v-if="isParsingNlp" class="mt-3 flex items-center gap-2 text-xs text-zinc-500">
          <svg class="w-3.5 h-3.5 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          <span>Parsing intent…</span>
        </div>
        <!-- Intent confirmation -->
        <div v-else-if="pendingIntent" class="mt-3">
          <IntentConfirm
            :summary="pendingIntent.summary"
            :confidence="pendingIntent.confidence"
            :action-type="pendingIntent.actionType"
            @confirm="confirmIntent"
            @edit="pendingIntent = null; fullIntent = null"
            @dismiss="pendingIntent = null; fullIntent = null"
          />
        </div>
      </BaseCard>

      <!-- Stats row -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <BaseCard class="p-4 flex items-center gap-4">
          <div class="w-10 h-10 rounded-xl bg-indigo-500/15 flex items-center justify-center flex-shrink-0">
            <svg class="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <div>
            <p class="text-2xl font-bold text-zinc-100">{{ taskStore.todayTasks.length }}</p>
            <p class="text-xs text-zinc-500">Tasks due today</p>
          </div>
        </BaseCard>

        <BaseCard class="p-4 flex items-center gap-4">
          <div class="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
            <svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div class="flex-1">
            <p class="text-2xl font-bold text-zinc-100">{{ habitProgressPercent }}%</p>
            <p class="text-xs text-zinc-500">Habits complete</p>
            <div class="h-1.5 w-full bg-zinc-800 rounded-full mt-1.5 overflow-hidden">
              <div class="h-full rounded-full bg-emerald-500 transition-all duration-500"
                :style="{ width: `${habitProgressPercent}%` }" />
            </div>
          </div>
        </BaseCard>

        <BaseCard class="p-4 flex items-center gap-4">
          <div class="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center flex-shrink-0">
            <svg class="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p class="text-2xl font-bold text-zinc-100">{{ calendarStore.eventsToday.length }}</p>
            <p class="text-xs text-zinc-500">Events today</p>
          </div>
        </BaseCard>
      </div>

      <!-- Main content grid -->
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">

        <!-- Today's tasks -->
        <div>
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Today's tasks</h2>
            <router-link to="/tasks" class="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
              View all
            </router-link>
          </div>
          <div class="space-y-2">
            <TaskCard
              v-for="task in todayTasks"
              :key="task.id"
              :task="task"
              @click="$router.push('/tasks')"
              @complete="taskStore.completeTask($event)"
              @delete="taskStore.deleteTask($event)"
              @edit="$router.push('/tasks')"
            />
            <EmptyState v-if="todayTasks.length === 0" title="No tasks due today"
              description="Type a task in the input above to get started." />
          </div>
        </div>

        <!-- Habits + Events -->
        <div class="space-y-6">
          <div v-if="habitsRemaining.length > 0">
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Habits remaining</h2>
              <router-link to="/habits" class="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                View all
              </router-link>
            </div>
            <div class="space-y-2">
              <HabitCard
                v-for="h in habitsRemaining"
                :key="h.id"
                :habit="h"
                :entry="h.todayEntry ?? null"
                :streak="h.streak"
                @click="$router.push('/habits')"
              />
            </div>
          </div>

          <div>
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Upcoming events</h2>
              <router-link to="/calendar" class="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                Calendar
              </router-link>
            </div>
            <div v-if="upcomingEvents.length > 0" class="space-y-2">
              <BaseCard v-for="event in upcomingEvents" :key="event.id" class="p-3 flex items-center gap-3">
                <div class="w-1 self-stretch rounded-full flex-shrink-0"
                  :style="{ background: event.color ?? '#8b5cf6' }" />
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-zinc-100 truncate">{{ event.title }}</p>
                  <p class="text-xs text-zinc-500">{{ formatEventTime(event.startTime) }}</p>
                </div>
              </BaseCard>
            </div>
            <EmptyState v-else title="No upcoming events"
              description="Connect Google Calendar to see your schedule." />
          </div>
        </div>
      </div>

      <!-- Finance + Important Dates row -->
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">

        <!-- Finance snapshot -->
        <div>
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Finance this month</h2>
            <router-link to="/finance" class="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
              View all
            </router-link>
          </div>
          <BaseCard class="p-4 space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs text-zinc-500">Income</span>
              <span class="text-sm font-semibold text-emerald-400">
                +{{ new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(financeStore.totalIncome) }}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-xs text-zinc-500">Expenses</span>
              <span class="text-sm font-semibold text-rose-400">
                -{{ new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(financeStore.totalExpenses) }}
              </span>
            </div>
            <div class="h-px bg-zinc-800/60" />
            <div class="flex items-center justify-between">
              <span class="text-xs text-zinc-400 font-medium">Net cash flow</span>
              <span
                class="text-sm font-bold"
                :class="financeStore.netCashFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'"
              >
                {{ financeStore.netCashFlow >= 0 ? '+' : '' }}{{ new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(financeStore.netCashFlow) }}
              </span>
            </div>
          </BaseCard>
        </div>

        <!-- Important dates -->
        <div>
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Coming up</h2>
            <router-link to="/dates" class="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
              All dates
            </router-link>
          </div>
          <div v-if="datesStore.thisWeekDates.length > 0" class="space-y-2">
            <BaseCard
              v-for="d in datesStore.thisWeekDates.slice(0, 4)"
              :key="d.id"
              class="p-3 flex items-center gap-3"
            >
              <span class="text-xl flex-shrink-0">
                {{ { birthday: '🎂', anniversary: '💍', deadline: '⏰', holiday: '🎉', appointment: '📅', reminder: '🔔', custom: '📌' }[d.category] }}
              </span>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-zinc-100 truncate">{{ d.title }}</p>
                <p class="text-xs text-zinc-500">{{ d.linkedContactName ? d.linkedContactName + ' · ' : '' }}{{ d.daysUntil === 0 ? 'Today!' : d.daysUntil === 1 ? 'Tomorrow' : d.daysUntil + ' days' }}</p>
              </div>
              <span
                class="text-[10px] font-medium px-1.5 py-0.5 rounded-md"
                :class="d.daysUntil === 0 ? 'bg-rose-500/20 text-rose-300' : d.daysUntil <= 3 ? 'bg-amber-500/20 text-amber-300' : 'bg-zinc-800/60 text-zinc-500'"
              >
                {{ d.daysUntil === 0 ? 'Today' : d.daysUntil + 'd' }}
              </span>
            </BaseCard>
          </div>
          <EmptyState v-else title="No dates this week" description="Add birthdays, anniversaries and reminders." />
        </div>

      </div>

    </div>
  </div>
</template>
