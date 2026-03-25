<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCalendarStore } from '@/stores/calendar'
import { useAppStore } from '@/stores/app'
import CalendarViewComponent from '@/components/calendar/CalendarView.vue'
import BaseModal from '@/components/shared/BaseModal.vue'
import BaseButton from '@/components/shared/BaseButton.vue'

const calendarStore = useCalendarStore()
const app = useAppStore()

const showCreateModal = ref(false)
const newEvent = ref({ title: '', startTime: '', endTime: '' })

function handleSlotClick(time: string) {
  const start = new Date(time)
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  newEvent.value = {
    title: '',
    startTime: start.toISOString().slice(0, 16),
    endTime: end.toISOString().slice(0, 16),
  }
  showCreateModal.value = true
}

function handleCreateEvent(time: string) {
  handleSlotClick(time)
}

function submitEvent() {
  if (!newEvent.value.title.trim()) return
  calendarStore.createEvent({
    title: newEvent.value.title,
    startTime: new Date(newEvent.value.startTime).toISOString(),
    endTime: new Date(newEvent.value.endTime).toISOString(),
  })
  app.addToast({ message: 'Event created', variant: 'success' })
  showCreateModal.value = false
  newEvent.value = { title: '', startTime: '', endTime: '' }
}

async function handleConnect() {
  try {
    await calendarStore.connectGoogleCalendar()
    app.addToast({ message: 'Google Calendar connected!', variant: 'success' })
    // Kick off the first sync right away
    await calendarStore.syncCalendar()
  } catch (err: any) {
    const msg = err?.message ?? String(err)
    app.addToast({ message: `Connection failed: ${msg}`, variant: 'error' })
  }
}

async function handleSync() {
  try {
    await calendarStore.syncCalendar()
    if (calendarStore.syncErrors.length) {
      app.addToast({ message: `Synced with ${calendarStore.syncErrors.length} error(s)`, variant: 'warning' })
    } else {
      app.addToast({ message: 'Calendar synced', variant: 'success' })
    }
  } catch (err: any) {
    app.addToast({ message: `Sync failed: ${err?.message ?? err}`, variant: 'error' })
  }
}

async function handleDisconnect() {
  await calendarStore.disconnectGoogleCalendar()
  app.addToast({ message: 'Google Calendar disconnected', variant: 'info' })
}

const copyLinkLabel = ref('Copy link')

async function copyAuthUrl() {
  if (!calendarStore.pendingAuthUrl) return
  try {
    await navigator.clipboard.writeText(calendarStore.pendingAuthUrl)
    copyLinkLabel.value = 'Copied!'
    setTimeout(() => { copyLinkLabel.value = 'Copy link' }, 2000)
  } catch {
    // Clipboard API unavailable — fallback: select text
  }
}
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden">
    <!-- Top bar -->
    <div class="flex items-center justify-between px-6 py-4 border-b border-zinc-800/50 flex-shrink-0">
      <h1 class="text-lg font-semibold text-zinc-100">Calendar</h1>
      <div class="flex items-center gap-2">

        <!-- Not connected → offer to connect -->
        <template v-if="!calendarStore.isConnected">
          <BaseButton
            variant="ghost"
            size="sm"
            class="text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
            :disabled="calendarStore.isConnecting"
            @click="handleConnect"
          >
            <svg v-if="calendarStore.isConnecting" class="w-3.5 h-3.5 mr-1.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <svg v-else class="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            {{ calendarStore.isConnecting ? 'Waiting for browser…' : 'Connect Google Calendar' }}
          </BaseButton>
        </template>

        <!-- Connected → sync button + disconnect -->
        <template v-else>
          <span
            v-if="calendarStore.lastSynced"
            class="text-xs text-zinc-500 hidden sm:inline"
          >
            Synced {{ new Date(calendarStore.lastSynced).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}
          </span>
          <BaseButton
            variant="ghost"
            size="sm"
            :disabled="calendarStore.isSyncing"
            @click="handleSync"
          >
            <svg
              class="w-3.5 h-3.5 mr-1.5"
              :class="calendarStore.isSyncing ? 'animate-spin' : ''"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {{ calendarStore.isSyncing ? 'Syncing…' : 'Sync' }}
          </BaseButton>
          <button
            class="text-xs text-zinc-600 hover:text-zinc-400 transition-colors px-1"
            title="Disconnect Google Calendar"
            @click="handleDisconnect"
          >
            Disconnect
          </button>
        </template>

        <BaseButton variant="primary" size="sm" @click="showCreateModal = true">
          <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          New event
        </BaseButton>
      </div>
    </div>

    <!-- Connecting overlay hint -->
    <Transition name="slide-down">
      <div
        v-if="calendarStore.isConnecting"
        class="mx-4 mt-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 px-4 py-3 text-sm text-indigo-300"
      >
        <div class="flex items-start gap-3">
          <svg class="w-4 h-4 flex-shrink-0 animate-spin mt-0.5" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <div class="flex-1 min-w-0">
            <p>Complete Google sign-in in the browser tab. This will update automatically when done.</p>
            <div v-if="calendarStore.pendingAuthUrl" class="mt-2 flex items-center gap-2 flex-wrap">
              <span class="text-zinc-400 text-xs">Browser didn't open?</span>
              <a
                :href="calendarStore.pendingAuthUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="text-xs text-indigo-400 underline hover:text-indigo-300 truncate max-w-xs"
              >Open authorization page</a>
              <button
                class="text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-700/50 rounded px-2 py-0.5 transition-colors"
                @click="copyAuthUrl"
              >{{ copyLinkLabel }}</button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Calendar body -->
    <div class="flex-1 overflow-hidden">
      <CalendarViewComponent
        @event-click="() => {}"
        @slot-click="handleSlotClick"
        @create-event="handleCreateEvent"
      />
    </div>

    <!-- Create event modal -->
    <BaseModal v-model="showCreateModal" title="New Event">
      <div class="space-y-4">
        <div>
          <label class="text-xs font-medium text-zinc-400 mb-1 block">Title</label>
          <input
            v-model="newEvent.title"
            type="text"
            placeholder="Event title..."
            class="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            autofocus
          />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs font-medium text-zinc-400 mb-1 block">Start</label>
            <input
              v-model="newEvent.startTime"
              type="datetime-local"
              class="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>
          <div>
            <label class="text-xs font-medium text-zinc-400 mb-1 block">End</label>
            <input
              v-model="newEvent.endTime"
              type="datetime-local"
              class="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>
        </div>
        <div class="flex items-center justify-end gap-2 pt-2">
          <BaseButton variant="ghost" @click="showCreateModal = false">Cancel</BaseButton>
          <BaseButton variant="primary" @click="submitEvent" :disabled="!newEvent.title.trim()">
            Create
          </BaseButton>
        </div>
      </div>
    </BaseModal>
  </div>
</template>
