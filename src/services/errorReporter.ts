// ─── Frontend error reporter ──────────────────────────────────────────────────
// Captures uncaught JS errors, unhandled promise rejections, and Vue component
// errors.  Forwards them to the Rust tracing log (which writes to a rolling
// file) and also buffers them in a reactive array for the in-app overlay.

import { ref, readonly } from 'vue'
import { invoke } from '@tauri-apps/api/core'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AppError {
  id:        number
  timestamp: string
  level:     'error' | 'warn' | 'info'
  message:   string
  source:    string
  stack?:    string
}

// ─── State ────────────────────────────────────────────────────────────────────

const MAX_ERRORS = 50
let _nextId = 1

const _errors = ref<AppError[]>([])

export const errors    = readonly(_errors)
export const errorCount = () => _errors.value.length

// ─── Internal helpers ─────────────────────────────────────────────────────────

function _push(entry: Omit<AppError, 'id' | 'timestamp'>) {
  _errors.value.unshift({
    ...entry,
    id:        _nextId++,
    timestamp: new Date().toISOString(),
  })
  // Keep the buffer bounded
  if (_errors.value.length > MAX_ERRORS) {
    _errors.value.length = MAX_ERRORS
  }
}

async function _forward(level: AppError['level'], message: string, context?: object) {
  try {
    await invoke('log_frontend_error', {
      level,
      message,
      context: context ? JSON.stringify(context) : null,
    })
  } catch {
    // Tauri unavailable (browser dev / unit tests) — silently skip
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function reportError(err: unknown, source = 'unknown', stack?: string) {
  const message = err instanceof Error
    ? err.message
    : typeof err === 'string' ? err : String(err)

  const resolvedStack = stack ?? (err instanceof Error ? err.stack : undefined)

  _push({ level: 'error', message, source, ...(resolvedStack ? { stack: resolvedStack } : {}) })
  void _forward('error', message, { source, stack: resolvedStack })
}

export function reportWarn(message: string, source = 'unknown') {
  _push({ level: 'warn', message, source })
  void _forward('warn', message, { source })
}

export function dismiss(id: number) {
  _errors.value = _errors.value.filter((e) => e.id !== id)
}

export function dismissAll() {
  _errors.value = []
}

// ─── Global capture ───────────────────────────────────────────────────────────

/** Call once from main.ts to wire up global error capture. */
export function installGlobalErrorHandlers() {
  // Uncaught synchronous errors
  window.addEventListener('error', (event) => {
    reportError(event.error ?? event.message, event.filename ?? 'window', event.error?.stack)
  })

  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    reportError(event.reason, 'unhandledrejection')
  })
}
