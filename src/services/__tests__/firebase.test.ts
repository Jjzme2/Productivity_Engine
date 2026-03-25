// ─── Firebase init unit tests ─────────────────────────────────────────────────
// Tests the firebase.ts module's init branching and firebaseEnabled flag.

import { describe, it, expect, vi, beforeEach } from 'vitest'

// We re-mock import.meta.env per-test to control which vars are present.
// The actual Firebase SDK is mocked to avoid real network calls.

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({ name: '[DEFAULT]' })),
  getApps: vi.fn(() => []),
}))

vi.mock('firebase/firestore', () => ({
  initializeFirestore: vi.fn(() => ({})),
  persistentLocalCache: vi.fn(() => ({})),
}))

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
}))

vi.mock('./useLogger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

describe('firebase.ts', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('exports firebaseEnabled = false when env vars are missing', async () => {
    // Set env vars to empty
    vi.stubEnv('VITE_FIREBASE_API_KEY', '')
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', '')
    vi.stubEnv('VITE_FIREBASE_APP_ID', '')

    const mod = await import('../firebase')

    expect(mod.firebaseEnabled).toBe(false)
    expect(mod.app).toBeNull()
    expect(mod.db).toBeNull()
    expect(mod.auth).toBeNull()
  })

  it('exports firebaseEnabled = true when all required env vars are set', async () => {
    vi.stubEnv('VITE_FIREBASE_API_KEY', 'test-key')
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'test-project')
    vi.stubEnv('VITE_FIREBASE_APP_ID', 'test-app-id')
    vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'test.firebaseapp.com')
    vi.stubEnv('VITE_FIREBASE_STORAGE_BUCKET', 'test.appspot.com')
    vi.stubEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', '123456')

    const mod = await import('../firebase')

    expect(mod.firebaseEnabled).toBe(true)
    expect(mod.app).not.toBeNull()
  })

  it('exports null when only some env vars are set', async () => {
    vi.stubEnv('VITE_FIREBASE_API_KEY', 'test-key')
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', '')
    vi.stubEnv('VITE_FIREBASE_APP_ID', '')

    const mod = await import('../firebase')

    expect(mod.firebaseEnabled).toBe(false)
    expect(mod.app).toBeNull()
  })
})
