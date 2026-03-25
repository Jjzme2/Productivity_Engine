// ─── Sync state store ─────────────────────────────────────────────────────────
// Tracks online/offline status and drives outbox flushing.
// Mount once in App.vue via `useSyncStore().init()`.

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { flushOutbox, outboxSize, isOnline } from '@/services/syncService'
import { firebaseEnabled } from '@/services/firebase'

export const useSyncStore = defineStore('sync', () => {
  const online        = ref(isOnline())
  const pendingCount  = ref(outboxSize())
  const isFlushing    = ref(false)
  const lastSyncAt    = ref<string | null>(null)
  const lastSyncError = ref<string | null>(null)

  async function flush() {
    if (isFlushing.value || !firebaseEnabled) return
    isFlushing.value = true
    lastSyncError.value = null

    try {
      const { flushed, failed } = await flushOutbox()
      pendingCount.value = outboxSize()
      if (flushed > 0) lastSyncAt.value = new Date().toISOString()
      if (failed > 0)  lastSyncError.value = `${failed} item(s) failed to sync`
    } catch (err) {
      lastSyncError.value = String(err)
    } finally {
      isFlushing.value = false
    }
  }

  function refresh() {
    pendingCount.value = outboxSize()
  }

  function init() {
    window.addEventListener('online', async () => {
      online.value = true
      await flush()
    })
    window.addEventListener('offline', () => {
      online.value = false
    })

    // Refresh badge count every 30 s
    setInterval(refresh, 30_000)
  }

  return { online, pendingCount, isFlushing, lastSyncAt, lastSyncError, flush, refresh, init }
})
