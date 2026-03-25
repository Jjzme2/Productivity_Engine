<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { useFrameworkStore } from '@/stores/frameworks'
import { useCalendarStore } from '@/stores/calendar'

const route = useRoute()
const app = useAppStore()
const fw = useFrameworkStore()
const cal = useCalendarStore()

const collapsed = computed(() => app.sidebarCollapsed)

const navItems = [
  { to: '/',           label: 'Dashboard',       icon: 'home' },
  { to: '/tasks',      label: 'Tasks',            icon: 'check-square' },
  { to: '/habits',     label: 'Habits',           icon: 'repeat' },
  { to: '/notes',      label: 'Notes',            icon: 'file-text' },
  { to: '/calendar',   label: 'Calendar',         icon: 'calendar' },
  { to: '/frameworks', label: 'Frameworks',       icon: 'layers' },
  { to: '/finance',    label: 'Finance',          icon: 'dollar-sign' },
  { to: '/dates',      label: 'Important Dates',  icon: 'heart' },
  { to: '/analytics',  label: 'Analytics',        icon: 'bar-chart-2' },
]

const bottomItems = [
  { to: '/settings', label: 'Settings', icon: 'settings' },
]

function isActive(path: string) {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}

// Pomodoro timer display
const pomodoroDisplay = computed(() => {
  const s = fw.activeSession
  if (!s || s.frameworkType !== 'pomodoro') return null
  const m = Math.floor(s.pomodoroSecondsLeft / 60).toString().padStart(2, '0')
  const sec = (s.pomodoroSecondsLeft % 60).toString().padStart(2, '0')
  return `${m}:${sec}`
})
</script>

<template>
  <nav
    class="flex flex-col bg-zinc-900 border-r border-zinc-800/50 h-full overflow-hidden transition-all duration-300 ease-smooth select-none"
    :class="collapsed ? 'w-16' : 'w-[220px]'"
    :aria-label="'Primary navigation'"
    :aria-expanded="!collapsed"
  >
    <!-- Logo / Brand -->
    <div
      class="flex items-center gap-3 px-3 py-4 border-b border-zinc-800/50"
      :class="collapsed ? 'justify-center' : 'justify-start'"
    >
      <div class="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
        <svg class="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      <Transition name="fade-in">
        <div v-if="!collapsed" class="min-w-0 overflow-hidden">
          <p class="font-semibold text-zinc-100 text-sm tracking-tight leading-tight whitespace-nowrap">Productivity Engine</p>
          <p class="text-[10px] text-zinc-500 tracking-widest uppercase leading-tight whitespace-nowrap">ILYTAT Suite</p>
        </div>
      </Transition>
    </div>

    <!-- Active Framework Indicator -->
    <Transition name="slide-down">
      <div
        v-if="fw.activeFramework"
        class="mx-2 mt-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 p-2 flex items-center gap-2 overflow-hidden"
      >
        <div class="w-2 h-2 rounded-full bg-indigo-400 animate-pulse flex-shrink-0" />
        <template v-if="!collapsed">
          <div class="flex-1 min-w-0">
            <p class="text-xs font-medium text-indigo-300 truncate">{{ fw.activeFramework.name }}</p>
            <p v-if="pomodoroDisplay" class="text-xs font-mono text-indigo-400">{{ pomodoroDisplay }}</p>
          </div>
        </template>
      </div>
    </Transition>

    <!-- Nav items -->
    <ul class="flex-1 overflow-y-auto py-2 space-y-0.5 px-2" role="list">
      <li v-for="item in navItems" :key="item.to" role="listitem">
        <router-link
          :to="item.to"
          class="group flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium transition-all duration-150 focus-visible:ring-2 focus-visible:ring-indigo-500"
          :class="[
            isActive(item.to)
              ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20'
              : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60',
            collapsed ? 'justify-center' : ''
          ]"
          :aria-current="isActive(item.to) ? 'page' : undefined"
          :title="collapsed ? item.label : undefined"
        >
          <!-- Icon -->
          <span class="flex-shrink-0 w-5 h-5 flex items-center justify-center" aria-hidden="true">
            <NavIcon :name="item.icon" class="w-[18px] h-[18px]" />
          </span>
          <!-- Label -->
          <Transition name="fade-in">
            <span
              v-if="!collapsed"
              class="whitespace-nowrap overflow-hidden text-ellipsis"
            >
              {{ item.label }}
            </span>
          </Transition>
          <!-- Active dot when collapsed -->
          <span
            v-if="collapsed && isActive(item.to)"
            class="absolute right-1 top-1/2 -translate-y-1/2 w-1 h-4 rounded-full bg-indigo-400"
            aria-hidden="true"
          />
        </router-link>
      </li>
    </ul>

    <!-- Bottom section -->
    <div class="border-t border-zinc-800/50 py-2 px-2 space-y-0.5">
      <!-- Sync indicator -->
      <div
        v-if="!collapsed"
        class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
        title="Calendar sync status"
      >
        <span
          class="w-1.5 h-1.5 rounded-full flex-shrink-0"
          :class="{
            'bg-emerald-400': cal.syncState === 'idle',
            'bg-amber-400 animate-pulse': cal.syncState === 'syncing',
            'bg-rose-400': cal.syncState === 'error',
            'bg-zinc-500': cal.syncState === 'unauthorized',
          }"
          aria-hidden="true"
        />
        <span class="text-xs text-zinc-500 truncate">
          {{ cal.syncState === 'idle' ? 'Synced' : cal.syncState === 'syncing' ? 'Syncing...' : cal.syncState === 'error' ? 'Sync error' : 'Not connected' }}
        </span>
      </div>

      <router-link
        v-for="item in bottomItems"
        :key="item.to"
        :to="item.to"
        class="group flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium transition-all duration-150 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60"
        :class="collapsed ? 'justify-center' : ''"
        :title="collapsed ? item.label : undefined"
        :aria-current="isActive(item.to) ? 'page' : undefined"
      >
        <NavIcon :name="item.icon" class="w-[18px] h-[18px] flex-shrink-0" aria-hidden="true" />
        <Transition name="fade-in">
          <span v-if="!collapsed" class="whitespace-nowrap overflow-hidden">{{ item.label }}</span>
        </Transition>
      </router-link>

      <!-- Collapse toggle -->
      <button
        @click="app.toggleSidebar"
        class="w-full flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40 transition-all duration-150"
        :class="collapsed ? 'justify-center' : ''"
        :aria-label="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
      >
        <svg
          class="w-4 h-4 flex-shrink-0 transition-transform duration-300"
          :class="collapsed ? 'rotate-180' : ''"
          fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7M18 19l-7-7 7-7" />
        </svg>
        <Transition name="fade-in">
          <span v-if="!collapsed">Collapse</span>
        </Transition>
      </button>
    </div>
  </nav>
</template>

<script lang="ts">
// NavIcon helper component inline
import { defineComponent, h } from 'vue'

const icons: Record<string, string> = {
  home: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  'check-square': 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  repeat: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  'file-text': 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  calendar: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  layers: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  'dollar-sign': 'M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',
  heart: 'M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z',
  'bar-chart-2': 'M18 20V10M12 20V4M6 20v-6',
  settings: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
}

const NavIcon = defineComponent({
  name: 'NavIcon',
  props: { name: { type: String, required: true } },
  setup(props) {
    return () => h('svg', {
      fill: 'none',
      stroke: 'currentColor',
      viewBox: '0 0 24 24',
      'aria-hidden': 'true',
    }, [
      h('path', {
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        'stroke-width': '1.75',
        d: icons[props.name] ?? '',
      })
    ])
  }
})

export { NavIcon }
</script>
