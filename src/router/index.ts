// ─── Vue Router ───────────────────────────────────────────────────────────────

import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAppStore } from '@/stores/useAppStore'
import { useAuthStore } from '@/stores/useAuthStore'
import AppShell from '@/components/layout/AppShell.vue'

// ─── Route meta type augmentation ────────────────────────────────────────────

declare module 'vue-router' {
  interface RouteMeta {
    title: string
    /** Lucide icon name (or custom SVG id) */
    icon: string
    /** Show in the sidebar nav */
    showInNav: boolean
    /** Requires authentication */
    requiresAuth: boolean
  }
}

// ─── Route definitions ────────────────────────────────────────────────────────

const routes: RouteRecordRaw[] = [
  // ── Authenticated layout (AppShell wraps all protected routes) ────────────
  {
    path: '/',
    component: AppShell,
    children: [
      {
        path: '',
        name: 'dashboard',
        component: () => import('@/views/DashboardView.vue'),
        meta: { title: 'Dashboard', icon: 'LayoutDashboard', showInNav: true, requiresAuth: true },
      },
      {
        path: 'tasks',
        name: 'tasks',
        component: () => import('@/views/TasksView.vue'),
        meta: { title: 'Tasks', icon: 'CheckSquare', showInNav: true, requiresAuth: true },
      },
      {
        path: 'habits',
        name: 'habits',
        component: () => import('@/views/HabitsView.vue'),
        meta: { title: 'Habits', icon: 'Zap', showInNav: true, requiresAuth: true },
      },
      {
        path: 'notes',
        name: 'notes',
        component: () => import('@/views/NotesView.vue'),
        meta: { title: 'Notes', icon: 'FileText', showInNav: true, requiresAuth: true },
      },
      {
        path: 'calendar',
        name: 'calendar',
        component: () => import('@/views/CalendarView.vue'),
        meta: { title: 'Calendar', icon: 'Calendar', showInNav: true, requiresAuth: true },
      },
      {
        path: 'frameworks',
        name: 'frameworks',
        component: () => import('@/views/FrameworksView.vue'),
        meta: { title: 'Frameworks', icon: 'Timer', showInNav: true, requiresAuth: true },
      },
      {
        path: 'analytics',
        name: 'analytics',
        component: () => import('@/views/AnalyticsView.vue'),
        meta: { title: 'Analytics', icon: 'BarChart2', showInNav: true, requiresAuth: true },
      },
      {
        path: 'finance',
        name: 'finance',
        component: () => import('@/views/FinanceView.vue'),
        meta: { title: 'Finance', icon: 'DollarSign', showInNav: true, requiresAuth: true },
      },
      {
        path: 'dates',
        name: 'dates',
        component: () => import('@/views/DatesView.vue'),
        meta: { title: 'Important Dates', icon: 'CalendarHeart', showInNav: true, requiresAuth: true },
      },
      {
        path: 'settings',
        name: 'settings',
        component: () => import('@/views/SettingsView.vue'),
        meta: { title: 'Settings', icon: 'Settings', showInNav: false, requiresAuth: true },
      },
    ],
  },

  // ── Public routes ─────────────────────────────────────────────────────────
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { title: 'Sign In', icon: 'LogIn', showInNav: false, requiresAuth: false },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { title: '404', icon: 'AlertCircle', showInNav: false, requiresAuth: false },
  },
]

// ─── Router instance ──────────────────────────────────────────────────────────

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(_to, _from, savedPosition) {
    return savedPosition ?? { top: 0 }
  },
})

// ─── Navigation guards ────────────────────────────────────────────────────────

router.beforeEach((to) => {
  const authStore = useAuthStore()

  const needsAuth  = to.meta.requiresAuth
  const isLoggedIn = authStore.isAuthenticated

  // Unauthenticated user trying to access a protected route → login
  if (needsAuth && !isLoggedIn) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  // Already authenticated user hitting /login → redirect to dashboard
  if (to.name === 'login' && isLoggedIn) {
    return { name: 'dashboard' }
  }
})

router.afterEach((to) => {
  document.title = to.meta.title
    ? `${to.meta.title} — Productivity Engine`
    : 'Productivity Engine'

  try {
    const appStore = useAppStore()
    appStore.setActiveView(String(to.name ?? 'dashboard'))
  } catch {
    /* noop */
  }
})

export default router
