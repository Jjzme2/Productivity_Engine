<template>
  <div
    class="h-8 flex justify-between items-center select-none bg-zinc-900 border-b border-zinc-800/80 shrink-0 relative z-[9999]"
  >
    <!-- Left Region (Drag / Title) -->
    <div class="px-4 flex items-center h-full gap-2 text-zinc-400 font-medium text-xs tracking-wide w-full" data-tauri-drag-region>
      Productivity Engine
    </div>
    
    <!-- Right Region (Controls) -->
    <div class="flex h-full shrink-0">
      <div
        class="inline-flex justify-center items-center w-11 h-full hover:bg-zinc-800 transition-colors cursor-default text-zinc-400 hover:text-zinc-100"
        @click="minimize"
        title="Minimize"
      >
        <svg fill="none" class="w-[11px] h-[11px]" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M4 12h16"/></svg>
      </div>
      <div
        class="inline-flex justify-center items-center w-11 h-full hover:bg-zinc-800 transition-colors cursor-default text-zinc-400 hover:text-zinc-100"
        @click="toggleMaximize"
        title="Maximize"
      >
        <svg fill="none" class="w-[11px] h-[11px]" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><rect width="16" height="16" x="4" y="4" rx="2"/></svg>
      </div>
      <div
        class="inline-flex justify-center items-center w-11 h-full hover:bg-red-500 hover:text-white transition-colors cursor-default text-zinc-400"
        @click="close"
        title="Close"
      >
        <svg fill="none" class="w-[11px] h-[11px]" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getCurrentWindow } from '@tauri-apps/api/window'

const appWindow = getCurrentWindow()

function minimize() {
  appWindow.minimize()
}

function toggleMaximize() {
  appWindow.toggleMaximize()
}

function close() {
  appWindow.close()
}
</script>
