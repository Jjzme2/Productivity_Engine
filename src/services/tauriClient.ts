// ─── Typed Tauri command invoke wrappers ──────────────────────────────────────
// Each exported function maps 1-to-1 to a #[tauri::command] in Rust.
// All functions return properly typed Promises.

import { invoke } from '@tauri-apps/api/core'
import type {
  ParsedIntent,
  ExecutionResult,
  Suggestion,
  DailyBrief,
  AiProviderStatus,
  UserContext,
} from '@/types/nlp'
import type {
  CalendarEvent,
  CreateEventPayload,
  UpdateEventPayload,
  GoogleCalendar,
  SyncState,
} from '@/types/event'
import type {
  Framework,
  FrameworkSession,
  CustomFrameworkConfig,
  FrameworkSlug,
} from '@/types/framework'
import type {
  UserInsights,
  WeeklySummary,
  ActivityEvent,
} from '@/types/analytics'
import type { AppSettings } from '@/types/settings'

// ─── AI / NLP commands ────────────────────────────────────────────────────────

export interface ParseNlpIntentArgs {
  rawInput: string
  userContext: UserContext
}

/** Parse natural language input into a structured intent. */
export async function parseNlpIntent(
  args: ParseNlpIntentArgs,
): Promise<ParsedIntent> {
  return invoke<ParsedIntent>('parse_nlp_intent', args)
}

export interface ConfirmAndExecuteIntentArgs {
  intent: ParsedIntent
  userContext: UserContext
}

/**
 * Execute a confirmed ParsedIntent. The Rust side performs the actual
 * mutation and returns an ExecutionResult.
 */
export async function confirmAndExecuteIntent(
  args: ConfirmAndExecuteIntentArgs,
): Promise<ExecutionResult> {
  return invoke<ExecutionResult>('confirm_and_execute_intent', args)
}

export interface GenerateSuggestionArgs {
  context: UserContext
  maxSuggestions?: number
}

/** Get AI-generated productivity suggestions for the current context. */
export async function generateSuggestion(
  args: GenerateSuggestionArgs,
): Promise<Suggestion[]> {
  return invoke<Suggestion[]>('generate_suggestion', args)
}

export interface GetDailyBriefArgs {
  userId: string
  date: string // ISO-8601 YYYY-MM-DD
}

/** Fetch the AI-generated daily brief for the given date. */
export async function getDailyBrief(
  args: GetDailyBriefArgs,
): Promise<DailyBrief> {
  return invoke<DailyBrief>('get_daily_brief', args)
}

/** Check which AI provider is active and whether it is reachable. */
export async function getAiProviderStatus(): Promise<AiProviderStatus> {
  return invoke<AiProviderStatus>('get_ai_provider_status')
}

// ─── Calendar commands ────────────────────────────────────────────────────────

export interface SyncCalendarArgs {
  userId?: string
  calendarIds?: string[]
}

export interface GoogleEventRaw {
  id?: string
  summary?: string
  description?: string
  location?: string
  start: { dateTime?: string; date?: string; timeZone?: string }
  end: { dateTime?: string; date?: string; timeZone?: string }
  status?: string
  colorId?: string
  recurrence?: string[]
  recurringEventId?: string
  attendees?: Array<{
    email: string
    displayName?: string
    responseStatus?: string
    organizer?: boolean
  }>
  conferenceData?: {
    entryPoints?: Array<{ uri: string; entryPointType: string }>
  }
  etag?: string
  updated?: string
}

export interface SyncedEvent {
  calendarId: string
  event: GoogleEventRaw
}

export interface CalendarSyncResult {
  synced: number
  conflicts: number
  errors: string[]
  syncState: SyncState
  events: SyncedEvent[]
}

/** Start the Google OAuth2 flow — returns the auth URL to open in a browser. */
export async function initGoogleOAuth(): Promise<{ authUrl: string; state: string }> {
  return invoke<{ authUrl: string; state: string }>('init_google_oauth')
}

/**
 * Start a local HTTP listener on port 8765 and wait for the OAuth callback.
 * Open the auth URL in the browser BEFORE calling this (they run in parallel).
 * Resolves with the authorization code when the redirect arrives.
 */
export async function startOAuthListener(): Promise<{ code: string; state: string }> {
  return invoke<{ code: string; state: string }>('start_oauth_listener')
}

/** Exchange the authorization code from the OAuth callback for tokens. */
export async function completeGoogleOAuth(payload: {
  code: string
  state: string
}): Promise<void> {
  return invoke<void>('complete_google_oauth', { payload })
}

/** Revoke all stored Google OAuth tokens and disconnect Calendar. */
export async function revokeGoogleAuth(): Promise<void> {
  return invoke<void>('revoke_google_auth')
}

/** Trigger a full Google Calendar sync. Returns events for the frontend to persist. */
export async function syncCalendar(
  _args?: SyncCalendarArgs,
): Promise<CalendarSyncResult> {
  return invoke<CalendarSyncResult>('sync_google_calendar')
}

/** Returns the current Google Calendar auth / sync status without triggering a sync. */
export async function getGoogleSyncStatus(): Promise<{ state: SyncState; isAuthorized: boolean }> {
  return invoke<{ state: SyncState; isAuthorized: boolean }>('get_sync_status')
}

/** Fetch Google Calendars available to the authenticated user. */
export async function listGoogleCalendars(): Promise<GoogleCalendar[]> {
  return invoke<GoogleCalendar[]>('get_google_calendars')
}

/** Update app settings (partial patch — only the provided fields are changed). */
export async function updateSettings(updates: Record<string, unknown>): Promise<void> {
  return invoke<void>('update_settings', { updates })
}

/** Retrieve current app settings. */
export async function getSettings(): Promise<Record<string, unknown>> {
  return invoke<Record<string, unknown>>('get_settings')
}

export interface FindFreeSlotsArgs {
  userId: string
  durationMinutes: number
  afterDate: string
  beforeDate: string
  preferredTimes?: Array<{ start: string; end: string }>
}

export interface FreeSlot {
  start: string
  end: string
  score: number
}

/** Find free calendar slots that fit a meeting/task of the given duration. */
export async function findFreeSlots(
  args: FindFreeSlotsArgs,
): Promise<FreeSlot[]> {
  return invoke<FreeSlot[]>('find_free_slots', args)
}

/** Create a calendar event via the Rust backend (also pushes to Google). */
export async function createCalendarEvent(
  payload: CreateEventPayload & { userId: string },
): Promise<CalendarEvent> {
  return invoke<CalendarEvent>('create_calendar_event', payload)
}

/** Update a calendar event. */
export async function updateCalendarEvent(
  payload: UpdateEventPayload & { userId: string },
): Promise<CalendarEvent> {
  return invoke<CalendarEvent>('update_calendar_event', payload)
}

/** Delete a calendar event. */
export async function deleteCalendarEvent(
  eventId: string,
  userId: string,
): Promise<void> {
  return invoke<void>('delete_calendar_event', { eventId, userId })
}

// ─── Framework commands ───────────────────────────────────────────────────────

/** Activate a productivity framework and start a new session. */
export async function activateFramework(
  userId: string,
  frameworkSlug: FrameworkSlug,
  linkedTaskIds?: string[],
): Promise<FrameworkSession> {
  return invoke<FrameworkSession>('activate_framework', {
    userId,
    frameworkSlug,
    linkedTaskIds: linkedTaskIds ?? [],
  })
}

/** Deactivate (stop/complete) the active session. */
export async function deactivateFramework(
  sessionId: string,
  userId: string,
  completed: boolean,
): Promise<FrameworkSession> {
  return invoke<FrameworkSession>('deactivate_framework', {
    sessionId,
    userId,
    completed,
  })
}

/** Create a custom framework definition. */
export async function createCustomFramework(
  userId: string,
  name: string,
  config: CustomFrameworkConfig,
): Promise<Framework> {
  return invoke<Framework>('create_custom_framework', { userId, name, config })
}

/** Update a custom framework. */
export async function updateCustomFramework(
  frameworkId: string,
  userId: string,
  name?: string,
  config?: Partial<CustomFrameworkConfig>,
): Promise<Framework> {
  return invoke<Framework>('update_custom_framework', {
    frameworkId,
    userId,
    name,
    config,
  })
}

// ─── Analytics commands ───────────────────────────────────────────────────────

/** Run the AI shortcoming/strength analysis for the given user. */
export async function runShortcomingAnalysis(
  userId: string,
  lookbackDays?: number,
): Promise<UserInsights> {
  return invoke<UserInsights>('run_shortcoming_analysis', {
    userId,
    lookbackDays: lookbackDays ?? 30,
  })
}

/** Fetch the stored UserInsights without re-running analysis. */
export async function getInsights(userId: string): Promise<UserInsights | null> {
  return invoke<UserInsights | null>('get_insights', { userId })
}

/** Fetch all weekly summaries for the user. */
export async function getWeeklySummaries(
  userId: string,
  limit?: number,
): Promise<WeeklySummary[]> {
  return invoke<WeeklySummary[]>('get_weekly_summaries', { userId, limit: limit ?? 10 })
}

/** Log a single activity event for analytics tracking. */
export async function logActivityEvent(
  event: Omit<ActivityEvent, 'id'>,
): Promise<void> {
  return invoke<void>('log_activity_event', { event })
}

// ─── Voice commands ───────────────────────────────────────────────────────────

/** Start the voice capture pipeline (microphone → STT). */
export async function startVoiceCapture(): Promise<void> {
  return invoke<void>('start_voice_capture')
}

/** Stop voice capture and return the final transcript. */
export async function stopVoiceCapture(): Promise<string> {
  return invoke<string>('stop_voice_capture')
}

/** Check whether a voice / STT provider is available. */
export async function getVoiceProviderStatus(): Promise<{
  available: boolean
  provider: string
}> {
  return invoke<{ available: boolean; provider: string }>(
    'get_voice_provider_status',
  )
}

// ─── Settings commands ────────────────────────────────────────────────────────

/** Load persisted AppSettings from Stronghold / disk. */
export async function loadSettings(userId: string): Promise<AppSettings> {
  return invoke<AppSettings>('load_settings', { userId })
}

/** Persist AppSettings updates. */
export async function saveSettings(
  userId: string,
  settings: Partial<AppSettings>,
): Promise<void> {
  return invoke<void>('save_settings', { userId, settings })
}

/** Store an API key in Tauri Stronghold (encrypted). */
export async function setApiKey(
  provider: string,
  key: string,
): Promise<void> {
  return invoke<void>('set_api_key', { provider, key })
}

/** Check which API keys have been stored (returns truthy flags, not the keys). */
export async function checkApiKeyStatuses(): Promise<Record<string, boolean>> {
  return invoke<Record<string, boolean>>('check_api_key_statuses')
}

/** Export all user data as a JSON string. */
export async function exportData(userId: string): Promise<string> {
  return invoke<string>('export_data', { userId })
}

/** Import data from a JSON export string. */
export async function importData(
  userId: string,
  json: string,
): Promise<{ imported: number; errors: string[] }> {
  return invoke<{ imported: number; errors: string[] }>('import_data', {
    userId,
    json,
  })
}

// ─── Logging ─────────────────────────────────────────────────────────────────

/**
 * Forward a frontend log entry to the Rust tracing subscriber so it appears in
 * the rolling log file alongside Rust-side events.
 */
export async function logFrontendError(
  level: 'error' | 'warn' | 'info',
  message: string,
  context?: string | null,
): Promise<void> {
  return invoke<void>('log_frontend_error', { level, message, context: context ?? null })
}

// ─── Secret env vars ─────────────────────────────────────────────────────────

/**
 * Read a server-side environment variable by name.
 * Only variables in the backend allowlist are accessible.
 * Returns null if the variable is not set or not in the allowlist.
 */
export async function readSecretEnv(name: string): Promise<string | null> {
  return invoke<string | null>('read_secret_env', { name })
}

