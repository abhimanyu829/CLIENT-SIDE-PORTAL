import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

export interface Notification {
  id: string
  title: string
  message: string
  type: "info" | "success" | "warning" | "error"
  read: boolean
  link?: string
  createdAt: string
}

interface NotifState {
  notifications: Notification[]
  unreadCount: number
  // Actions
  setNotifications: (notifications: Notification[]) => void
  addNotification: (notification: Notification) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  removeNotification: (id: string) => void
  clearAll: () => void
}

export const useNotifStore = create<NotifState>()(
  persist(
    (set, get) => ({
      notifications: [],
      unreadCount: 0,

      setNotifications: (notifications) =>
        set({
          notifications,
          unreadCount: notifications.filter((n) => !n.read).length,
        }),

      addNotification: (notification) =>
        set((state) => {
          // Deduplicate by id
          if (state.notifications.some((n) => n.id === notification.id)) return state
          const updated = [notification, ...state.notifications].slice(0, 100)
          return {
            notifications: updated,
            unreadCount: updated.filter((n) => !n.read).length,
          }
        }),

      markAsRead: (id) =>
        set((state) => {
          const updated = state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          )
          return { notifications: updated, unreadCount: updated.filter((n) => !n.read).length }
        }),

      markAllAsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
        })),

      removeNotification: (id) =>
        set((state) => {
          const updated = state.notifications.filter((n) => n.id !== id)
          return { notifications: updated, unreadCount: updated.filter((n) => !n.read).length }
        }),

      clearAll: () => set({ notifications: [], unreadCount: 0 }),
    }),
    {
      name: "notif-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        notifications: state.notifications.slice(0, 50),
        unreadCount: state.unreadCount,
      }),
    }
  )
)
