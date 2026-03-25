// ─── Auth Store ───────────────────────────────────────────────────────────────
// Manages Firebase Authentication state. Initialise once in App.vue via init().
//
// Why anonymous auth for guests?
// Even "guest" users need a UID so Firestore rules can scope documents.
// signInAnonymously() provides a real Firebase UID without asking for credentials.

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInAnonymously,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth'
import { auth } from '@/services/firebase'
import { createLogger } from '@/services/useLogger'

const log = createLogger('AuthStore')

export const useAuthStore = defineStore('auth', () => {
  // ── State ──────────────────────────────────────────────────────────────────

  const currentUser = ref<User | null>(null)
  const isLoading   = ref(true)
  const authError   = ref<string | null>(null)

  // ── Computed ───────────────────────────────────────────────────────────────

  const isAuthenticated = computed(() => currentUser.value !== null)
  const uid             = computed(() => currentUser.value?.uid ?? 'local')
  const isAnonymous     = computed(() => currentUser.value?.isAnonymous ?? false)

  // ── Init (call once in App.vue) ────────────────────────────────────────────

  /** Returns a Promise that resolves once the initial auth state is known. */
  function init(): Promise<void> {
    return new Promise((resolve) => {
      if (!auth) {
        log.warn('Firebase Auth not available — falling back to local-only mode')
        isLoading.value = false
        resolve()
        return
      }

      onAuthStateChanged(auth, (user) => {
        currentUser.value = user
        isLoading.value = false
        if (user) {
          log.info(`Auth state changed: signed in as ${user.isAnonymous ? 'anonymous' : user.email}`, { uid: user.uid })
        } else {
          log.info('Auth state changed: signed out')
        }
        resolve()
      })
    })
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  async function login(email: string, password: string): Promise<void> {
    if (!auth) {
      authError.value = 'Firebase Auth is not configured.'
      throw new Error(authError.value)
    }

    authError.value = null
    isLoading.value = true

    try {
      await signInWithEmailAndPassword(auth, email, password)
      log.info('Email login successful')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed'
      authError.value = humaniseFirebaseError(message)
      log.error('Email login failed', { err })
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function loginAsGuest(): Promise<void> {
    if (!auth) {
      // No Firebase = pure local mode — let them through
      log.info('No Firebase Auth — entering local-only guest mode')
      return
    }

    authError.value = null
    isLoading.value = true

    try {
      await signInAnonymously(auth)
      log.info('Anonymous guest login successful')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Guest login failed'
      authError.value = message
      log.error('Anonymous login failed', { err })
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function signOut(): Promise<void> {
    if (!auth) return
    try {
      await fbSignOut(auth)
      currentUser.value = null
      log.info('Signed out')
    } catch (err) {
      log.error('Sign out failed', { err })
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Convert cryptic Firebase error codes to human-friendly messages. */
  function humaniseFirebaseError(raw: string): string {
    if (raw.includes('user-not-found'))       return 'No account found with that email.'
    if (raw.includes('wrong-password'))        return 'Incorrect password.'
    if (raw.includes('invalid-email'))         return 'Please enter a valid email address.'
    if (raw.includes('too-many-requests'))     return 'Too many attempts. Please try again later.'
    if (raw.includes('invalid-credential'))    return 'Invalid email or password.'
    if (raw.includes('network-request-failed')) return 'Network error. Check your connection.'
    return raw
  }

  return {
    // State
    currentUser,
    isLoading,
    authError,
    // Computed
    isAuthenticated,
    uid,
    isAnonymous,
    // Actions
    init,
    login,
    loginAsGuest,
    signOut,
  }
})
