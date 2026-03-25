<script setup lang="ts">
import { ref, computed } from 'vue'
import type { CreateHabitPayload, HabitFrequency, HabitCategory } from '@/types/habit'
import { useHabitStore } from '@/stores/habits'
import { useAppStore } from '@/stores/app'
import BaseModal from '@/components/shared/BaseModal.vue'
import BaseButton from '@/components/shared/BaseButton.vue'
import BaseInput from '@/components/shared/BaseInput.vue'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  created: [id: string]
}>()

const habitStore = useHabitStore()
const app = useAppStore()

const form = ref<CreateHabitPayload>({
  title: '',
  description: '',
  icon: '✓',
  color: '#6366f1',
  frequency: 'daily',
  targetCount: 1,
  category: 'productivity',
})
const customDays = ref<number[]>([1, 2, 3, 4, 5])
const saving = ref(false)
const error = ref('')

const frequencyOptions: { value: HabitFrequency; label: string }[] = [
  { value: 'daily',    label: 'Every day' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekends', label: 'Weekends' },
  { value: 'weekly',   label: 'Once a week' },
  { value: 'custom',   label: 'Custom days' },
]

const categories: HabitCategory[] = ['health', 'fitness', 'mindfulness', 'learning', 'productivity', 'social', 'finance', 'creativity', 'other']

const presetColors = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f59e0b', '#10b981', '#06b6d4', '#3b82f6',
]

const emojiGrid = ['✓', '💪', '📚', '🧘', '💧', '🏃', '🍎', '😴', '✍️', '🎯', '💡', '🌱', '🎸', '🧹', '💰', '🤝']

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function toggleDay(d: number) {
  const idx = customDays.value.indexOf(d)
  if (idx !== -1) customDays.value.splice(idx, 1)
  else customDays.value.push(d)
}

async function handleSave() {
  if (!form.value.title.trim()) {
    error.value = 'Habit name is required'
    return
  }
  saving.value = true
  error.value = ''
  try {
    const payload: CreateHabitPayload = {
      ...form.value,
      customDays: form.value.frequency === 'custom' ? customDays.value : undefined,
    }
    const habit = await habitStore.createHabit(payload)
    app.addToast({ message: 'Habit created!', variant: 'success' })
    emit('created', habit.id)
    emit('update:modelValue', false)
    resetForm()
  } finally {
    saving.value = false
  }
}

function resetForm() {
  form.value = {
    title: '',
    description: '',
    icon: '✓',
    color: '#6366f1',
    frequency: 'daily',
    targetCount: 1,
    category: 'productivity',
  }
  customDays.value = [1, 2, 3, 4, 5]
  error.value = ''
}
</script>

<template>
  <BaseModal
    :model-value="modelValue"
    title="Create New Habit"
    size="lg"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="grid grid-cols-2 gap-6">
      <!-- Left: form -->
      <div class="space-y-4">
        <!-- Name -->
        <BaseInput
          v-model="form.title"
          label="Habit name"
          placeholder="e.g., Morning meditation"
          :error="error"
          autofocus
        />

        <!-- Description -->
        <BaseInput
          v-model="form.description"
          label="Description (optional)"
        />

        <!-- Frequency -->
        <div>
          <p class="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">Frequency</p>
          <div class="grid grid-cols-2 gap-1.5">
            <button
              v-for="opt in frequencyOptions"
              :key="opt.value"
              @click="form.frequency = opt.value"
              class="px-3 py-2 rounded-xl text-sm border transition-all duration-150 text-left"
              :class="form.frequency === opt.value
                ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300'
                : 'bg-zinc-800/50 border-zinc-700/40 text-zinc-400 hover:text-zinc-200'"
              :aria-pressed="form.frequency === opt.value"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <!-- Custom days picker -->
        <div v-if="form.frequency === 'custom'">
          <p class="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">Which days?</p>
          <div class="flex gap-1.5 flex-wrap">
            <button
              v-for="(name, i) in dayNames"
              :key="i"
              @click="toggleDay(i)"
              class="w-9 h-9 rounded-xl text-xs font-medium border transition-all duration-150"
              :class="customDays.includes(i)
                ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300'
                : 'bg-zinc-800/50 border-zinc-700/40 text-zinc-500'"
              :aria-pressed="customDays.includes(i)"
              :aria-label="name"
            >
              {{ name }}
            </button>
          </div>
        </div>

        <!-- Color picker -->
        <div>
          <p class="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">Color</p>
          <div class="flex gap-2 flex-wrap">
            <button
              v-for="color in presetColors"
              :key="color"
              @click="form.color = color"
              class="w-7 h-7 rounded-lg border-2 transition-all duration-150"
              :style="{ backgroundColor: color }"
              :class="form.color === color ? 'border-white scale-110' : 'border-transparent'"
              :aria-label="`Select color ${color}`"
              :aria-pressed="form.color === color"
            />
          </div>
        </div>

        <!-- Icon picker -->
        <div>
          <p class="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">Icon</p>
          <div class="grid grid-cols-8 gap-1">
            <button
              v-for="emoji in emojiGrid"
              :key="emoji"
              @click="form.icon = emoji"
              class="w-8 h-8 rounded-lg text-base flex items-center justify-center border transition-all duration-150"
              :class="form.icon === emoji
                ? 'border-indigo-500/50 bg-indigo-500/15 scale-110'
                : 'border-zinc-700/40 bg-zinc-800/50 hover:bg-zinc-700/50'"
              :aria-label="`Icon ${emoji}`"
              :aria-pressed="form.icon === emoji"
            >
              {{ emoji }}
            </button>
          </div>
        </div>
      </div>

      <!-- Right: live preview -->
      <div class="flex flex-col">
        <p class="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">Preview</p>
        <div class="bg-zinc-800/60 border border-zinc-700/40 rounded-2xl p-4">
          <div class="flex items-start gap-3">
            <div
              class="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
              :style="{ backgroundColor: `${form.color}20`, border: `1px solid ${form.color}30` }"
              aria-hidden="true"
            >
              {{ form.icon || '✓' }}
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-zinc-100 truncate">
                {{ form.title || 'Habit name' }}
              </p>
              <p class="text-xs text-zinc-500 capitalize mt-0.5">
                {{ form.frequency === 'custom'
                  ? customDays.map(d => dayNames[d]).join(', ')
                  : form.frequency.replace('_', ' ') }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <BaseButton variant="ghost" size="sm" @click="emit('update:modelValue', false)">
        Cancel
      </BaseButton>
      <BaseButton variant="primary" size="sm" :loading="saving" @click="handleSave">
        Create Habit
      </BaseButton>
    </template>
  </BaseModal>
</template>
