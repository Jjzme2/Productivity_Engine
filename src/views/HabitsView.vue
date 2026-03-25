<script setup lang="ts">
import { ref } from 'vue'
import { useHabitStore } from '@/stores/habits'
import { useAppStore } from '@/stores/app'
import HabitDashboard from '@/components/habits/HabitDashboard.vue'
import HabitCreateForm from '@/components/habits/HabitCreateForm.vue'
import HabitStreakCalendar from '@/components/habits/HabitStreakCalendar.vue'
import BaseButton from '@/components/shared/BaseButton.vue'

const habitStore = useHabitStore()
const app = useAppStore()

const showCreateForm = ref(false)
const selectedHabitId = ref<string | null>(null)

const selectedHabit = () =>
  selectedHabitId.value
    ? habitStore.habitsWithStreak.find(h => h.id === selectedHabitId.value) ?? null
    : null

const selectedEntries = () =>
  selectedHabitId.value
    ? habitStore.entries.filter(e => e.habitId === selectedHabitId.value)
    : []

function handleHabitClick(id: string) {
  selectedHabitId.value = id === selectedHabitId.value ? null : id
}

function handleCreated(_id: string) {
  showCreateForm.value = false
  app.addToast({ message: 'Habit created', variant: 'success' })
}
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden">
    <!-- Top bar -->
    <div class="flex items-center justify-between px-6 py-4 border-b border-zinc-800/50 flex-shrink-0">
      <h1 class="text-lg font-semibold text-zinc-100">Habits</h1>
      <BaseButton variant="primary" size="sm" @click="showCreateForm = true">
        <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        New habit
      </BaseButton>
    </div>

    <!-- Content -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Dashboard -->
      <div class="flex-1 overflow-y-auto p-6">
        <HabitDashboard
          @habit-click="handleHabitClick"
          @create-habit="showCreateForm = true"
        />
      </div>

      <!-- Streak calendar detail panel -->
      <Transition name="slide-in">
        <div
          v-if="selectedHabit()"
          class="w-80 border-l border-zinc-800/50 flex-shrink-0 overflow-y-auto bg-zinc-950 p-4 space-y-4"
        >
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-semibold text-zinc-200">{{ selectedHabit()!.title }}</h2>
            <button
              @click="selectedHabitId = null"
              class="w-6 h-6 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60 transition-all"
              aria-label="Close"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Streak stats -->
          <div class="grid grid-cols-2 gap-2 text-center">
            <div class="bg-zinc-900 rounded-xl p-3 border border-zinc-800/50">
              <p class="text-xl font-bold text-zinc-100">{{ selectedHabit()!.streak.current }}</p>
              <p class="text-xs text-zinc-500">Current streak</p>
            </div>
            <div class="bg-zinc-900 rounded-xl p-3 border border-zinc-800/50">
              <p class="text-xl font-bold text-zinc-100">{{ selectedHabit()!.streak.longest }}</p>
              <p class="text-xs text-zinc-500">Longest streak</p>
            </div>
          </div>

          <HabitStreakCalendar
            :habit-id="selectedHabitId!"
            :entries="selectedEntries()"
            :months="3"
          />
        </div>
      </Transition>
    </div>

    <!-- Create habit modal (managed internally by HabitCreateForm via v-model) -->
    <HabitCreateForm v-model="showCreateForm" @created="handleCreated" />
  </div>
</template>

<style scoped>
.slide-in-enter-active,
.slide-in-leave-active {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.slide-in-enter-from,
.slide-in-leave-to {
  transform: translateX(24px);
  opacity: 0;
}
</style>
