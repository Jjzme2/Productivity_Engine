<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Habit, HabitEntry, StreakData } from '@/types/habit'
import { useHabitStore } from '@/stores/habits'

const props = defineProps<{
  habit: Habit
  entry: HabitEntry | null
  streak: StreakData
}>()

const emit = defineEmits<{
  click: [id: string]
}>()

const habitStore = useHabitStore()
const isCheckingIn = ref(false)
const showGlow = ref(false)

const isCompleted = computed(() => props.entry?.completed ?? false)

const streakDisplay = computed(() => {
  const n = props.streak.current
  if (n >= 30) return `${n} 🔥🔥🔥`
  if (n >= 14) return `${n} 🔥🔥`
  if (n >= 3) return `${n} 🔥`
  return `${n}`
})

async function handleCheckIn() {
  if (isCompleted.value || isCheckingIn.value) return
  isCheckingIn.value = true
  habitStore.checkIn(props.habit.id)
  showGlow.value = true
  setTimeout(() => {
    isCheckingIn.value = false
    showGlow.value = false
  }, 1000)
}
</script>

<template>
  <div
    class="bg-zinc-900 border border-zinc-800/50 rounded-2xl p-4 transition-all duration-300 cursor-pointer hover:border-zinc-700/60 hover:shadow-card-hover"
    :class="showGlow ? 'habit-completed-glow' : ''"
    @click="emit('click', habit.id)"
    role="article"
    :aria-label="`Habit: ${habit.title}, streak: ${streak.current} days`"
  >
    <div class="flex items-start gap-3">
      <!-- Icon -->
      <div
        class="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
        :style="{ backgroundColor: `${habit.color ?? '#6366f1'}20`, border: `1px solid ${habit.color ?? '#6366f1'}30` }"
        aria-hidden="true"
      >
        {{ habit.icon ?? '✓' }}
      </div>

      <!-- Content -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between">
          <p class="text-sm font-medium text-zinc-100 truncate">{{ habit.title }}</p>
          <!-- Streak display -->
          <span
            v-if="streak.current > 0"
            class="text-xs font-mono font-semibold text-amber-400 ml-2 flex-shrink-0"
            :aria-label="`Streak: ${streak.current} days`"
          >
            {{ streakDisplay }}
          </span>
        </div>

        <div class="flex items-center justify-between mt-2">
          <span
            class="text-xs capitalize"
            :class="isCompleted ? 'text-emerald-400' : 'text-zinc-500'"
          >
            {{ isCompleted ? 'Completed today' : habit.frequency }}
          </span>

          <!-- Check-in button -->
          <button
            @click.stop="handleCheckIn"
            :disabled="isCompleted"
            class="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium border transition-all duration-200 active:scale-90 focus-visible:ring-2 focus-visible:ring-indigo-500 relative overflow-hidden"
            :class="isCompleted
              ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400 cursor-default'
              : 'bg-zinc-800/60 border-zinc-700/40 text-zinc-300 hover:bg-zinc-700/60 hover:border-indigo-500/30 hover:text-indigo-300'"
            :aria-label="isCompleted ? 'Habit completed today' : 'Check in this habit'"
            :aria-pressed="isCompleted"
          >
            <svg
              class="w-3 h-3 transition-transform duration-200"
              :class="isCheckingIn ? 'scale-125' : ''"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
            </svg>
            {{ isCompleted ? 'Done' : 'Check in' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
