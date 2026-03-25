<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { useCalendarStore } from '@/stores/calendar'
import { useAppStore } from '@/stores/app'

const calendar = useCalendarStore()
const app = useAppStore()
const tooltipVisible = ref(false)

const statusConfig = computed(() => {
  switch (calendar.syncState) {
    case 'idle':
      return { dot: 'bg-emerald-400', label: 'Synced', textColor: 'text-emerald-400' }
    case 'syncing':
      return { dot: 'bg-amber-400 animate-pulse', label: 'Syncing...', textColor: 'text-amber-400' }
    case 'error':
      return { dot: 'bg-rose-400', label: 'Sync error', textColor: 'text-rose-400' }
    case 'unauthorized':
      return { dot: 'bg-zinc-500', label: 'Not connected', textColor: 'text-zinc-500' }
    default:
      return { dot: 'bg-zinc-600', label: 'Unknown', textColor: 'text-zinc-500' }
  }
})

const lastSyncText = computed(() => {
  if (!calendar.lastSync) return 'Never synced'
  return `Last synced ${formatDistanceToNow(parseISO(calendar.lastSync), { addSuffix: true })}`
})

async function handleClick() {
  if (calendar.syncState === 'syncing') return
  await calendar.syncWithGoogle()
}
</script>

<template>
  <div class="relative">
    <button
      @click="handleClick"
      @mouseenter="tooltipVisible = true"
      @mouseleave="tooltipVisible = false"
      class="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition-all duration-150 hover:bg-zinc-800/60"
      :aria-label="`Calendar sync: ${statusConfig.label}. Click to sync.`"
      :aria-busy="calendar.syncState === 'syncing'"
    >
      <span
        class="w-1.5 h-1.5 rounded-full flex-shrink-0"
        :class="statusConfig.dot"
        aria-hidden="true"
      />
      <span :class="statusConfig.textColor">{{ statusConfig.label }}</span>
    </button>

    <!-- Tooltip -->
    <Teleport to="body">
      <div
        v-if="tooltipVisible"
        class="fixed z-50 px-2.5 py-1.5 bg-zinc-800 border border-zinc-700/50 rounded-lg text-xs text-zinc-300 shadow-lg pointer-events-none whitespace-nowrap"
        style="bottom: calc(100vh - 48px); right: 80px;"
        role="tooltip"
      >
        {{ lastSyncText }}
        <br />
        <span class="text-zinc-500">Click to force sync</span>
      </div>
    </Teleport>
  </div>
</template>
