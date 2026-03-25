<script setup lang="ts">
import { computed } from 'vue'
import { format, parseISO } from 'date-fns'
import type { CalendarEvent } from '@/types/event'

const props = defineProps<{
  event: CalendarEvent
  compact?: boolean
}>()

const timeRange = computed(() => {
  if (props.event.isAllDay) return 'All day'
  const start = format(parseISO(props.event.startTime), 'h:mm a')
  const end = format(parseISO(props.event.endTime), 'h:mm a')
  return `${start} – ${end}`
})

const isGoogleEvent = computed(() => Boolean(props.event.googleEventId))
const eventColor = computed(() => props.event.color ?? '#6366f1')
</script>

<template>
  <div
    class="relative flex items-stretch rounded-xl overflow-hidden border border-zinc-800/40 bg-zinc-900/60 transition-all duration-150 hover:border-zinc-700/60"
    :class="compact ? 'min-h-[36px]' : 'min-h-[52px]'"
    role="article"
    :aria-label="`Event: ${event.title}, ${timeRange}`"
  >
    <!-- Color bar -->
    <div
      class="w-1 flex-shrink-0"
      :style="{ backgroundColor: eventColor }"
      aria-hidden="true"
    />

    <!-- Content -->
    <div class="flex-1 px-2.5 py-1.5 min-w-0">
      <div class="flex items-center gap-1.5">
        <!-- Google Calendar icon -->
        <svg
          v-if="isGoogleEvent"
          class="w-3 h-3 flex-shrink-0 opacity-60"
          viewBox="0 0 24 24"
          aria-label="Google Calendar event"
        >
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>

        <p
          class="font-medium truncate"
          :class="compact ? 'text-[11px] text-zinc-200' : 'text-xs text-zinc-100'"
        >
          {{ event.title }}
        </p>
      </div>

      <div v-if="!compact" class="flex items-center gap-2 mt-0.5">
        <p class="text-[10px] text-zinc-500">{{ timeRange }}</p>
        <p v-if="event.location" class="text-[10px] text-zinc-600 truncate">
          · {{ event.location }}
        </p>
      </div>
    </div>
  </div>
</template>
