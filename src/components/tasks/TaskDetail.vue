<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { Task, Priority, EisenhowerQuadrant, TaskStatus } from '@/types/task'
import { useTaskStore } from '@/stores/tasks'
import { useAppStore } from '@/stores/app'
import BaseButton from '@/components/shared/BaseButton.vue'
import ConfirmDialog from '@/components/shared/ConfirmDialog.vue'

const props = defineProps<{
  taskId: string | null
}>()

const emit = defineEmits<{
  close: []
}>()

const taskStore = useTaskStore()
const app = useAppStore()

const task = computed(() => taskStore.tasks.find(t => t.id === props.taskId) ?? null)

// Local editable copy
const title = ref('')
const description = ref('')
const priority = ref<Priority>('medium')
const dueDate = ref('')
const eisenhower = ref<EisenhowerQuadrant | ''>('')
const tags = ref('')
const showDeleteConfirm = ref(false)

watch(() => task.value, (t) => {
  if (!t) return
  title.value = t.title
  description.value = t.description ?? ''
  priority.value = t.priority
  dueDate.value = t.dueDate ?? ''
  eisenhower.value = t.eisenhowerQuadrant ?? ''
  tags.value = t.tags.join(', ')
}, { immediate: true })

function save() {
  if (!task.value) return
  taskStore.updateTask({
    id: task.value.id,
    title: title.value.trim() || task.value.title,
    description: description.value || undefined,
    priority: priority.value,
    dueDate: dueDate.value || undefined,
    eisenhowerQuadrant: (eisenhower.value as EisenhowerQuadrant) || undefined,
    tags: tags.value.split(',').map(t => t.trim()).filter(Boolean),
  })
  app.addToast({ message: 'Task saved', variant: 'success', durationMs: 1500 })
}

function handleDelete() {
  if (!task.value) return
  taskStore.deleteTask(task.value.id)
  app.addToast({ message: 'Task deleted', variant: 'info' })
  emit('close')
}

const priorityOptions: { value: Priority; label: string; color: string }[] = [
  { value: 'urgent', label: 'Urgent', color: 'text-rose-400' },
  { value: 'high',   label: 'High',   color: 'text-orange-400' },
  { value: 'medium', label: 'Medium', color: 'text-amber-400' },
  { value: 'low',    label: 'Low',    color: 'text-sky-400' },
]

const quadrantOptions: { value: EisenhowerQuadrant; label: string }[] = [
  { value: 'do_first',  label: 'Do First (Urgent + Important)' },
  { value: 'schedule',  label: 'Schedule (Important)' },
  { value: 'delegate',  label: 'Delegate (Urgent)' },
  { value: 'eliminate', label: 'Eliminate (Neither)' },
]
</script>

<template>
  <Transition name="slide-over">
    <aside
      v-if="task"
      class="fixed right-0 top-0 bottom-0 w-[480px] bg-zinc-900 border-l border-zinc-800/50 shadow-2xl z-30 flex flex-col overflow-hidden"
      role="complementary"
      aria-label="Task details"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-4 border-b border-zinc-800/50">
        <h2 class="text-sm font-semibold text-zinc-300">Task Details</h2>
        <button
          @click="emit('close')"
          class="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60 transition-all duration-150"
          aria-label="Close task details"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Scrollable content -->
      <div class="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        <!-- Title -->
        <div>
          <label class="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1.5 block" for="task-title">
            Title
          </label>
          <input
            id="task-title"
            v-model="title"
            type="text"
            class="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-xl px-3 py-2 text-base font-medium text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50"
            @blur="save"
          />
        </div>

        <!-- Priority -->
        <div>
          <label class="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1.5 block">Priority</label>
          <div class="flex gap-2 flex-wrap">
            <button
              v-for="opt in priorityOptions"
              :key="opt.value"
              @click="priority = opt.value; save()"
              class="px-3 py-1.5 rounded-xl text-sm font-medium border transition-all duration-150"
              :class="priority === opt.value
                ? `bg-zinc-700 border-zinc-600 ${opt.color}`
                : 'bg-zinc-800/50 border-zinc-700/40 text-zinc-500 hover:text-zinc-300'"
              :aria-pressed="priority === opt.value"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <!-- Due date -->
        <div>
          <label class="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1.5 block" for="task-due">
            Due Date
          </label>
          <input
            id="task-due"
            v-model="dueDate"
            type="date"
            class="bg-zinc-800/50 border border-zinc-700/50 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50"
            :style="{ colorScheme: 'dark' }"
            @change="save"
          />
        </div>

        <!-- Eisenhower quadrant -->
        <div>
          <label class="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1.5 block" for="task-quadrant">
            Eisenhower Quadrant
          </label>
          <select
            id="task-quadrant"
            v-model="eisenhower"
            class="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            @change="save"
          >
            <option value="">— Not assigned —</option>
            <option v-for="opt in quadrantOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>

        <!-- Tags -->
        <div>
          <label class="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1.5 block" for="task-tags">
            Tags <span class="text-zinc-600 normal-case">(comma separated)</span>
          </label>
          <input
            id="task-tags"
            v-model="tags"
            type="text"
            placeholder="work, urgent, follow-up"
            class="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50"
            @blur="save"
          />
        </div>

        <!-- Description -->
        <div>
          <label class="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1.5 block" for="task-desc">
            Description
          </label>
          <textarea
            id="task-desc"
            v-model="description"
            rows="4"
            placeholder="Add notes or details..."
            class="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50"
            @blur="save"
          />
        </div>

        <!-- Linked notes -->
        <div v-if="task.linkedNoteIds.length">
          <p class="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1.5">Linked Notes</p>
          <div class="flex flex-col gap-1">
            <div
              v-for="noteId in task.linkedNoteIds"
              :key="noteId"
              class="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-800/50 border border-zinc-700/40 text-sm text-zinc-300"
            >
              <svg class="w-3.5 h-3.5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {{ noteId }}
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-5 py-4 border-t border-zinc-800/50 flex items-center justify-between">
        <button
          @click="showDeleteConfirm = true"
          class="flex items-center gap-1.5 text-sm text-rose-400/70 hover:text-rose-400 transition-colors duration-150"
          aria-label="Delete task"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete task
        </button>

        <BaseButton variant="primary" size="sm" @click="save">
          Save changes
        </BaseButton>
      </div>
    </aside>
  </Transition>

  <!-- Backdrop when panel is open -->
  <Transition name="modal-backdrop">
    <div
      v-if="task"
      class="fixed inset-0 z-20 bg-zinc-950/40"
      @click="emit('close')"
      aria-hidden="true"
    />
  </Transition>

  <ConfirmDialog
    v-model="showDeleteConfirm"
    title="Delete task?"
    message="This will permanently remove the task. This action cannot be undone."
    confirm-label="Delete"
    variant="danger"
    @confirm="handleDelete"
  />
</template>
