# Bug Fixes & Logging — Summary

**Model:** Claude claude-4-sonnet (Antigravity)
**Date:** 2026-03-24

## Changes Made

### New File
- **`src/services/useLogger.ts`** — Structured logger with `[PE:Module]` tags, colored console output, and 200-entry ring buffer.

### Modified Files

| File | Change |
|------|--------|
| `src/components/layout/Titlebar.vue` | Removed `data-tauri-drag-region` from root div; kept only on title area |
| `src/services/firebase.ts` | Added init diagnostics: logs missing env vars, project ID, init success/failure |
| `src/services/firestoreClient.ts` | `requireDb()` now logs before throwing |
| `src/stores/useNoteStore.ts` | Added `loadFromLocalVault()` fallback + logging throughout CRUD |
| `src/App.vue` | Startup toast shows Firebase status (connected vs local-only mode) |
| `src-tauri/capabilities/default.json` | Added `fs:allow-readdir` for vault directory listing |

## Logic

- **Titlebar**: On Linux/WebKitGTK, `data-tauri-drag-region` on a parent div captures pointer events before child click handlers fire. Removing it from the root and keeping it only on the left title region preserves drag-to-move while allowing button clicks.
- **Firebase**: The app now explicitly logs every step of Firebase initialization and shows a toast at boot so users know immediately if cloud sync is active.
- **Notes fallback**: When `subscribeToCollection` throws (Firebase unavailable), notes are loaded from local JSON files in `~/Documents/ProductivityEngine/Notes/`. Updates also no longer revert on Firestore failure — the local vault copy is preserved.

## Verification
- Vite production build: **PASS** (0 errors, 7.90s)
