<script setup lang="ts">
import { computed, ref } from 'vue'
import type { HabitEntry } from '@/types/habit'
import { format, eachDayOfInterval, subMonths, startOfMonth, endOfMonth, getDay } from 'date-fns'

const props = defineProps<{
  habitId: string
  entries: HabitEntry[]
  months?: number
}>()

const tooltip = ref<{ date: string; status: string; x: number; y: number } | null>(null)

const endDate = new Date()
const startDate = subMonths(startOfMonth(endDate), (props.months ?? 3) - 1)

const allDays = computed(() =>
  eachDayOfInterval({ start: startDate, end: endDate })
)

const entryMap = computed(() => {
  const map: Record<string, HabitEntry> = {}
  props.entries.forEach(e => { map[e.date] = e })
  return map
})

const dayStatus = (date: Date): 'done' | 'partial' | 'missed' | 'skipped' | 'future' => {
  const key = format(date, 'yyyy-MM-dd')
  const today = format(new Date(), 'yyyy-MM-dd')
  if (key > today) return 'future'
  const entry = entryMap.value[key]
  if (!entry) return 'missed'
  if (entry.completed) return 'done'
  if (entry.count > 0) return 'partial'
  return 'skipped'
}

const statusColor: Record<string, string> = {
  done:    'bg-indigo-500',
  partial: 'bg-indigo-300/60',
  missed:  'bg-zinc-700/60',
  skipped: 'bg-zinc-800/40',
  future:  'bg-zinc-900/40',
}

const statusLabel: Record<string, string> = {
  done:    'Completed',
  partial: 'Partial',
  missed:  'Missed',
  skipped: 'Skipped',
  future:  'Upcoming',
}

function showTooltip(e: MouseEvent, date: Date) {
  const rect = (e.target as HTMLElement).getBoundingClientRect()
  tooltip.value = {
    date: format(date, 'MMM d, yyyy'),
    status: statusLabel[dayStatus(date)],
    x: rect.left,
    y: rect.top,
  }
}

function hideTooltip() {
  tooltip.value = null
}

// Group by week for grid rendering
const weeks = computed(() => {
  const result: Date[][] = []
  let week: Date[] = []

  // Pad start with nulls to align to Sunday
  const startPad = getDay(allDays.value[0])
  for (let i = 0; i < startPad; i++) week.push(null as any)

  for (const day of allDays.value) {
    week.push(day)
    if (week.length === 7) {
      result.push(week)
      week = []
    }
  }
  if (week.length) {
    while (week.length < 7) week.push(null as any)
    result.push(week)
  }
  return result
})

const monthLabels = computed(() => {
  const seen = new Set<string>()
  return allDays.value
    .filter(d => {
      const m = format(d, 'MMM')
      if (!seen.has(m)) { seen.add(m); return true }
      return false
    })
    .map(d => ({ label: format(d, 'MMM'), dayIndex: allDays.value.indexOf(d) }))
})
</script>

<template>
  <div class="relative select-none" role="img" :aria-label="`Habit streak calendar for last ${months ?? 3} months`">
    <!-- Days of week header -->
    <div class="flex gap-0.5 mb-1 pl-0">
      <div
        v-for="day in ['S','M','T','W','T','F','S']"
        :key="day"
        class="w-3 h-3 text-[9px] text-zinc-600 flex items-center justify-center"
      >{{ day }}</div>
    </div>

    <!-- Grid -->
    <div class="flex gap-0.5">
      <div
        v-for="(week, wi) in weeks"
        :key="wi"
        class="flex flex-col gap-0.5"
      >
        <div
          v-for="(day, di) in week"
          :key="di"
          class="w-3 h-3 rounded-sm transition-colors duration-100 cursor-default"
          :class="day ? statusColor[dayStatus(day)] : 'bg-transparent'"
          :aria-label="day ? `${format(day, 'MMM d')}: ${statusLabel[dayStatus(day)]}` : undefined"
          @mouseenter="day && showTooltip($event, day)"
          @mouseleave="hideTooltip"
        />
      </div>
    </div>

    <!-- Legend -->
    <div class="flex items-center gap-2 mt-2">
      <span class="text-[10px] text-zinc-600">Less</span>
      <div
        v-for="s in ['missed', 'partial', 'done'] as const"
        :key="s"
        class="w-2.5 h-2.5 rounded-sm"
        :class="statusColor[s]"
        :title="statusLabel[s]"
      />
      <span class="text-[10px] text-zinc-600">More</span>
    </div>

    <!-- Tooltip -->
    <Teleport to="body">
      <div
        v-if="tooltip"
        class="fixed z-50 px-2.5 py-1.5 bg-zinc-800 border border-zinc-700/50 rounded-lg text-xs text-zinc-200 shadow-lg pointer-events-none"
        :style="{ left: `${tooltip.x}px`, top: `${tooltip.y - 36}px` }"
        role="tooltip"
      >
        <span class="font-medium">{{ tooltip.date }}</span> — {{ tooltip.status }}
      </div>
    </Teleport>
  </div>
</template>
