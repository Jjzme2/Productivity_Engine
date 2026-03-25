<script setup lang="ts">
import BaseModal from './BaseModal.vue'
import BaseButton from './BaseButton.vue'

const props = defineProps<{
  modelValue: boolean
  title?: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'danger'
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: []
  cancel: []
}>()

function handleConfirm() {
  emit('confirm')
  emit('update:modelValue', false)
}

function handleCancel() {
  emit('cancel')
  emit('update:modelValue', false)
}
</script>

<template>
  <BaseModal
    :model-value="modelValue"
    :title="title ?? 'Are you sure?'"
    size="sm"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <p class="text-sm text-zinc-400 leading-relaxed">
      {{ message ?? 'This action cannot be undone.' }}
    </p>

    <template #footer>
      <BaseButton variant="ghost" size="sm" @click="handleCancel">
        {{ cancelLabel ?? 'Cancel' }}
      </BaseButton>
      <BaseButton
        :variant="variant === 'danger' ? 'danger' : 'primary'"
        size="sm"
        @click="handleConfirm"
      >
        {{ confirmLabel ?? 'Confirm' }}
      </BaseButton>
    </template>
  </BaseModal>
</template>
