<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  startOfWeek, addDays, format, parseISO, isToday,
  differenceInMinutes, addWeeks, subWeeks, eachHourOfInterval,
  startOfDay, endOfDay, getHours, getMinutes,
} from 'date-fns'
import type { CalendarEvent } from '@/types/event'
import { useCalendarStore } from '@/stores/calendar'
import EventCard from './EventCard.vue'
import CalendarSyncBadge from './CalendarSyncBadge.vue'

const emit = defineEmits<{
  eventClick: [id: string]
  slotClick: [time: string]
  createEvent: [time: string]
}>()

const calendarStore = useCalendarStore()

const currentWeekStart = ref(startOfWeek(new Date(), { weekStartsOn: 0 }))
const hours = Array.from({ length: 24 }, (_, i) => i)

const weekDays = computed(() =>
  Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart.value, i))
)

function prevWeek() {
  currentWeekStart.value = subWeeks(currentWeekStart.value, 1)
}

function nextWeek() {
  currentWeekStart.value = addWeeks(currentWeekStart.value, 1)
}

function goToday() {
  currentWeekStart.value = startOfWeek(new Date(), { weekStartsOn: 0 })
}

// Position an event on the grid
function eventStyle(event: CalendarEvent) {
  const start = parseISO(event.startTime)
  const end = parseISO(event.endTime)
  const topMinutes = getHours(start) * 60 + getMinutes(start)
  const durationMinutes = Math.max(30, differenceInMinutes(end, start))
  const hourHeight = 56 // px per hour
  return {
    top: `${(topMinutes / 60) * hourHeight}px`,
    height: `${(durationMinutes / 60) * hourHeight}px`,
  }
}

function eventsForDay(day: Date): CalendarEvent[] {
  const key = format(day, 'yyyy-MM-dd')
  return calendarStore.events.filter(e =>
    !e.isAllDay && e.startTime.slice(0, 10) === key
  )
}

// Current time indicator
const currentTimeTop = computed(() => {
  const now = new Date()
  const minutes = getHours(now) * 60 + getMinutes(now)
  return `${(minutes / 60) * 56}px`
})

function handleSlotClick(day: Date, hour: number) {
  const time = new Date(day)
  time.setHours(hour, 0, 0, 0)
  emit('slotClick', time.toISOString())
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Navigation header -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-zinc-800/50">
      <div class="flex items-center gap-2">
        <button
          @click="prevWeek"
          class="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 transition-all duration-150"
          aria-label="Previous week"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <h2 class="text-sm font-semibold text-zinc-200">
          {{ format(currentWeekStart, 'MMMM yyyy') }}
        </h2>

        <button
          @click="nextWeek"
          class="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 transition-all duration-150"
          aria-label="Next week"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div class="flex items-center gap-2">
        <CalendarSyncBadge />
        <button
          @click="goToday"
          class="px-3 py-1.5 rounded-xl text-xs font-medium bg-zinc-800/60 border border-zinc-700/40 text-zinc-300 hover:text-zinc-100 transition-all duration-150"
        >
          Today
        </button>
      </div>
    </div>

    <!-- Day headers -->
    <div class="grid grid-cols-[56px_repeat(7,1fr)] border-b border-zinc-800/50">
      <div class="border-r border-zinc-800/30" />
      <div
        v-for="day in weekDays"
        :key="day.toISOString()"
        class="flex flex-col items-center py-2 border-r border-zinc-800/30 last:border-r-0"
      >
        <span class="text-xs text-zinc-500 uppercase">{{ format(day, 'EEE') }}</span>
        <span
          class="text-sm font-semibold mt-0.5 w-7 h-7 flex items-center justify-center rounded-full transition-colors"
          :class="isToday(day) ? 'bg-indigo-500 text-white' : 'text-zinc-200'"
        >
          {{ format(day, 'd') }}
        </span>
      </div>
    </div>

    <!-- Time grid -->
    <div class="flex-1 overflow-y-auto relative">
      <div class="grid grid-cols-[56px_repeat(7,1fr)]">
        <!-- Hour rows -->
        <template v-for="hour in hours" :key="hour">
          <!-- Hour label -->
          <div class="h-14 border-r border-zinc-800/30 flex items-start justify-end pr-2 pt-0.5">
            <span class="text-[10px] text-zinc-600 font-mono">
              {{ hour === 0 ? '' : format(new Date().setHours(hour, 0), 'h a') }}
            </span>
          </div>

          <!-- Day cells -->
          <div
            v-for="day in weekDays"
            :key="`${day.toISOString()}-${hour}`"
            class="h-14 border-r border-b border-zinc-800/20 last:border-r-0 hover:bg-zinc-800/10 cursor-pointer transition-colors duration-100"
            @click="handleSlotClick(day, hour)"
            :aria-label="`${format(day, 'EEE d')} at ${format(new Date().setHours(hour, 0), 'h:mm a')}`"
          />
        </template>

        <!-- Events overlay -->
        <div class="col-start-2 col-span-7 row-start-1 row-span-24 grid grid-cols-7 pointer-events-none relative">
          <template v-for="(day, di) in weekDays" :key="di">
            <div class="relative">
              <!-- Events for this day -->
              <div
                v-for="event in eventsForDay(day)"
                :key="event.id"
                class="absolute left-0.5 right-0.5 rounded-lg overflow-hidden cursor-pointer pointer-events-auto z-10"
                :style="eventStyle(event)"
                @click.stop="emit('eventClick', event.id)"
              >
                <EventCard :event="event" compact />
              </div>

              <!-- Current time indicator (today only) -->
              <div
                v-if="isToday(day)"
                class="absolute left-0 right-0 flex items-center z-20 pointer-events-none"
                :style="{ top: currentTimeTop }"
                aria-hidden="true"
              >
                <div class="w-2 h-2 rounded-full bg-rose-500 -ml-1" />
                <div class="flex-1 h-px bg-rose-500/60" />
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
