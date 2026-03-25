<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '@/stores/app'
import Sidebar from './Sidebar.vue'
import TopBar from './TopBar.vue'
import CommandBar from './CommandBar.vue'

const app = useAppStore()

const gridCols = computed(() => {
  if (app.focusMode) return 'grid-cols-[0_1fr]'
  return app.sidebarCollapsed
    ? 'grid-cols-[64px_1fr]'
    : 'grid-cols-[220px_1fr]'
})

</script>

<template>
  <div
    class="h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100 flex flex-col"
    :class="{ 'focus-mode': app.focusMode }"
  >
    <!-- Top Bar -->
    <Transition name="slide-down">
      <TopBar v-if="!app.focusMode" />
    </Transition>

    <!-- Main grid -->
    <div
      class="flex-1 grid transition-all duration-300 ease-smooth overflow-hidden"
      :class="gridCols"
      style="min-height: 0"
    >
      <!-- Sidebar -->
      <Transition name="sidebar">
        <Sidebar v-show="!app.focusMode" />
      </Transition>

      <!-- Content area -->
      <main
        class="relative z-0 overflow-hidden bg-zinc-950 flex flex-col"
        id="main-content"
        role="main"
        aria-label="Main content"
      >
        <div class="relative z-10 flex-1 overflow-auto scrollbar-thin">
          <router-view v-slot="{ Component, route }">
            <Transition name="fade-in" mode="out-in">
              <component :is="Component" :key="route.path" />
            </Transition>
          </router-view>
        </div>
      </main>
    </div>

    <!-- Command Bar Overlay -->
    <CommandBar />
  </div>
</template>
