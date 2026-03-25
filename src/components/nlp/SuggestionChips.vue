<script setup lang="ts">
import { computed } from 'vue'
import { useFrameworkStore } from '@/stores/frameworks'
import { useHabitStore } from '@/stores/habits'

const emit = defineEmits<{
  select: [text: string]
}>()

const fw = useFrameworkStore()
const habits = useHabitStore()

const chips = computed(() => {
  const items: { label: string; icon: string; text: string }[] = []

  if (!fw.activeSession) {
    items.push({ label: 'Start Pomodoro', icon: '🍅', text: 'Start a pomodoro session' })
    items.push({ label: 'Start Daily 6', icon: '6️⃣', text: 'Start Daily 6 session' })
  }

  if (habits.todayCompleted < habits.todayTotal) {
    items.push({ label: 'Check in habits', icon: '✓', text: 'Check in on my habits for today' })
  }

  items.push({ label: "Today's brief", icon: '📋', text: "Give me today's productivity brief" })
  items.push({ label: 'Add quick task', icon: '+', text: 'Create a new task: ' })
  items.push({ label: 'Schedule block', icon: '🗓️', text: 'Schedule a focus block for ' })

  return items
})
</script>

<template>
  <div>
    <p class="text-xs text-zinc-600 mb-2">Quick actions</p>
    <div
      class="flex gap-2 overflow-x-auto pb-1 scrollbar-thin"
      role="list"
      aria-label="Quick action suggestions"
    >
      <button
        v-for="chip in chips"
        :key="chip.label"
        @click="emit('select', chip.text)"
        class="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800/60 border border-zinc-700/40 text-sm text-zinc-300 hover:text-zinc-100 hover:bg-zinc-700/60 hover:border-zinc-600/60 transition-all duration-150 active:scale-95"
        role="listitem"
        :aria-label="`Quick action: ${chip.label}`"
      >
        <span class="text-sm leading-none" aria-hidden="true">{{ chip.icon }}</span>
        <span>{{ chip.label }}</span>
      </button>
    </div>
  </div>
</template>
