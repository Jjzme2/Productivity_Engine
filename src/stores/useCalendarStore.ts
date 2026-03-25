// ─── Calendar store ───────────────────────────────────────────────────────────

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '@/services/firebase'
import type {
  CalendarEvent,
  CreateEventPayload,
  UpdateEventPayload,
  GoogleCalendar,
  SyncState,
} from '@/types/event'
import {
  subscribeToCollection,
  COLLECTIONS,
} from '@/services/firestoreClient'
import * as tauri from '@/services/tauriClient'
import type { SyncedEvent } from '@/services/tauriClient'
import type { Unsubscribe } from 'firebase/firestore'
import { open as shellOpen } from '@tauri-apps/plugin-shell'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Map a raw Google Calendar event to our CalendarEvent schema. */
function mapGoogleEvent(
  se: SyncedEvent,
  userId: string,
): Omit<CalendarEvent, 'id'> & { googleEventId?: string } {
  const ge = se.event
  const startTime = ge.start?.dateTime ?? ge.start?.date ?? ''
  const endTime = ge.end?.dateTime ?? ge.end?.date ?? ''
  const isAllDay = !ge.start?.dateTime

  return {
    userId,
    googleEventId: ge.id,
    calendarId: se.calendarId,
    title: ge.summary ?? '(No title)',
    description: ge.description,
    location: ge.location,
    startTime,
    endTime,
    isAllDay,
    recurrenceRule: ge.recurrence?.[0],
    status: (ge.status ?? 'confirmed') as CalendarEvent['status'],
    visibility: 'default' as CalendarEvent['visibility'],
    attendees: (ge.attendees ?? []).map((a) => ({
      email: a.email,
      displayName: a.displayName,
      status: (a.responseStatus ?? 'needs_action') as CalendarEvent['attendees'][number]['status'],
      isOrganizer: a.organizer ?? false,
    })),
    linkedTaskIds: [],
    linkedNoteIds: [],
    syncStatus: 'synced' as CalendarEvent['syncStatus'],
    color: ge.colorId,
    conferenceUrl: ge.conferenceData?.entryPoints?.find(
      (ep) => ep.entryPointType === 'video',
    )?.uri,
    createdAt: ge.updated ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

/** Persist a batch of synced events to Firestore. Uses Google event ID as the
 *  document ID (prefixed `gcal_`) so repeated syncs are idempotent upserts. */
async function persistSyncedEvents(
  syncedEvents: SyncedEvent[],
  userId: string,
): Promise<void> {
  if (!db || !syncedEvents.length) return

  const writes = syncedEvents
    .filter((se) => se.event.id) // skip events without a Google ID
    .map(async (se) => {
      const id = `gcal_${se.event.id}`
      const mapped = mapGoogleEvent(se, userId)
      try {
        await setDoc(doc(db!, COLLECTIONS.EVENTS, id), { ...mapped, id })
      } catch (e) {
        console.warn(`[CalendarStore] Failed to persist event ${id}:`, e)
      }
    })

  await Promise.allSettled(writes)
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useCalendarStore = defineStore('calendar', () => {
  // ── State ──────────────────────────────────────────────────────────────────

  const events          = ref<CalendarEvent[]>([])
  const googleCalendars = ref<GoogleCalendar[]>([])
  // Start as 'unauthorized' — we don't know auth state until we check.
  const syncStatus      = ref<SyncState>('unauthorized')
  const lastSynced      = ref<Date | null>(null)
  const isLoading       = ref(false)
  const isConnecting    = ref(false)
  const pendingAuthUrl  = ref<string | null>(null)
  const error           = ref<string | null>(null)
  const syncErrors      = ref<string[]>([])

  /** userId captured at loadEvents time; used for event persistence. */
  let _userId = 'local'
  let _unsubscribe: Unsubscribe | null = null

  // ── Computed ───────────────────────────────────────────────────────────────

  const sortedEvents = computed(() =>
    [...events.value].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    ),
  )

  const todayEvents = computed(() => {
    const today = new Date().toISOString().slice(0, 10)
    return sortedEvents.value.filter((e) => e.startTime.startsWith(today))
  })

  const upcomingEvents = computed(() =>
    sortedEvents.value.filter((e) => e.startTime > new Date().toISOString()),
  )

  const isSyncing   = computed(() => syncStatus.value === 'syncing')
  const isConnected = computed(() => syncStatus.value === 'idle')

  /** Compatibility aliases for older components */
  const eventsToday = todayEvents
  const syncState   = syncStatus
  const lastSync    = computed(() => lastSynced.value?.toISOString() ?? null)
  async function syncWithGoogle() { await syncCalendar() }

  // ── Actions ────────────────────────────────────────────────────────────────

  async function loadEvents(userId: string) {
    _userId = userId
    isLoading.value = true

    // Check auth status in the background — don't block the subscription.
    tauri.getGoogleSyncStatus()
      .then(({ isAuthorized, state }) => {
        syncStatus.value = isAuthorized ? (state as SyncState) : 'unauthorized'
      })
      .catch(() => {
        // Tauri unavailable (browser dev mode) — leave as 'unauthorized'
      })

    _unsubscribe = subscribeToCollection<CalendarEvent>(
      COLLECTIONS.EVENTS,
      {
        where:   [{ field: 'userId', op: '==', value: userId }],
        orderBy: [{ field: 'startTime', direction: 'asc' }],
      },
      (docs) => {
        events.value = docs
        isLoading.value = false
      },
      (err) => {
        error.value = err.message
        isLoading.value = false
      },
    )
  }

  function unloadEvents() {
    _unsubscribe?.()
    _unsubscribe = null
    events.value = []
  }

  async function createEvent(
    userIdOrPayload: string | CreateEventPayload,
    payloadArg?: CreateEventPayload,
  ): Promise<CalendarEvent> {
    const userId  = typeof userIdOrPayload === 'string' ? userIdOrPayload : _userId
    const payload = typeof userIdOrPayload === 'string' ? payloadArg! : userIdOrPayload
    return tauri.createCalendarEvent({ ...payload, userId })
  }

  async function updateEvent(
    userId: string,
    payload: UpdateEventPayload,
  ): Promise<CalendarEvent> {
    const updated = await tauri.updateCalendarEvent({ ...payload, userId })
    const idx = events.value.findIndex((e) => e.id === payload.id)
    if (idx !== -1) events.value[idx] = updated
    return updated
  }

  async function deleteEvent(eventId: string, userId: string): Promise<void> {
    await tauri.deleteCalendarEvent(eventId, userId)
    events.value = events.value.filter((e) => e.id !== eventId)
  }

  /**
   * Full OAuth2 connect flow:
   * 1. Get auth URL from Rust
   * 2. Open it in the OS browser
   * 3. Start a local listener that waits for the redirect callback
   * 4. Exchange the code for tokens
   * 5. Load available calendars
   */
  async function connectGoogleCalendar(): Promise<void> {
    if (isConnecting.value) return
    isConnecting.value = true
    error.value = null

    try {
      // Step 1 — get the OAuth URL + CSRF state
      const { authUrl } = await tauri.initGoogleOAuth()

      // Expose the URL so the UI can render a clickable link as fallback
      pendingAuthUrl.value = authUrl

      // Step 2 + 3 — open browser and start listener in parallel.
      // startOAuthListener blocks (up to 5 min) until the callback arrives.
      const [, callback] = await Promise.all([
        shellOpen(authUrl).catch(() => { /* browser open failed — user sees the link */ }),
        tauri.startOAuthListener(),
      ])

      // Step 4 — exchange the code for tokens
      await tauri.completeGoogleOAuth({ code: callback.code, state: callback.state })

      // Step 5 — load available calendars so the user can select them
      const cals = await tauri.listGoogleCalendars()
      googleCalendars.value = cals

      syncStatus.value = 'idle'
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      error.value = msg
      syncStatus.value = 'unauthorized'
      throw err
    } finally {
      isConnecting.value = false
      pendingAuthUrl.value = null
    }
  }

  async function disconnectGoogleCalendar(): Promise<void> {
    await tauri.revokeGoogleAuth()
    googleCalendars.value = []
    syncStatus.value = 'unauthorized'
  }

  async function syncCalendar(): Promise<void> {
    if (syncStatus.value === 'syncing') return

    syncStatus.value = 'syncing'
    syncErrors.value = []

    try {
      const result = await tauri.syncCalendar()

      // Persist the returned events to Firestore so the real-time subscription
      // picks them up and the calendar renders them immediately.
      if (result.events?.length) {
        await persistSyncedEvents(result.events, _userId)
      }

      syncStatus.value = result.syncState as SyncState
      syncErrors.value = result.errors
      lastSynced.value = new Date()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const isAuthError = /unauthori[zs]ed|forbidden|auth|token|credential/i.test(msg)
      syncStatus.value = isAuthError ? 'unauthorized' : 'error'
      error.value = msg
    }
  }

  async function listGoogleCalendars(): Promise<void> {
    const cals = await tauri.listGoogleCalendars()
    googleCalendars.value = cals
  }

  function getSyncStatus(): SyncState {
    return syncStatus.value
  }

  return {
    // State
    events,
    googleCalendars,
    syncStatus,
    lastSynced,
    isLoading,
    isConnecting,
    pendingAuthUrl,
    error,
    syncErrors,
    // Computed
    sortedEvents,
    todayEvents,
    eventsToday,
    upcomingEvents,
    isSyncing,
    isConnected,
    syncState,
    lastSync,
    syncWithGoogle,
    // Actions
    loadEvents,
    unloadEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    connectGoogleCalendar,
    disconnectGoogleCalendar,
    syncCalendar,
    listGoogleCalendars,
    getSyncStatus,
  }
})
