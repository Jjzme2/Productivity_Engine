<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Priority } from '@/types/task'

const props = defineProps<{
  priority: Priority
  size?: 'sm' | 'md' | 'lg'
}>()

const tooltipVisible = ref(false)

const config = computed(() => ({
  urgent: {
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    label: 'Urgent',
    path: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  },
  high: {
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    label: 'High',
    path: 'M5 15l7-7 7 7',
  },
  medium: {
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    label: 'Medium',
    path: 'M20 12H4',
  },
  low: {
    color: 'text-sky-400',
    bg: 'bg-sky-500/10',
    label: 'Low',
    path: 'M19 9l-7 7-7-7',
  },
}[props.priority]))

const sizeClass: Record<string, string> = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
}

const wrapClass: Record<string, string> = {
  sm: 'w-5 h-5 rounded-md',
  md: 'w-6 h-6 rounded-lg',
  lg: 'w-7 h-7 rounded-xl',
}
</script>

<template>
  <div class="relative inline-flex">
    <div
      class="flex items-center justify-center flex-shrink-0"
      :class="[config.bg, wrapClass[size ?? 'md'], config.color]"
      :aria-label="`Priority: ${config.label}`"
      role="img"
      @mouseenter="tooltipVisible = true"
      @mouseleave="tooltipVisible = false"
      @focusin="tooltipVisible = true"
      @focusout="tooltipVisible = false"
      tabindex="0"
    >
      <svg
        :class="sizeClass[size ?? 'md']"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path stroke-linecap="round" stroke-linejoin="round" :d="config.path" />
      </svg>
    </div>

    <!-- Tooltip -->
    <div
      v-if="tooltipVisible"
      class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-lg bg-zinc-800 border border-zinc-700/50 text-xs text-zinc-200 whitespace-nowrap shadow-lg z-50 pointer-events-none"
      role="tooltip"
    >
      {{ config.label }} priority
      <div class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-800" />
    </div>
  </div>
</template>
