---
Task: Custom Titlebar
Status: Completed
Model: Gemini 2.0 Flash
Date: 2026-03-24
---

# CustomTitlebarSummary

## Overview
Replaced the default native OS window frame with a sleek, custom-built application titlebar integrated directly into the `App.vue` UI layer.

## Steps Taken
1. **Disable Native Frame:** Updated `src-tauri/tauri.conf.json` by setting `"decorations": false`.
2. **Titlebar Component Creation:** Created `src/components/layout/Titlebar.vue`.
   - Built a sleek upper action bar matching the `bg-zinc-900` application theme.
   - Added standard interactive SVGs for Minimize, Maximize, and Close.
   - Bound those elements to `@tauri-apps/api/window` `getCurrentWindow()` methods (`minimize()`, `toggleMaximize()`, and `close()`).
   - Covered the empty regions with `data-tauri-drag-region` to retain draggable functionality.
3. **App Injection:** Inserted `<Titlebar />` at the root of `App.vue` and ensured the layout stack cleanly flexed underneath it without clipping routes.

## Code Changed
- `src-tauri/tauri.conf.json`
- `src/components/layout/Titlebar.vue` (New)
- `src/App.vue`
