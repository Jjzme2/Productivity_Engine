// ─── Calendar event domain types ──────────────────────────────────────────────

export type SyncStatus = 'synced' | 'pending' | 'conflict' | 'error' | 'local_only'

export type SyncState =
  | 'idle'
  | 'syncing'
  | 'error'
  | 'unauthorized'

export type EventVisibility = 'default' | 'public' | 'private' | 'confidential'

export type EventStatus = 'confirmed' | 'tentative' | 'cancelled'

export type AttendeeStatus = 'accepted' | 'declined' | 'tentative' | 'needs_action'

export interface Attendee {
  email: string
  displayName?: string
  status: AttendeeStatus
  isOrganizer: boolean
}

export interface CalendarEvent {
  id: string
  userId: string
  /** Google Calendar event ID (undefined for local-only events) */
  googleEventId?: string
  calendarId: string
  title: string
  description?: string
  location?: string
  startTime: string
  endTime: string
  isAllDay: boolean
  recurrenceRule?: string
  status: EventStatus
  visibility: EventVisibility
  attendees: Attendee[]
  linkedTaskIds: string[]
  linkedNoteIds: string[]
  syncStatus: SyncStatus
  color?: string
  conferenceUrl?: string
  createdAt: string
  updatedAt: string
}

export interface CreateEventPayload {
  calendarId?: string
  title: string
  description?: string
  location?: string
  startTime: string
  endTime: string
  isAllDay?: boolean
  recurrenceRule?: string
  attendees?: Omit<Attendee, 'status' | 'isOrganizer'>[]
  linkedTaskIds?: string[]
  linkedNoteIds?: string[]
  color?: string
  conferenceUrl?: string
}

export interface UpdateEventPayload {
  id: string
  calendarId?: string
  title?: string
  description?: string
  location?: string
  startTime?: string
  endTime?: string
  isAllDay?: boolean
  recurrenceRule?: string
  status?: EventStatus
  attendees?: Attendee[]
  linkedTaskIds?: string[]
  linkedNoteIds?: string[]
  color?: string
  conferenceUrl?: string
}

export interface GoogleCalendar {
  id: string
  summary: string
  description?: string
  backgroundColor?: string
  foregroundColor?: string
  selected: boolean
  primary: boolean
  accessRole: 'reader' | 'writer' | 'owner' | 'freeBusyReader'
  timeZone: string
}
