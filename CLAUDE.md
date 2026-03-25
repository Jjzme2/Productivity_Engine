# CLAUDE.md — Productivity Engine (ILYTAT Suite)

This file provides context for AI assistants working in this repository.

---

## Project Overview

**Productivity Engine** is a cross-platform desktop application built with **Tauri v2** (Rust backend + Vue.js 3 frontend). It is part of the ILYTAT Suite and combines task management, habit tracking, notes, calendar, productivity frameworks (Pomodoro, etc.), analytics, and finance tracking into a single app with AI-powered features throughout.

- **App identifier**: `com.ilytat.productivity-engine`
- **Current version**: `0.1.11` (synced across `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`)

---

## Technology Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| Vue.js 3 | ^3.5 | UI framework (Composition API) |
| TypeScript | ^5.7 | Type safety |
| Pinia | ^2.3 | State management |
| Vue Router | ^4.5 | Client-side routing |
| Vite | ^6.0 | Build tool (port 1420 in dev) |
| Tailwind CSS | ^3.4 | Utility-first styling |
| TipTap | ^2.11 | Rich text editor for notes |
| VueUse | ^12 | Composable utilities |
| date-fns | ^4.1 | Date manipulation |
| Zod | ^3.24 | Runtime schema validation |

### Backend (Rust)
| Crate | Purpose |
|---|---|
| tauri 2 | Desktop app framework, IPC bridge |
| tokio 1 (full) | Async runtime |
| reqwest 0.12 | HTTP client for AI/calendar APIs |
| serde / serde_json | Serialization |
| tracing + tracing-appender | Structured logging to rolling daily files |
| keyring 3 | OS credential store |
| tauri-plugin-stronghold | Encrypted secret vault |
| chrono | Date/time with serde support |
| uuid (v4) | ID generation |
| thiserror 2 | Typed error types |
| cpal + hound | Audio capture for voice input |
| aes-gcm + sha2 | Encryption primitives |

### External Services
- **Firebase / Firestore** — primary data store for all user data
- **Cloudflare R2** — note body storage (read from Rust backend only, never exposed to frontend JS)
- **Google Calendar** — OAuth2 integration, sync via Rust backend (listener on port 8765)
- **AI providers** — Anthropic Claude, Google Gemini, OpenAI, Ollama (local), Mistral, Groq, Cohere

### Testing
- **Vitest** — unit tests (`npm run test`)
- **Playwright** — end-to-end tests (`npm run test:e2e`)

---

## Repository Structure

```
Productivity_Engine/
├── src/                        # Vue.js frontend
│   ├── main.ts                 # App entry point
│   ├── App.vue                 # Root component
│   ├── router/index.ts         # Vue Router (all routes + auth guards)
│   ├── views/                  # Page-level components (one per route)
│   │   ├── DashboardView.vue
│   │   ├── TasksView.vue
│   │   ├── HabitsView.vue
│   │   ├── NotesView.vue
│   │   ├── CalendarView.vue
│   │   ├── FrameworksView.vue
│   │   ├── AnalyticsView.vue
│   │   ├── FinanceView.vue
│   │   ├── DatesView.vue
│   │   ├── SettingsView.vue
│   │   └── LoginView.vue
│   ├── components/             # Reusable UI, grouped by domain
│   │   ├── calendar/
│   │   ├── debug/
│   │   ├── frameworks/
│   │   ├── habits/
│   │   ├── layout/             # AppShell (authenticated wrapper)
│   │   ├── nlp/
│   │   ├── notes/
│   │   ├── shared/
│   │   └── tasks/
│   ├── stores/                 # Pinia stores
│   │   ├── index.ts            # Barrel re-export
│   │   ├── useAppStore.ts
│   │   ├── useAuthStore.ts
│   │   ├── useTaskStore.ts
│   │   ├── useHabitStore.ts
│   │   ├── useNoteStore.ts
│   │   ├── useCalendarStore.ts
│   │   ├── useFrameworkStore.ts
│   │   ├── useAnalyticsStore.ts
│   │   ├── useSettingsStore.ts
│   │   ├── useSyncStore.ts
│   │   └── useNlpStore.ts
│   ├── services/               # Service layer
│   │   ├── tauriClient.ts      # All typed invoke() wrappers (1-to-1 with Rust commands)
│   │   ├── firebase.ts         # Firebase initialization
│   │   ├── firestoreClient.ts  # Firestore CRUD helpers
│   │   ├── syncService.ts      # Data sync orchestration
│   │   ├── nlpPipeline.ts      # NLP pre-processing
│   │   ├── eventBus.ts         # Frontend mitt event bus
│   │   ├── errorReporter.ts    # Error forwarding to Rust logger
│   │   ├── useLogger.ts        # Frontend logging composable
│   │   └── __tests__/          # Service unit tests
│   ├── composables/            # Vue composables
│   │   ├── useAiManager.ts     # Frontend AI manager integration
│   │   ├── useAnalytics.ts
│   │   ├── useFramework.ts
│   │   ├── useHabits.ts
│   │   ├── useNlpInput.ts
│   │   ├── useShortcuts.ts
│   │   ├── useTasks.ts
│   │   ├── useTheme.ts
│   │   └── useVoiceInput.ts
│   ├── types/                  # TypeScript domain types
│   │   ├── task.ts
│   │   ├── habit.ts
│   │   ├── note.ts
│   │   ├── event.ts
│   │   ├── framework.ts
│   │   ├── analytics.ts
│   │   ├── finance.ts
│   │   ├── dates.ts
│   │   ├── settings.ts
│   │   ├── nlp.ts
│   │   ├── schemas.ts          # Zod schemas
│   │   └── index.ts
│   └── assets/
├── src-tauri/                  # Rust/Tauri backend
│   ├── tauri.conf.json         # App config (window, CSP, bundle targets)
│   ├── Cargo.toml              # Rust dependencies
│   └── src/
│       ├── main.rs             # Binary entry point
│       ├── lib.rs              # App bootstrap, plugin registration, command handler list
│       ├── state.rs            # AppState, AppSettings, SchedulerHandle
│       ├── error.rs            # Typed error enum
│       ├── commands/           # #[tauri::command] handlers
│       │   ├── mod.rs
│       │   ├── ai.rs           # NLP, suggestions, daily brief
│       │   ├── analytics.rs    # Insights, scores, activity log
│       │   ├── calendar.rs     # Google OAuth, sync
│       │   ├── frameworks.rs   # Productivity framework sessions
│       │   ├── logging.rs      # Frontend error forwarding
│       │   ├── secrets.rs      # Read env vars via allowlist
│       │   ├── settings.rs     # App settings + API key management
│       │   └── voice.rs        # Voice capture / STT
│       ├── services/           # Backend business logic
│       │   ├── mod.rs
│       │   ├── ai_service.rs   # AiService (Ollama/Claude/Gemini backends)
│       │   ├── analytics_engine.rs
│       │   ├── calendar_service.rs
│       │   ├── credential_store.rs  # OS keyring wrapper
│       │   ├── framework_engine.rs
│       │   ├── notification.rs
│       │   ├── scheduler.rs    # Background task scheduler
│       │   └── voice_service.rs
│       ├── models/             # Rust domain types (mirrored in src/types/)
│       │   ├── mod.rs
│       │   ├── analytics.rs
│       │   ├── event.rs
│       │   ├── framework.rs
│       │   ├── habit.rs
│       │   ├── note.rs
│       │   └── task.rs
│       └── events/             # Internal event bus
│           ├── mod.rs
│           ├── bus.rs          # tokio broadcast channel
│           └── types.rs        # AppEvent enum
├── packages/
│   └── ai-manager/             # @ilytat/ai-manager — standalone npm package
│       ├── README.md
│       └── src/
│           ├── index.ts        # Public API: aiGenerate, testProvider, createDefaultConfig
│           ├── adapters.ts     # Per-provider HTTP adapters
│           ├── models.ts       # Model ID lists
│           ├── meta.ts         # Provider metadata
│           └── types.ts        # AiManagerConfig, ProviderConfig, etc.
├── AI/                         # AI-assisted development context (not shipped)
│   ├── Migrations/             # Database migration notes
│   ├── Summaries/              # Session summaries
│   └── Tasks/                  # Active task contexts (feature branch docs)
├── scripts/
│   ├── bump-version.sh         # Sync version across package.json, tauri.conf.json, Cargo.toml
│   ├── verify-r2.mjs           # Verify Cloudflare R2 connectivity
│   └── wipeFirebase.ts         # Dev-only: wipe Firestore collections
├── firestore.rules             # Firestore security rules (deploy separately)
├── Makefile                    # Convenience dev targets
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── .env.example                # Required environment variables
```

---

## Development Workflows

### Prerequisites
- Node.js 18+
- Rust / Cargo (stable)
- Tauri CLI v2 (`cargo install tauri-cli --version "^2"`)

### Common Commands

```bash
# Install dependencies
make deps          # or: npm install

# Start dev server (hot reload — Tauri window + Vite)
make dev           # or: npm run tauri dev

# Type check
make typecheck     # or: npm run typecheck

# Lint
make lint          # or: npm run lint -- src --ext .vue,.ts

# Run unit tests
make test          # or: npm run test  (Vitest)

# Run E2E tests
make test-e2e      # or: npm run test:e2e  (Playwright)

# Production build
make build         # or: npm run tauri build

# Full release pipeline (lint + typecheck + build)
make release

# Bump version (patch / minor / major)
make bump          # patch (default)
make bump PART=minor
make bump PART=major

# Build + install .deb on Linux
make install

# Clean build artifacts
make clean
```

### Version Management
Version is kept in sync across three files by `scripts/bump-version.sh`:
1. `package.json` → `version`
2. `src-tauri/tauri.conf.json` → `version`
3. `src-tauri/Cargo.toml` → `version`

**Always use `make bump` or the script — never edit versions manually.**

### Environment Setup
Copy `.env.example` to `.env` and fill in values:

```
# Firebase (frontend, VITE_ prefix required)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

# Cloudflare R2 (Rust backend only — no VITE_ prefix)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=

# Google Calendar OAuth2
VITE_GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

**Important**: `R2_*` and `GOOGLE_CLIENT_SECRET` must NOT be prefixed with `VITE_`. They are read by the Rust backend only and must never appear in the client JS bundle.

---

## Architecture Patterns

### Frontend → Backend Communication (IPC)
All Rust backend calls go through `src/services/tauriClient.ts`, which contains typed wrappers around Tauri's `invoke()`. Never call `invoke()` directly in components or stores — always go through `tauriClient.ts`.

```ts
// Good — typed wrapper in tauriClient.ts
import { parseNlpIntent } from '@/services/tauriClient'
const intent = await parseNlpIntent({ rawInput, userContext })

// Bad — direct invoke in a component
import { invoke } from '@tauri-apps/api/core'
const intent = await invoke('parse_nlp_intent', { rawInput, userContext })
```

### Adding a New Tauri Command
1. Implement the handler in `src-tauri/src/commands/<domain>.rs`
2. Register it in the `invoke_handler![]` macro in `src-tauri/src/lib.rs`
3. Add a typed wrapper function in `src/services/tauriClient.ts`
4. Add corresponding TypeScript types to `src/types/`

### State Management (Pinia)
- One store per domain: `useTaskStore`, `useHabitStore`, etc.
- All stores are exported from `src/stores/index.ts`
- Stores handle Firestore persistence internally via `firestoreClient.ts`
- Stores subscribe to sync events from `useSyncStore`

### Data Flow
```
User action
  → Vue component
    → Pinia store action
      → firestoreClient.ts (Firestore) OR tauriClient.ts (Rust)
        → Firebase / Rust service
```

### AI Service (Rust)
`AiService` in `src-tauri/src/services/ai_service.rs` wraps multiple backends behind a trait:
- `OllamaBackend` — local Llama via Ollama (default: `llama3`, `http://localhost:11434`)
- `GeminiBackend` — Google Gemini (default: `gemini-2.0-flash`)
- `ClaudeBackend` — Anthropic Claude (default: `claude-sonnet-4-6`)

Provider selection at startup:
- If `GEMINI_API_KEY` env var is set → use Gemini as cloud backend
- Otherwise → use Claude (key from OS keyring via `CredentialStore`)
- Default preference: `ProviderPreference::LocalFirst` (try Ollama, fall back to cloud)

### AI Manager Package (`@ilytat/ai-manager`)
The `packages/ai-manager/` directory is a standalone npm package aliased locally via Vite config. It provides the **frontend** AI generation path with waterfall fallback across 7 providers. It is stateless — config must be passed in every call.

The Vite alias makes it importable as `@ilytat/ai-manager` in frontend code without publishing to npm.

---

## Key Conventions

### TypeScript / Vue
- Import alias `@` maps to `src/` — always use it, never relative `../../`
- Stores: `use<Domain>Store` naming (e.g., `useTaskStore`)
- Composables: `use<Feature>` naming (e.g., `useVoiceInput`)
- Components are `PascalCase.vue`
- All domain types live in `src/types/` — add new types there, not inline
- Use Zod schemas from `src/types/schemas.ts` for runtime validation at service boundaries

### Rust
- Use `tracing::info!/warn!/error!` — never `println!` in production code
- All new commands must be added to the `invoke_handler![]` in `lib.rs`
- Error types go through `error.rs` — use `thiserror` derive macros
- `AppState` is injected into commands via `tauri::State<AppState>` — don't re-create services in commands
- Async commands should use `async fn` with `tokio`

### Security
- **Never** expose R2 or secret credentials to the frontend (no `VITE_` prefix for secrets)
- API keys are stored in the OS keyring via `CredentialStore` / Tauri Stronghold — never in plaintext files
- Firestore rules enforce per-user ownership on every collection (`userId` field required)
- The CSP in `tauri.conf.json` explicitly allowlists external API domains — update it when adding new external calls
- The `read_secret_env` command has a server-side allowlist — update it when exposing new env vars to the frontend

### Firestore Data Model
Every Firestore document must include a `userId` field matching the authenticated user's UID. The security rules (`firestore.rules`) enforce this via `isOwner()` / `isAuthenticatedCreate()` helpers.

**Collections**: `tasks`, `habits`, `habit_entries`, `notes`, `events`, `frameworks`, `framework_sessions`, `activity_log`, `user_insights`, `weekly_summaries`, `settings`, `accounts`, `transactions`, `budgets`, `financial_goals`, `net_worth`, `dates`

Deploy rules with: `firebase deploy --only firestore:rules`

### Logging
- Rust: use `tracing` — logs go to daily rolling files at `$XDG_DATA_HOME/productivity-engine/logs/app.YYYY-MM-DD.log`
- Frontend errors should be forwarded to Rust via `logFrontendError()` in `tauriClient.ts` so they appear in the same log file
- In debug builds, logs also print to stdout; in release builds, file only

---

## Domain Modules

| Domain | View | Store | Rust Command Module |
|---|---|---|---|
| Tasks | `TasksView.vue` | `useTaskStore` | `commands/ai.rs` (priority matrix) |
| Habits | `HabitsView.vue` | `useHabitStore` | — |
| Notes | `NotesView.vue` | `useNoteStore` | — |
| Calendar | `CalendarView.vue` | `useCalendarStore` | `commands/calendar.rs` |
| Frameworks | `FrameworksView.vue` | `useFrameworkStore` | `commands/frameworks.rs` |
| Analytics | `AnalyticsView.vue` | `useAnalyticsStore` | `commands/analytics.rs` |
| Finance | `FinanceView.vue` | (in `stores/finance.ts`) | — |
| Important Dates | `DatesView.vue` | (in `stores/dates.ts`) | — |
| Settings | `SettingsView.vue` | `useSettingsStore` | `commands/settings.rs` |
| AI / NLP | (composables) | `useNlpStore` | `commands/ai.rs` |
| Voice | (composable) | — | `commands/voice.rs` |

---

## Task Types Reference

```typescript
type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done' | 'cancelled'
type Priority = 'urgent' | 'high' | 'medium' | 'low'
type EisenhowerQuadrant = 'do_first' | 'schedule' | 'delegate' | 'eliminate'
```

---

## AI-Assisted Development

The `AI/` directory contains development artifacts used when working with AI assistants:
- `AI/Tasks/` — Active feature branch context documents (one per feature)
- `AI/Summaries/` — Session summaries for continuity across sessions
- `AI/Migrations/` — Notes on data migrations (e.g., `2026-03-21_AddUserIdToFinanceAndDates.md`)

When starting a new feature, create a context document in `AI/Tasks/<FeatureName>/`. When ending a session, update or create a summary in `AI/Summaries/`.

---

## Build & Distribution

| Target | Command | Output |
|---|---|---|
| Linux .deb | `make build` | `src-tauri/target/release/bundle/deb/*.deb` |
| Linux AppImage | `make build` | `src-tauri/target/release/bundle/appimage/*.AppImage` |
| macOS .dmg | `make build` (on macOS) | `src-tauri/target/release/bundle/dmg/*.dmg` |

- **Dev server**: Vite on port 1420, Tauri dev window reads from `http://localhost:1420`
- **Production**: Vite builds to `dist/`, Tauri bundles it with the Rust binary into platform installers
- **Auto-update**: `tauri-plugin-updater` is included — configure update server in `tauri.conf.json`
- **Auto-start**: `tauri-plugin-autostart` is included — controlled via `AppSettings.show_tray_icon` / `start_minimized`
