<script setup lang="ts">
import { computed } from 'vue'
import { useHabitStore } from '@/stores/habits'
import HabitCard from './HabitCard.vue'
import EmptyState from '@/components/shared/EmptyState.vue'

const emit = defineEmits<{
  habitClick: [id: string]
  createHabit: []
}>()

const habitStore = useHabitStore()

const completed = computed(() => habitStore.habitsWithStreak.filter(h => h.todayEntry?.completed))
const due = computed(() => habitStore.habitsWithStreak.filter(h => !h.todayEntry?.completed))
const skipped = computed(() => habitStore.habitsWithStreak.filter(h => h.todayEntry && !h.todayEntry.completed))

const progressPercent = computed(() => {
  if (!habitStore.todayTotal) return 0
  return Math.round((habitStore.todayCompleted / habitStore.todayTotal) * 100)
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Today's progress header -->
    <div class="bg-zinc-900 border border-zinc-800/50 rounded-2xl p-4">
      <div class="flex items-center justify-between mb-3">
        <div>
          <h2 class="text-sm font-semibold text-zinc-100">Today's Progress</h2>
          <p class="text-xs text-zinc-500">
            {{ habitStore.todayCompleted }} / {{ habitStore.todayTotal }} habits completed
          </p>
        </div>
        <span class="text-2xl font-bold tabular text-zinc-100">{{ progressPercent }}%</span>
      </div>

      <!-- Progress bar -->
      <div
        class="h-2 w-full bg-zinc-800/60 rounded-full overflow-hidden"
        role="progressbar"
        :aria-valuenow="progressPercent"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-label="`${progressPercent}% of habits completed today`"
      >
        <div
          class="h-full rounded-full transition-all duration-700 ease-smooth"
          :class="progressPercent === 100
            ? 'bg-emerald-500'
            : progressPercent >= 50
              ? 'bg-indigo-500'
              : 'bg-indigo-500/60'"
          :style="{ width: `${progressPercent}%` }"
        />
      </div>
    </div>

    <!-- Empty state -->
    <EmptyState
      v-if="habitStore.habitsWithStreak.length === 0"
      title="No habits yet"
      description="Start tracking daily habits to build consistency and streaks."
      action-label="Create your first habit"
      action-icon="M12 4v16m8-8H4"
      @action="emit('createHabit')"
    />

    <!-- Due Today section -->
    <div v-if="due.length">
      <h3 class="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3 px-1">Due Today</h3>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <HabitCard
          v-for="h in due"
          :key="h.id"
          :habit="h"
          :entry="h.todayEntry ?? null"
          :streak="h.streak"
          @click="emit('habitClick', $event)"
        />
      </div>
    </div>

    <!-- Completed section -->
    <div v-if="completed.length">
      <h3 class="text-xs font-medium text-emerald-500/60 uppercase tracking-wide mb-3 px-1">Completed</h3>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <HabitCard
          v-for="h in completed"
          :key="h.id"
          :habit="h"
          :entry="h.todayEntry ?? null"
          :streak="h.streak"
          @click="emit('habitClick', $event)"
        />
      </div>
    </div>
  </div>
</template>
