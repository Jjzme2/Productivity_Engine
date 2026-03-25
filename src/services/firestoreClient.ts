// ─── Typed Firestore access layer ─────────────────────────────────────────────

import {
  collection,
  doc,
  getDoc as fsGetDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc as fsUpdateDoc,
  deleteDoc as fsDeleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  type DocumentData,
  type QueryConstraint,
  type Unsubscribe,
  type WhereFilterOp,
} from 'firebase/firestore'
import { db } from './firebase'
import { createLogger } from './useLogger'
import { collectionSchemas } from '@/types/schemas'

const log = createLogger('Firestore')

function requireDb() {
  if (!db) {
    const msg = 'Firebase is not configured. Set VITE_FIREBASE_* env vars to enable cloud sync.'
    log.error(msg)
    throw new Error(msg)
  }
  return db
}

// ─── Collection name constants ────────────────────────────────────────────────

export const COLLECTIONS = {
  TASKS:              'tasks',
  HABITS:             'habits',
  HABIT_ENTRIES:      'habit_entries',
  NOTES:              'notes',
  EVENTS:             'events',
  FRAMEWORKS:         'frameworks',
  FRAMEWORK_SESSIONS: 'framework_sessions',
  ACTIVITY_LOG:       'activity_log',
  USER_INSIGHTS:      'user_insights',
  WEEKLY_SUMMARIES:   'weekly_summaries',
  SETTINGS:           'settings',
  ACCOUNTS:           'accounts',
  TRANSACTIONS:       'transactions',
  BUDGETS:            'budgets',
  FINANCIAL_GOALS:    'financial_goals',
  NET_WORTH:          'net_worth',
  DATES:              'dates',
} as const

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS]

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Recursively convert Firestore Timestamps to ISO strings (handles nested objects/arrays). */
function normaliseValue(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate().toISOString()
  if (Array.isArray(value)) return value.map(normaliseValue)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, normaliseValue(v)]),
    )
  }
  return value
}

function normaliseDoc<T>(id: string, data: DocumentData): T {
  const raw = { id, ...data }
  return normaliseValue(raw) as T
}

// ─── Validation ───────────────────────────────────────────────────────────────

/** Validates data against the Zod schema for the given collection. Logs and throws on failure. */
function validateForCollection(collectionName: CollectionName, data: unknown): void {
  const schema = collectionSchemas[collectionName]
  if (!schema) return // No schema registered — skip validation
  const result = schema.safeParse(data)
  if (!result.success) {
    const msg = `Validation failed for ${collectionName}: ${result.error.message}`
    log.error(msg, result.error.flatten())
    throw new Error(msg)
  }
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

/**
 * Create a new document in `collectionName`.
 * Returns the newly created document with its generated `id`.
 */
export async function createDoc<T extends { id?: string }>(
  collectionName: CollectionName,
  data: Omit<T, 'id'>,
): Promise<T> {
  validateForCollection(collectionName, data)
  const colRef = collection(requireDb(), collectionName)
  const payload = {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  const docRef = await addDoc(colRef, payload)
  return { ...(data as object), id: docRef.id } as T
}

/**
 * Create or overwrite a document with a specific `id`.
 * Uses `merge: true` so an existing `createdAt` is preserved, not overwritten.
 */
export async function setDocById<T extends { id: string }>(
  collectionName: CollectionName,
  id: string,
  data: Omit<T, 'id'>,
): Promise<T> {
  const docRef = doc(requireDb(), collectionName, id)
  const payload = {
    ...data,
    updatedAt: serverTimestamp(),
  }
  // createdAt is set as a default that merge won't overwrite if doc already exists
  await setDoc(docRef, { createdAt: serverTimestamp(), ...payload }, { merge: true })
  return { ...(data as object), id } as T
}

/**
 * Fetch a single document by id.
 * Returns `null` if not found.
 */
export async function getDoc<T>(
  collectionName: CollectionName,
  id: string,
): Promise<T | null> {
  const docRef = doc(requireDb(), collectionName, id)
  const snap = await fsGetDoc(docRef)
  if (!snap.exists()) return null
  return normaliseDoc<T>(snap.id, snap.data())
}

/**
 * Partial-update an existing document.
 */
export async function updateDoc<T extends { id: string }>(
  collectionName: CollectionName,
  id: string,
  data: Partial<Omit<T, 'id'>>,
): Promise<void> {
  const docRef = doc(requireDb(), collectionName, id)
  await fsUpdateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

/**
 * Hard-delete a document by id.
 */
export async function deleteDoc(
  collectionName: CollectionName,
  id: string,
): Promise<void> {
  const docRef = doc(requireDb(), collectionName, id)
  await fsDeleteDoc(docRef)
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export interface QueryOptions {
  where?: Array<{ field: string; op: WhereFilterOp; value: unknown }>
  orderBy?: Array<{ field: string; direction?: 'asc' | 'desc' }>
  limit?: number
}

/** Build Firestore QueryConstraints from our QueryOptions object (DRY helper). */
function buildConstraints(options?: QueryOptions): QueryConstraint[] {
  const constraints: QueryConstraint[] = []
  for (const w of options?.where ?? []) {
    constraints.push(where(w.field, w.op, w.value))
  }
  for (const o of options?.orderBy ?? []) {
    constraints.push(orderBy(o.field, o.direction ?? 'asc'))
  }
  if (options?.limit) {
    constraints.push(limit(options.limit))
  }
  return constraints
}

/**
 * Fetch all documents from a collection matching the given options.
 */
export async function queryCollection<T>(
  collectionName: CollectionName,
  options?: QueryOptions,
): Promise<T[]> {
  const colRef = collection(requireDb(), collectionName)
  const q = query(colRef, ...buildConstraints(options))
  const snap = await getDocs(q)
  return snap.docs.map((d) => normaliseDoc<T>(d.id, d.data()))
}

/**
 * Subscribe to a collection with real-time updates.
 * Returns an `Unsubscribe` function — call it to stop listening.
 */
export function subscribeToCollection<T>(
  collectionName: CollectionName,
  options: QueryOptions,
  callback: (docs: T[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const colRef = collection(requireDb(), collectionName)
  const q = query(colRef, ...buildConstraints(options))

  return onSnapshot(
    q,
    (snap) => {
      const docs = snap.docs.map((d) => normaliseDoc<T>(d.id, d.data()))
      callback(docs)
    },
    (err) => onError?.(err as Error),
  )
}

/**
 * Simple field equality search. For full-text search use Algolia / Typesense.
 */
export async function searchByField<T>(
  collectionName: CollectionName,
  field: string,
  value: unknown,
  maxResults = 50,
): Promise<T[]> {
  return queryCollection<T>(collectionName, {
    where: [{ field, op: '==', value }],
    limit: maxResults,
  })
}
