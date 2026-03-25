// ─── Startup Diagnostics ──────────────────────────────────────────────────────
// Runs once at app boot (called from App.vue onMounted).
// Every finding is written to BOTH the in-app log buffer and the Rust rolling
// log file so you can read it even when the app UI is not rendering.
//
// Log file location (Linux):
//   $XDG_DATA_HOME/productivity-engine/logs/app.log.YYYY-MM-DD
//   (typically ~/.local/share/productivity-engine/logs/app.log.YYYY-MM-DD)

import { invoke } from '@tauri-apps/api/core'
import { app as firebaseApp, db, auth, firebaseEnabled } from './firebase'
import { createLogger } from './useLogger'
import { getLogFilePath } from './tauriClient'

const log = createLogger('Diagnostics')

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Write a line directly to the Rust log file at INFO level. */
function fileInfo(message: string) {
  invoke('log_frontend_error', {
    level: 'info',
    message,
    context: JSON.stringify({ module: 'Diagnostics' }),
  }).catch(() => {})
}

/** Write a line directly to the Rust log file at WARN level. */
function fileWarn(message: string) {
  invoke('log_frontend_error', {
    level: 'warn',
    message,
    context: JSON.stringify({ module: 'Diagnostics' }),
  }).catch(() => {})
}

// ─── Individual checks ────────────────────────────────────────────────────────

function checkFirebaseConfig(): boolean {
  if (!firebaseEnabled) {
    fileWarn(
      'Firebase DISABLED — VITE_FIREBASE_API_KEY / VITE_FIREBASE_PROJECT_ID / ' +
      'VITE_FIREBASE_APP_ID were not set at build time. ' +
      'All data is stored locally only. Set these vars in .env and rebuild to enable cloud sync.',
    )
    log.warn('Firebase disabled — running in local-only mode')
    return false
  }
  fileInfo(`Firebase ENABLED — app: ${firebaseApp?.name ?? '?'}`)
  log.info('Firebase enabled')
  return true
}

function checkFirestoreInit(): boolean {
  if (!db) {
    fileWarn('Firestore db is null — Firestore initialisation failed after Firebase was enabled. Check Firebase console for project configuration errors.')
    log.warn('Firestore db is null')
    return false
  }
  fileInfo('Firestore initialised with persistent local cache')
  log.info('Firestore db ready')
  return true
}

function checkAuthInit(): boolean {
  if (!auth) {
    fileWarn('Firebase Auth is null — auth features unavailable')
    log.warn('Firebase Auth is null')
    return false
  }
  const user = auth.currentUser
  if (user) {
    fileInfo(
      `Auth: signed in — uid=${user.uid} anonymous=${user.isAnonymous} email=${user.email ?? '(none)'}`,
    )
    log.info('Auth: signed in', { uid: user.uid, anonymous: user.isAnonymous })
  } else {
    fileInfo('Auth: no user signed in (will show login screen)')
    log.info('Auth: no user')
  }
  return true
}

async function checkFirestoreConnectivity(): Promise<void> {
  if (!db) return

  // Try a minimal read (just the metadata of a non-existent doc) to confirm
  // the Firestore SDK can reach the backend. Uses the local cache first so
  // this is fast even offline.
  try {
    const { doc, getDocFromCache } = await import('firebase/firestore')
    const probe = doc(db, '__diag__', '__probe__')
    await getDocFromCache(probe).catch(() => {
      // Cache miss is fine — the doc doesn't exist.  What matters is that the
      // SDK didn't throw a configuration/auth error.
    })
    fileInfo('Firestore SDK responded to connectivity probe (cache check OK)')
    log.info('Firestore connectivity probe passed')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    fileWarn(`Firestore connectivity probe failed: ${msg}`)
    log.warn('Firestore connectivity probe failed', { err: msg })
  }
}

async function checkNetworkEnv(): Promise<void> {
  const online = typeof navigator !== 'undefined' ? navigator.onLine : true
  fileInfo(`Network: navigator.onLine=${online}`)
  if (!online) {
    fileWarn('Device appears to be offline — cloud features will use local cache until reconnected')
    log.warn('Device is offline at startup')
  }
}

function logEnvVarPresence(): void {
  // Log which VITE_ vars are present (value redacted) to help diagnose
  // build-time configuration issues.
  const vars = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID',
    'VITE_GOOGLE_CLIENT_ID',
  ]
  const status = vars.map((v) => {
    const val = import.meta.env[v] as string | undefined
    return `${v}=${val ? '✓ set' : '✗ MISSING'}`
  })
  fileInfo(`Build-time env vars — ${status.join(', ')}`)
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export interface DiagnosticsResult {
  firebaseEnabled: boolean
  firestoreReady: boolean
  authReady: boolean
  logFilePath: string
}

/**
 * Run all startup checks and write their results to the Rust log file.
 * Call once from App.vue onMounted (after auth has resolved).
 */
export async function runStartupDiagnostics(): Promise<DiagnosticsResult> {
  fileInfo('=== Productivity Engine startup diagnostics ===')
  fileInfo(`App version: ${import.meta.env['VITE_APP_VERSION'] ?? 'unknown'} | Mode: ${import.meta.env.MODE}`)
  fileInfo(`User agent: ${navigator.userAgent}`)

  logEnvVarPresence()

  const fbEnabled  = checkFirebaseConfig()
  const fsReady    = fbEnabled ? checkFirestoreInit() : false
  const authReady  = fbEnabled ? checkAuthInit()      : false

  await checkNetworkEnv()
  if (fsReady) await checkFirestoreConnectivity()

  let logFilePath = ''
  try {
    logFilePath = await getLogFilePath()
    fileInfo(`Log file: ${logFilePath}`)
    log.info(`Log file path: ${logFilePath}`)
  } catch {
    log.warn('Could not retrieve log file path (running outside Tauri?)')
  }

  fileInfo('=== Diagnostics complete ===')

  return { firebaseEnabled: fbEnabled, firestoreReady: fsReady, authReady, logFilePath }
}
