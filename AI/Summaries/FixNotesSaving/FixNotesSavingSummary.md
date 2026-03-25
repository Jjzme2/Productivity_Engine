---
TaskName: FixNotesSaving
Model: Claude (Antigravity)
Date: 2026-03-24
---

# Fix Notes Saving Summary

## Problem
When a user typed in the note editor, their content was overwritten by the most recently saved version instead of being autosaved.

## Root Causes Identified

1. **Firestore snapshot wiped content** — `loadNotes` used a real-time `onSnapshot` that replaced the entire `notes.value` array with Firestore docs. Since `content` is intentionally stripped before Firestore saves (stored locally + R2 only), every snapshot wiped locally-loaded content from the reactive array.

2. **Vault content never loaded** — `NotesView.vue` computed `selectedNote` directly from the reactive array but never called `setActiveNote()`, which is the function responsible for reading content from the local vault (`~/Documents/ProductivityEngine/Notes/`).

3. **Duplicate push** — `createNote` called `notes.value.unshift(draft)` twice, duplicating new notes in the array.

## Changes Made

### `useNoteStore.ts`
- **`loadNotes` callback**: Now merges incoming Firestore docs with existing notes, preserving locally-loaded `content` fields.
- **`createNote`**: Removed duplicate `notes.value.unshift(draft)`.
- **`updateNote`**: Added `Object.assign(activeNote.value, updated)` to keep `activeNote` in sync during saves.
- **`setActiveNote`**: Now also updates `notes.value[idx]` when content is loaded from vault.

### `NotesView.vue`
- `handleNoteClick` now calls `noteStore.setActiveNote()` to load vault content.
- Editor prop changed from `selectedNote` (computed from array) to `noteStore.activeNote`.
- All template references updated from `selectedNote` to `noteStore.activeNote`.

### `NoteEditor.vue`
- Added `hasLoadedContent` flag to prevent reactive content changes from overwriting user edits.
- Added content watcher for async vault loading via `setActiveNote`.
- `onUpdate` sets `hasLoadedContent = true` so typing never gets overwritten.
- Removed unused `onMounted` import.
