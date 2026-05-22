import { create } from "zustand"

export interface DashNotification {
  id: string
  icon: string
  title: string
  body: string
  isRead: boolean
  type: string
  actionUrl?: string | null
  createdAt: string
}

export interface DashStats {
  activeSubs: number
  openTickets: number
  monthlySpend: number
  aiTokensUsed: number
  aiTokensLimit: number
  projectsCount: number
  resolvedTickets: number
  totalInvoices: number
}

interface DashboardStore {
  // Notifications
  notifications: DashNotification[]
  unreadCount: number
  setNotifications: (n: DashNotification[]) => void
  addNotification: (n: DashNotification) => void
  markRead: (id: string) => void
  markAllRead: () => void

  // Stats
  stats: DashStats | null
  setStats: (s: DashStats) => void

  // Search
  searchQuery: string
  setSearchQuery: (q: string) => void

  // Activity
  activities: any[]
  setActivities: (a: any[]) => void
  prependActivity: (a: any) => void
}

export const useDashboardStore = create<DashboardStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  setNotifications: (notifications) =>
    set({ notifications, unreadCount: notifications.filter((n) => !n.isRead).length }),
  addNotification: (n) =>
    set((s) => ({
      notifications: [n, ...s.notifications].slice(0, 50),
      unreadCount: s.unreadCount + (n.isRead ? 0 : 1),
    })),
  markRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      unreadCount: Math.max(0, s.unreadCount - 1),
    })),
  markAllRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    })),

  stats: null,
  setStats: (stats) => set({ stats }),

  searchQuery: "",
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  activities: [],
  setActivities: (activities) => set({ activities }),
  prependActivity: (a) =>
    set((s) => ({ activities: [a, ...s.activities].slice(0, 30) })),
}))
