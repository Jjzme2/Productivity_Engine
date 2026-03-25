<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import type { TaskStatus, Priority } from '@/types/task'
import BaseInput from '@/components/shared/BaseInput.vue'
import BaseBadge from '@/components/shared/BaseBadge.vue'
import BaseButton from '@/components/shared/BaseButton.vue'

const tasks = useTaskStore()

const statusOptions: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'Todo' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Done' },
]

const priorityOptions: { value: Priority; label: string }[] = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

type DateFilter = 'all' | 'today' | 'week' | 'overdue'
const dateFilter = ref<DateFilter>('all')

const activeFilterCount = computed(() => {
  let count = 0
  if (tasks.activeFilter.status?.length) count++
  if (tasks.activeFilter.priority?.length) count++
  if (dateFilter.value !== 'all') count++
  if (tasks.activeFilter.searchQuery) count++
  return count
})

function toggleStatus(status: TaskStatus) {
  const current = tasks.activeFilter.status ?? []
  const next = current.includes(status)
    ? current.filter(s => s !== status)
    : [...current, status]
  tasks.setFilter({ ...tasks.activeFilter, status: next.length ? next : undefined })
}

function togglePriority(priority: Priority) {
  const current = tasks.activeFilter.priority ?? []
  const next = current.includes(priority)
    ? current.filter(p => p !== priority)
    : [...current, priority]
  tasks.setFilter({ ...tasks.activeFilter, priority: next.length ? next : undefined })
}

function setDateFilter(value: DateFilter) {
  dateFilter.value = value
  const today = new Date().toISOString().slice(0, 10)
  const weekEnd = new Date()
  weekEnd.setDate(weekEnd.getDate() + 7)

  if (value === 'today') {
    tasks.setFilter({ ...tasks.activeFilter, dueBefore: today, dueAfter: today })
  } else if (value === 'week') {
    tasks.setFilter({ ...tasks.activeFilter, dueAfter: today, dueBefore: weekEnd.toISOString().slice(0, 10) })
  } else if (value === 'overdue') {
    tasks.setFilter({ ...tasks.activeFilter, dueBefore: today })
  } else {
    const { dueBefore, dueAfter, ...rest } = tasks.activeFilter
    tasks.setFilter(rest)
  }
}

function clearAll() {
  tasks.clearFilter()
  dateFilter.value = 'all'
}

const sortOptions = [
  { value: 'priority', label: 'Priority' },
  { value: 'dueDate', label: 'Due Date' },
  { value: 'createdAt', label: 'Created' },
  { value: 'title', label: 'Title' },
]
const sort = ref('priority')
</script>

<template>
  <div class="flex flex-col gap-3 p-4 bg-zinc-900/50 border-b border-zinc-800/50">
    <!-- Row 1: search + sort -->
    <div class="flex items-center gap-3">
      <div class="flex-1 max-w-xs">
        <BaseInput
          :model-value="tasks.activeFilter.searchQuery ?? ''"
          placeholder="Search tasks..."
          @update:model-value="tasks.setFilter({ ...tasks.activeFilter, searchQuery: $event || undefined })"
        >
          <template #prefix>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </template>
        </BaseInput>
      </div>

      <!-- Sort -->
      <select
        v-model="sort"
        class="bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
        aria-label="Sort tasks by"
      >
        <option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>

      <!-- Clear button -->
      <button
        v-if="activeFilterCount > 0"
        @click="clearAll"
        class="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
        aria-label="Clear all filters"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
        Clear
        <span class="w-5 h-5 rounded-full bg-indigo-500 text-white text-[10px] font-bold flex items-center justify-center">
          {{ activeFilterCount }}
        </span>
      </button>
    </div>

    <!-- Row 2: status filters -->
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-xs text-zinc-600 mr-1">Status</span>
      <button
        v-for="opt in statusOptions"
        :key="opt.value"
        @click="toggleStatus(opt.value)"
        class="px-2.5 py-1 rounded-lg text-xs font-medium border transition-all duration-150"
        :class="tasks.activeFilter.status?.includes(opt.value)
          ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
          : 'bg-zinc-800/50 text-zinc-400 border-zinc-700/40 hover:text-zinc-200 hover:border-zinc-600/60'"
        :aria-pressed="tasks.activeFilter.status?.includes(opt.value)"
      >
        {{ opt.label }}
      </button>

      <span class="text-xs text-zinc-600 mx-1">Priority</span>
      <button
        v-for="opt in priorityOptions"
        :key="opt.value"
        @click="togglePriority(opt.value)"
        class="px-2.5 py-1 rounded-lg text-xs font-medium border transition-all duration-150"
        :class="tasks.activeFilter.priority?.includes(opt.value)
          ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
          : 'bg-zinc-800/50 text-zinc-400 border-zinc-700/40 hover:text-zinc-200 hover:border-zinc-600/60'"
        :aria-pressed="tasks.activeFilter.priority?.includes(opt.value)"
      >
        {{ opt.label }}
      </button>

      <span class="text-xs text-zinc-600 mx-1">Due</span>
      <button
        v-for="opt in [{ value: 'all', label: 'All' }, { value: 'today', label: 'Today' }, { value: 'week', label: 'This Week' }, { value: 'overdue', label: 'Overdue' }]"
        :key="opt.value"
        @click="setDateFilter(opt.value as DateFilter)"
        class="px-2.5 py-1 rounded-lg text-xs font-medium border transition-all duration-150"
        :class="dateFilter === opt.value
          ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
          : 'bg-zinc-800/50 text-zinc-400 border-zinc-700/40 hover:text-zinc-200 hover:border-zinc-600/60'"
        :aria-pressed="dateFilter === opt.value"
      >
        {{ opt.label }}
      </button>
    </div>
  </div>
</template>
