<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { Task, TaskStatus } from '@/types/task'
import { useTaskStore } from '@/stores/tasks'
import TaskCard from './TaskCard.vue'
import EmptyState from '@/components/shared/EmptyState.vue'

const props = defineProps<{
  tasks: Task[]
  view?: 'kanban' | 'list'
}>()

const emit = defineEmits<{
  taskClick: [id: string]
  taskEdit: [id: string]
  taskComplete: [id: string]
  taskDelete: [id: string]
}>()

const taskStore = useTaskStore()

const STORAGE_KEY = 'pe_task_board_view'
const currentView = ref<'kanban' | 'list'>(props.view ?? (localStorage.getItem(STORAGE_KEY) as any ?? 'kanban'))

function setView(v: 'kanban' | 'list') {
  currentView.value = v
  localStorage.setItem(STORAGE_KEY, v)
}

// Kanban columns
const columns: { id: TaskStatus; label: string; color: string }[] = [
  { id: 'todo',        label: 'Todo',        color: 'border-t-zinc-600' },
  { id: 'in_progress', label: 'In Progress', color: 'border-t-indigo-500' },
  { id: 'blocked',     label: 'Blocked',     color: 'border-t-rose-500' },
  { id: 'done',        label: 'Done',        color: 'border-t-emerald-500' },
]

const tasksByStatus = computed(() => {
  const map: Record<TaskStatus, Task[]> = { todo: [], in_progress: [], blocked: [], done: [], cancelled: [] }
  props.tasks.forEach(t => map[t.status].push(t))
  return map
})

// Drag and drop
const draggingId = ref<string | null>(null)
const dragOverColumn = ref<TaskStatus | null>(null)

function onDragStart(e: DragEvent, taskId: string) {
  draggingId.value = taskId
  e.dataTransfer?.setData('text/plain', taskId)
}

function onDragOver(e: DragEvent, colId: TaskStatus) {
  e.preventDefault()
  dragOverColumn.value = colId
}

function onDragLeave() {
  dragOverColumn.value = null
}

function onDrop(e: DragEvent, colId: TaskStatus) {
  e.preventDefault()
  const taskId = draggingId.value ?? e.dataTransfer?.getData('text/plain')
  if (taskId) taskStore.updateTask({ id: taskId, status: colId })
  draggingId.value = null
  dragOverColumn.value = null
}

function onDragEnd() {
  draggingId.value = null
  dragOverColumn.value = null
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- View toggle -->
    <div class="flex items-center gap-1 p-3 border-b border-zinc-800/50">
      <button
        v-for="v in ['kanban', 'list'] as const"
        :key="v"
        @click="setView(v)"
        class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150"
        :class="currentView === v
          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'"
        :aria-pressed="currentView === v"
      >
        {{ v === 'kanban' ? 'Board' : 'List' }}
      </button>
    </div>

    <!-- Kanban view -->
    <div
      v-if="currentView === 'kanban'"
      class="flex-1 overflow-x-auto"
    >
      <div class="flex gap-4 p-4 h-full min-w-max">
        <div
          v-for="col in columns"
          :key="col.id"
          class="flex flex-col w-72 flex-shrink-0"
        >
          <!-- Column header -->
          <div
            class="flex items-center justify-between mb-3 pb-2 border-b-2"
            :class="col.color"
          >
            <span class="text-sm font-semibold text-zinc-300">{{ col.label }}</span>
            <span class="text-xs text-zinc-600 font-mono bg-zinc-800/60 px-1.5 py-0.5 rounded-md">
              {{ tasksByStatus[col.id].length }}
            </span>
          </div>

          <!-- Drop zone -->
          <div
            class="flex-1 overflow-y-auto space-y-2 min-h-24 rounded-xl p-2 -mx-2 transition-colors duration-150"
            :class="dragOverColumn === col.id ? 'bg-indigo-500/5 ring-1 ring-indigo-500/20' : ''"
            @dragover="onDragOver($event, col.id)"
            @dragleave="onDragLeave"
            @drop="onDrop($event, col.id)"
            :aria-label="`${col.label} column, ${tasksByStatus[col.id].length} tasks`"
            role="list"
          >
            <TaskCard
              v-for="task in tasksByStatus[col.id]"
              :key="task.id"
              :task="task"
              :draggable="true"
              role="listitem"
              @click="emit('taskClick', task.id)"
              @edit="emit('taskEdit', $event)"
              @complete="emit('taskComplete', $event)"
              @delete="emit('taskDelete', $event)"
              @dragstart="onDragStart($event, task.id)"
              @dragend="onDragEnd"
            />

            <div
              v-if="tasksByStatus[col.id].length === 0"
              class="text-center py-8 text-zinc-700 text-sm"
            >
              Drop tasks here
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- List view -->
    <div v-else class="flex-1 overflow-y-auto p-4 space-y-2">
      <template v-if="tasks.length > 0">
        <TaskCard
          v-for="task in tasks"
          :key="task.id"
          :task="task"
          @click="emit('taskClick', task.id)"
          @edit="emit('taskEdit', $event)"
          @complete="emit('taskComplete', $event)"
          @delete="emit('taskDelete', $event)"
        />
      </template>
      <EmptyState
        v-else
        title="No tasks found"
        description="Create a task or adjust your filters."
      />
    </div>
  </div>
</template>
