<script setup lang="ts">
import { computed, ref } from 'vue'
import { format } from 'date-fns'
import { useAppStore } from '@/stores/app'
import { useSyncStore } from '@/stores/useSyncStore'
import CalendarSyncBadge from '@/components/calendar/CalendarSyncBadge.vue'

const app  = useAppStore()
const sync = useSyncStore()
const notifCount = ref(0)

const today = computed(() => format(new Date(), 'EEEE, MMMM d'))

const aiProviderLabel = computed(() => {
  const map: Record<string, string> = {
    claude: 'Claude',
    ollama: 'Ollama',
    openai: 'GPT-4o',
    gemini: 'Gemini',
  }
  return map[app.aiProvider] ?? app.aiProvider
})

const aiProviderColor = computed(() => ({
  claude: 'bg-violet-500/15 text-violet-300 border-violet-500/20',
  ollama: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  openai: 'bg-teal-500/15 text-teal-300 border-teal-500/20',
  gemini: 'bg-blue-500/15 text-blue-300 border-blue-500/20',
}[app.aiProvider] ?? 'bg-zinc-700/40 text-zinc-300 border-zinc-600/30'))
</script>

<template>
  <header
    class="h-12 flex items-center justify-between px-4 bg-zinc-900 border-b border-zinc-800/50 flex-shrink-0 z-10"
    role="banner"
  >
    <!-- Date -->
    <div class="flex items-center gap-3">
      <time
        :datetime="new Date().toISOString().slice(0, 10)"
        class="text-sm font-medium text-zinc-300"
      >
        {{ today }}
      </time>
    </div>

    <!-- Right cluster -->
    <div class="flex items-center gap-2">
      <!-- Calendar sync badge -->
      <CalendarSyncBadge />

      <!-- Offline / pending sync indicator -->
      <button
        v-if="!sync.online || sync.pendingCount > 0"
        @click="sync.online && sync.flush()"
        :disabled="sync.isFlushing"
        :title="sync.online
          ? `${sync.pendingCount} change(s) pending upload — click to sync now`
          : 'Offline — changes saved locally'"
        class="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium border transition-all duration-150"
        :class="sync.online
          ? 'bg-amber-500/15 text-amber-300 border-amber-500/20 hover:bg-amber-500/25 cursor-pointer'
          : 'bg-zinc-700/40 text-zinc-400 border-zinc-600/30 cursor-default'"
        :aria-label="sync.online ? 'Sync pending changes' : 'Offline mode'"
      >
        <!-- Spinner while flushing -->
        <svg v-if="sync.isFlushing" class="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
        <!-- Offline icon -->
        <svg v-else-if="!sync.online" class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M3 3l18 18M9.879 9.879A3 3 0 0012 15a3 3 0 002.121-.879"/>
        </svg>
        <!-- Upload icon -->
        <svg v-else class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
        </svg>
        <span v-if="sync.online && sync.pendingCount > 0">{{ sync.pendingCount }}</span>
        <span v-else-if="!sync.online">Offline</span>
      </button>

      <!-- AI provider chip -->
      <div
        class="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium border"
        :class="aiProviderColor"
        :title="`AI Provider: ${aiProviderLabel}`"
        role="status"
        :aria-label="`AI Provider: ${aiProviderLabel}`"
      >
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
        </svg>
        {{ aiProviderLabel }}
      </div>

      <!-- Notification bell -->
      <button
        class="relative w-8 h-8 flex items-center justify-center rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 transition-all duration-150"
        aria-label="Notifications"
        :aria-describedby="notifCount > 0 ? 'notif-count' : undefined"
      >
        <svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        <span
          v-if="notifCount > 0"
          id="notif-count"
          class="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center"
          aria-label="`${notifCount} notifications`"
        >
          {{ notifCount > 9 ? '9+' : notifCount }}
        </span>
      </button>

      <!-- Focus mode toggle -->
      <button
        @click="app.toggleFocusMode"
        class="w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-150"
        :class="app.focusMode
          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
          : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60'"
        :aria-label="app.focusMode ? 'Exit focus mode' : 'Enter focus mode'"
        :aria-pressed="app.focusMode"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      </button>
    </div>
  </header>
</template>
