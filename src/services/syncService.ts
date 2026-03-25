// ─── Offline-first sync service ───────────────────────────────────────────────
//
// Write path:
//   1. Always write to localStorage immediately (local cache + outbox entry)
//   2. If Firebase is available + online → also write to Firestore
//   3. If offline / Firebase not configured → leave in outbox
//
// On reconnection:
//   - Flush the outbox to Firestore in chronological order
//   - Remove successfully synced entries

import {
  createDoc,
  setDocById,
  updateDoc,
  deleteDoc,
  queryCollection,
  type CollectionName,
} from './firestoreClient'
import { firebaseEnabled } from './firebase'

// ─── Outbox entry ─────────────────────────────────────────────────────────────

export type SyncOp = 'create' | 'update' | 'delete'

export interface OutboxEntry {
  /** Client-generated stable id for deduplication */
  outboxId: string
  collection: CollectionName
  op: SyncOp
  /** Document id in Firestore */
  docId: string
  /** Full document data (for create/update; empty for delete) */
  data: Record<string, unknown>
  createdAt: string
}

// ─── Local collection cache key ───────────────────────────────────────────────

const OUTBOX_KEY = 'pe_sync_outbox'
const cacheKey = (col: CollectionName) => `pe_cache_${col}`

// ─── Low-level localStorage helpers ──────────────────────────────────────────

function readOutbox(): OutboxEntry[] {
  try {
    return JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? '[]')
  } catch {
    return []
  }
}

function writeOutbox(entries: OutboxEntry[]): void {
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(entries))
}

function readCache<T>(col: CollectionName): T[] {
  try {
    return JSON.parse(localStorage.getItem(cacheKey(col)) ?? '[]')
  } catch {
    return []
  }
}

function writeCache<T extends { id: string }>(col: CollectionName, docs: T[]): void {
  localStorage.setItem(cacheKey(col), JSON.stringify(docs))
}

function upsertInCache<T extends { id: string }>(col: CollectionName, doc: T): void {
  const cache = readCache<T>(col)
  const idx = cache.findIndex((d) => d.id === doc.id)
  if (idx !== -1) cache[idx] = doc
  else cache.push(doc)
  writeCache(col, cache)
}

function removeFromCache(col: CollectionName, id: string): void {
  const cache = readCache<{ id: string }>(col)
  writeCache(col, cache.filter((d) => d.id !== id))
}

// ─── Online detection ─────────────────────────────────────────────────────────

export function isOnline(): boolean {
  return navigator.onLine
}

// ─── Outbox management ───────────────────────────────────────────────────────

function enqueue(entry: OutboxEntry): void {
  const outbox = readOutbox()
  // Replace any earlier entry for the same doc+op to avoid redundant writes
  const existing = outbox.findIndex(
    (e) => e.docId === entry.docId && e.collection === entry.collection,
  )
  if (existing !== -1) {
    // Merge: if the new op is 'delete', always replace; otherwise update data
    if (entry.op === 'delete') {
      outbox.splice(existing, 1, entry)
    } else {
      outbox[existing] = { ...outbox[existing], ...entry }
    }
  } else {
    outbox.push(entry)
  }
  writeOutbox(outbox)
}

function dequeue(outboxId: string): void {
  writeOutbox(readOutbox().filter((e) => e.outboxId !== outboxId))
}

// ─── Core write helpers ───────────────────────────────────────────────────────

function makeOutboxId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Write a document. Always persists locally; syncs to Firestore if online.
 * Returns the document immediately so the UI can update without waiting.
 */
export async function syncWrite<T extends { id: string }>(
  collection: CollectionName,
  op: 'create' | 'update',
  doc: T,
): Promise<T> {
  // 1. Update local cache immediately
  upsertInCache(collection, doc)

  const entry: OutboxEntry = {
    outboxId: makeOutboxId(),
    collection,
    op,
    docId: doc.id,
    data: doc as unknown as Record<string, unknown>,
    createdAt: new Date().toISOString(),
  }

  if (firebaseEnabled && isOnline()) {
    try {
      if (op === 'create') {
        await setDocById(collection, doc.id, doc as Record<string, unknown>)
      } else {
        await updateDoc(collection, doc.id, doc as Record<string, unknown>)
      }
      // Synced successfully — no outbox entry needed
      return doc
    } catch (err) {
      console.warn(`[sync] Firestore write failed, queuing for retry:`, err)
    }
  }

  // Offline or write failed → add to outbox
  enqueue(entry)
  return doc
}

/**
 * Delete a document. Always removes locally; queues for Firestore when offline.
 */
export async function syncDelete(collection: CollectionName, id: string): Promise<void> {
  removeFromCache(collection, id)

  if (firebaseEnabled && isOnline()) {
    try {
      await deleteDoc(collection, id)
      return
    } catch (err) {
      console.warn(`[sync] Firestore delete failed, queuing for retry:`, err)
    }
  }

  enqueue({
    outboxId: makeOutboxId(),
    collection,
    op: 'delete',
    docId: id,
    data: {},
    createdAt: new Date().toISOString(),
  })
}

/**
 * Load a collection. Returns local cache immediately, then fetches from
 * Firestore in the background if online (refreshes cache + returns updated list).
 */
export async function syncLoad<T extends { id: string }>(
  collection: CollectionName,
  userId: string,
): Promise<T[]> {
  const local = readCache<T>(collection)

  if (!firebaseEnabled || !isOnline()) {
    return local
  }

  try {
    const remote = await queryCollection<T>(collection, {
      where: [{ field: 'userId', op: '==', value: userId }],
    })
    // Merge: remote wins for docs not in outbox (outbox has unsynced local changes)
    const outbox = readOutbox()
    const pendingIds = new Set(
      outbox.filter((e) => e.collection === collection).map((e) => e.docId),
    )

    // O(n) merge via Map instead of O(n²) findIndex
    const mergedMap = new Map<string, T>()
    for (const doc of remote) {
      mergedMap.set(doc.id, doc)
    }
    for (const localDoc of local) {
      if (pendingIds.has(localDoc.id)) {
        // Keep local version — it has unsynced changes
        mergedMap.set(localDoc.id, localDoc)
      }
    }

    const merged = [...mergedMap.values()]
    writeCache(collection, merged)
    return merged
  } catch (err) {
    console.warn(`[sync] Firestore load failed, using cache:`, err)
    return local
  }
}

// ─── Outbox flush ─────────────────────────────────────────────────────────────

export interface FlushResult {
  flushed: number
  failed: number
}

/**
 * Attempt to push all queued (offline) writes to Firestore.
 * Call this when the app comes back online.
 */
export async function flushOutbox(): Promise<FlushResult> {
  if (!firebaseEnabled || !isOnline()) {
    return { flushed: 0, failed: 0 }
  }

  const outbox = readOutbox()
  if (outbox.length === 0) return { flushed: 0, failed: 0 }

  let flushed = 0
  let failed = 0

  for (const entry of outbox) {
    try {
      switch (entry.op) {
        case 'create':
          // setDocById uses setDoc (full overwrite) — correct for creates
          await setDocById(entry.collection, entry.docId, entry.data)
          break
        case 'update':
          // updateDoc merges — correct for partial updates; won't delete unrelated fields
          await updateDoc(entry.collection, entry.docId, entry.data)
          break
        case 'delete':
          await deleteDoc(entry.collection, entry.docId)
          break
      }
      dequeue(entry.outboxId)
      flushed++
    } catch (err) {
      console.warn(`[sync] Failed to flush outbox entry ${entry.outboxId}:`, err)
      failed++
    }
  }

  return { flushed, failed }
}

// ─── Outbox size (for UI badge) ───────────────────────────────────────────────

export function outboxSize(): number {
  return readOutbox().length
}
