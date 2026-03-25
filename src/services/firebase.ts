// ─── Firebase initialisation ──────────────────────────────────────────────────
// Exports: app, db, auth — all null when Firebase is not configured.

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import {
  initializeFirestore,
  persistentLocalCache,
  type Firestore,
} from 'firebase/firestore'
import { getAuth, type Auth } from 'firebase/auth'
import { createLogger } from './useLogger'

const log = createLogger('Firebase')

const apiKey     = import.meta.env['VITE_FIREBASE_API_KEY']     as string | undefined
const projectId  = import.meta.env['VITE_FIREBASE_PROJECT_ID']  as string | undefined
const appId      = import.meta.env['VITE_FIREBASE_APP_ID']      as string | undefined

/** True when all required Firebase env vars are present and non-empty. */
export const firebaseEnabled = Boolean(apiKey && projectId && appId)

if (!firebaseEnabled) {
  const missing: string[] = []
  if (!apiKey)    missing.push('VITE_FIREBASE_API_KEY')
  if (!projectId) missing.push('VITE_FIREBASE_PROJECT_ID')
  if (!appId)     missing.push('VITE_FIREBASE_APP_ID')
  log.warn(`Firebase disabled — missing env vars: ${missing.join(', ')}`)
} else {
  log.info(`Firebase enabled for project: ${projectId}`)
}

function getOrInitApp(): FirebaseApp | null {
  if (!firebaseEnabled) return null
  const apps = getApps()
  if (apps.length > 0) return apps[0]!
  try {
    const app = initializeApp({
      apiKey:            apiKey!,
      authDomain:        import.meta.env['VITE_FIREBASE_AUTH_DOMAIN']         as string,
      projectId:         projectId!,
      storageBucket:     import.meta.env['VITE_FIREBASE_STORAGE_BUCKET']      as string,
      messagingSenderId: import.meta.env['VITE_FIREBASE_MESSAGING_SENDER_ID'] as string,
      appId:             appId!,
    })
    log.info('Firebase app initialised successfully')
    return app
  } catch (err) {
    log.error('Firebase app init failed', err)
    return null
  }
}

export const app: FirebaseApp | null = getOrInitApp()

export let db: Firestore | null = null
if (app) {
  try {
    db = initializeFirestore(app, { localCache: persistentLocalCache() })
    log.info('Firestore initialised with persistent local cache')
  } catch (err) {
    log.error('Firestore init failed', err)
  }
}

export const auth: Auth | null = app ? getAuth(app) : null

