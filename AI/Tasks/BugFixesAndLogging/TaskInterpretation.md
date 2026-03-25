# Bug Fixes & Logging — Task Interpretation

**Model:** Claude claude-4-sonnet (Antigravity)
**Date:** 2026-03-24

## Task
Fix three bugs (window titlebar buttons, Firebase connectivity, notes sync) and add structured logging.

## Interpretation
1. **Titlebar buttons** — `data-tauri-drag-region` on the root div intercepted clicks on Linux. Scoped drag region to title area only.
2. **Firebase** — Env vars exist but no diagnostic output when Firestore fails. Added structured logging + startup toast.
3. **Notes** — No fallback when Firestore unavailable. Added `loadFromLocalVault()` reading from `~/Documents/ProductivityEngine/Notes/`.
4. **Logging** — Created `useLogger.ts` with module tags, colored output, and in-memory ring buffer.
