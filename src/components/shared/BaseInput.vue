<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  modelValue?: string
  placeholder?: string
  label?: string
  error?: string
  type?: string
  autofocus?: boolean
  disabled?: boolean
  readonly?: boolean
  id?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  focus: [e: FocusEvent]
  blur: [e: FocusEvent]
  keydown: [e: KeyboardEvent]
}>()

const focused = ref(false)
const inputId = props.id ?? `input-${Math.random().toString(36).slice(2)}`
const hasValue = computed(() => Boolean(props.modelValue))
const isFloated = computed(() => focused.value || hasValue.value)
</script>

<template>
  <div class="relative w-full">
    <!-- Prefix slot -->
    <div v-if="$slots.prefix" class="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none z-10">
      <slot name="prefix" />
    </div>

    <!-- Input -->
    <div class="relative">
      <!-- Floating label -->
      <label
        v-if="label"
        :for="inputId"
        class="absolute left-4 transition-all duration-200 pointer-events-none select-none z-10 origin-left"
        :class="[
          $slots.prefix ? 'left-9' : 'left-4',
          isFloated
            ? '-top-2.5 text-xs scale-90 font-medium'
            : 'top-1/2 -translate-y-1/2 text-sm',
          focused
            ? 'text-indigo-400'
            : error
              ? 'text-rose-400'
              : isFloated ? 'text-zinc-400' : 'text-zinc-500',
        ]"
      >
        {{ label }}
      </label>

      <input
        :id="inputId"
        :type="type ?? 'text'"
        :value="modelValue"
        :placeholder="label ? '' : placeholder"
        :disabled="disabled"
        :readonly="readonly"
        :autofocus="autofocus"
        class="w-full bg-zinc-800/60 border rounded-xl px-4 py-2.5 text-sm text-zinc-100 transition-all duration-200 focus:outline-none placeholder:text-zinc-600"
        :class="[
          $slots.prefix ? 'pl-9' : 'pl-4',
          $slots.suffix ? 'pr-9' : 'pr-4',
          label ? 'pt-5 pb-2' : 'py-2.5',
          error
            ? 'border-rose-500/50 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/30'
            : 'border-zinc-700/50 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20',
          disabled ? 'opacity-50 cursor-not-allowed' : '',
        ]"
        :aria-invalid="!!error"
        :aria-describedby="error ? `${inputId}-error` : undefined"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        @focus="(e) => { focused = true; emit('focus', e) }"
        @blur="(e) => { focused = false; emit('blur', e) }"
        @keydown="emit('keydown', $event)"
      />

      <!-- Suffix slot -->
      <div v-if="$slots.suffix" class="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">
        <slot name="suffix" />
      </div>
    </div>

    <!-- Error message -->
    <Transition name="slide-down">
      <p
        v-if="error"
        :id="`${inputId}-error`"
        class="mt-1.5 text-xs text-rose-400 flex items-center gap-1.5"
        role="alert"
      >
        <svg class="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
        </svg>
        {{ error }}
      </p>
    </Transition>
  </div>
</template>
