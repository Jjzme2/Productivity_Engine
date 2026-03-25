<script setup lang="ts">
import { ref, computed } from 'vue'
import { formatDistanceToNow, isPast, isToday, isTomorrow, parseISO } from 'date-fns'
import type { Task } from '@/types/task'
import PriorityIcon from '@/components/shared/PriorityIcon.vue'
import BaseBadge from '@/components/shared/BaseBadge.vue'

const props = defineProps<{
  task: Task
  compact?: boolean
  draggable?: boolean
}>()

const emit = defineEmits<{
  complete: [id: string]
  edit: [id: string]
  delete: [id: string]
  click: [id: string]
}>()

const hovered = ref(false)
const completing = ref(false)
const completed = computed(() => props.task.status === 'done')

function handleComplete(e: Event) {
  e.stopPropagation()
  if (completed.value) return
  completing.value = true
  setTimeout(() => {
    emit('complete', props.task.id)
    completing.value = false
  }, 320)
}

const dueDateDisplay = computed(() => {
  if (!props.task.dueDate) return null
  const date = parseISO(props.task.dueDate)
  if (completed.value) return null
  if (isPast(date) && !isToday(date)) {
    const dist = formatDistanceToNow(date, { addSuffix: false })
    return { text: `Overdue ${dist}`, danger: true }
  }
  if (isToday(date)) return { text: 'Due today', danger: false }
  if (isTomorrow(date)) return { text: 'Due tomorrow', danger: false }
  return { text: `Due ${formatDistanceToNow(date, { addSuffix: true })}`, danger: false }
})
</script>

<template>
  <div
    class="group relative bg-zinc-900 border border-zinc-800/50 rounded-2xl transition-all duration-200"
    :class="[
      compact ? 'px-3 py-2.5' : 'px-4 py-3.5',
      completed ? 'opacity-60' : 'hover:border-zinc-700/60 hover:shadow-card-hover hover:shadow-indigo-500/5',
      draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
    ]"
    :draggable="draggable"
    @click="emit('click', task.id)"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
    :aria-label="`Task: ${task.title}, ${task.priority} priority`"
    role="article"
  >
    <div class="flex items-start gap-3">
      <!-- Checkbox -->
      <button
        @click.stop="handleComplete"
        class="flex-shrink-0 mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 focus-visible:ring-2 focus-visible:ring-indigo-500"
        :class="completed
          ? 'bg-indigo-500 border-indigo-500'
          : 'border-zinc-600 hover:border-indigo-400 bg-transparent'"
        :aria-label="completed ? 'Mark incomplete' : 'Mark complete'"
        :aria-pressed="completed"
      >
        <svg
          v-if="completed || completing"
          class="w-3 h-3 text-white transition-transform duration-200"
          :class="completing ? 'scale-125' : ''"
          fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
        </svg>
      </button>

      <!-- Content -->
      <div class="flex-1 min-w-0">
        <!-- Title row -->
        <div class="flex items-start gap-2 flex-wrap">
          <PriorityIcon :priority="task.priority" size="sm" />
          <span
            class="text-sm font-medium leading-snug relative"
            :class="completed ? 'text-zinc-500' : 'text-zinc-100'"
          >
            {{ task.title }}
            <!-- Strikethrough animation -->
            <span
              v-if="completed"
              class="strike-line"
              aria-hidden="true"
            />
          </span>
        </div>

        <!-- Due date + tags row -->
        <div v-if="!compact" class="mt-1.5 flex items-center flex-wrap gap-1.5">
          <span
            v-if="dueDateDisplay"
            class="text-xs"
            :class="dueDateDisplay.danger ? 'text-rose-400 font-medium' : 'text-zinc-500'"
            :aria-label="`Due date: ${dueDateDisplay.text}`"
          >
            {{ dueDateDisplay.text }}
          </span>
          <span
            v-for="tag in task.tags.slice(0, 3)"
            :key="tag"
            class="inline-flex items-center px-1.5 py-0.5 rounded-md bg-zinc-800/80 text-zinc-400 text-[11px] border border-zinc-700/40"
          >
            {{ tag }}
          </span>
          <span v-if="task.tags.length > 3" class="text-[11px] text-zinc-600">
            +{{ task.tags.length - 3 }}
          </span>
        </div>
      </div>

      <!-- Hover quick actions -->
      <Transition name="fade-in">
        <div
          v-if="hovered && !completed"
          class="flex items-center gap-1 flex-shrink-0"
          @click.stop
        >
          <button
            @click.stop="emit('edit', task.id)"
            class="w-6 h-6 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60 transition-all duration-150"
            aria-label="Edit task"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            @click.stop="emit('delete', task.id)"
            class="w-6 h-6 flex items-center justify-center rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-150"
            aria-label="Delete task"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </Transition>
    </div>
  </div>
</template>
