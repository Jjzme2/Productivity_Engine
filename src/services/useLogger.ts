// ─── Structured Logger ────────────────────────────────────────────────────────
// Provides tagged, timestamped log output with an in-memory ring buffer.
// Usage:  const log = createLogger('NoteStore')
//         log.info('Note saved', { id })

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  level: LogLevel
  module: string
  message: string
  data?: unknown
  timestamp: string
}

const MAX_ENTRIES = 200
const LOG_BUFFER: LogEntry[] = []

const LEVEL_STYLES: Record<LogLevel, string> = {
  debug: 'color:#6b7280',
  info:  'color:#60a5fa',
  warn:  'color:#fbbf24',
  error: 'color:#f87171;font-weight:bold',
}

function push(entry: LogEntry) {
  LOG_BUFFER.push(entry)
  if (LOG_BUFFER.length > MAX_ENTRIES) LOG_BUFFER.shift()

  const tag = `%c[PE:${entry.module}]`
  const style = LEVEL_STYLES[entry.level]
  const args: unknown[] = [tag, style, entry.message]
  if (entry.data !== undefined) args.push(entry.data)

  switch (entry.level) {
    case 'debug': console.debug(...args); break
    case 'info':  console.info(...args); break
    case 'warn':  console.warn(...args); break
    case 'error': console.error(...args); break
  }
}

/**
 * Create a logger scoped to a module name.
 * Every message is prefixed with `[PE:ModuleName]` and a timestamp.
 */
export function createLogger(module: string) {
  function log(level: LogLevel, message: string, data?: unknown) {
    push({ level, module, message, data, timestamp: new Date().toISOString() })
  }

  return {
    debug: (msg: string, data?: unknown) => log('debug', msg, data),
    info:  (msg: string, data?: unknown) => log('info',  msg, data),
    warn:  (msg: string, data?: unknown) => log('warn',  msg, data),
    error: (msg: string, data?: unknown) => log('error', msg, data),
  }
}

/** Read the in-memory log buffer (for a debug panel). */
export function getLogBuffer(): readonly LogEntry[] {
  return LOG_BUFFER
}
