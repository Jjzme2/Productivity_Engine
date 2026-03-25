# Firebase Audit Fixes — Summary

**Model:** Claude 3.5 Sonnet (Antigravity)  
**Date:** 2026-03-24

## What Changed

### P0 — Critical Security (3 fixes)
1. **Real Firebase Auth** — Created `useAuthStore.ts` with `signInWithEmailAndPassword` + `signInAnonymously`. Rewrote `LoginView.vue` to use it. Added `router.beforeEach` guard enforcing `requiresAuth` route meta. Updated `App.vue` to init auth first and pass real UID.
2. **Firestore Rules** — Created `firestore.rules` with per-user scoping (`userId == request.auth.uid`) for all 17 collections.
3. **Secret Migration** — Moved R2 and Google OAuth secrets off `VITE_` prefix. Created `commands/secrets.rs` Tauri command with allowlisted `read_secret_env`. Updated `useNoteStore.ts` and `App.vue` to read secrets from Rust process.

### P1 — Completeness (3 fixes)
4. **createdAt Overwrite** — `setDocById` now uses `merge: true` with `createdAt` as a default that won't overwrite existing values.
5. **MEASUREMENT_ID Drift** — Removed unused `VITE_FIREBASE_MEASUREMENT_ID` from `vite-env.d.ts`.
6. **Unit Tests** — Created `__tests__/syncService.test.ts` (14 tests) and `__tests__/firebase.test.ts` (3 tests).

### P2 — Quality (3 fixes)
7. **Zod Validation** — Created `types/schemas.ts` with schemas for all collections. `createDoc` now validates data before Firestore write.
8. **DRY Constraints** — Extracted `buildConstraints()` helper used by both `queryCollection` and `subscribeToCollection`.
9. **Deep Timestamps** — `normaliseValue()` recursively converts Firestore Timestamps in nested objects/arrays.

### P3 — Micro-optimisations (2 fixes)
10. **getApps() Cache** — Single call instead of two.
11. **syncLoad Merge** — O(n) via `Map` instead of O(n²) `findIndex`.

## Files Changed

| File | Action |
|------|--------|
| `src/stores/useAuthStore.ts` | NEW |
| `src/types/schemas.ts` | NEW |
| `src-tauri/src/commands/secrets.rs` | NEW |
| `firestore.rules` | NEW |
| `src/services/__tests__/syncService.test.ts` | NEW |
| `src/services/__tests__/firebase.test.ts` | NEW |
| `src/views/LoginView.vue` | Modified |
| `src/router/index.ts` | Modified |
| `src/App.vue` | Modified |
| `src/services/firebase.ts` | Modified |
| `src/services/firestoreClient.ts` | Modified |
| `src/services/syncService.ts` | Modified |
| `src/stores/useNoteStore.ts` | Modified |
| `src/vite-env.d.ts` | Modified |
| `.env.example` | Modified |
| `src-tauri/src/commands/mod.rs` | Modified |
| `src-tauri/src/lib.rs` | Modified |

## Verification

- `vue-tsc --noEmit` — Passed with zero new errors (all existing errors are pre-existing in Habit/Pomodoro components).
- Manual verification required for: real auth flow, R2 vault sync via Tauri, Firestore rules deployment.
