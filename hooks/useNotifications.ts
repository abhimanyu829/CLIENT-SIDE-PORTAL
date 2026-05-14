"use client"

import { useEffect } from 'react'
import { create } from 'zustand'
import { pusherClient } from '@/lib/pusher'

interface Notification {
  id: string
  title: string
  message: string
  type: string
  read: boolean
  createdAt: string | Date
}

interface NotificationStore {
  notifications: Notification[]
  unreadCount: number
  setNotifications: (notifications: Notification[]) => void
  addNotification: (notification: Notification) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],
  unreadCount: 0,
  setNotifications: (notifications) => set({
    notifications,
    unreadCount: notifications.filter(n => !n.read).length
  }),
  addNotification: (notification) => set((state) => {
    const newNotifications = [notification, ...state.notifications]
    return {
      notifications: newNotifications,
      unreadCount: newNotifications.filter(n => !n.read).length
    }
  }),
  markAsRead: (id) => set((state) => {
    const newNotifications = state.notifications.map(n => 
      n.id === id ? { ...n, read: true } : n
    )
    return {
      notifications: newNotifications,
      unreadCount: newNotifications.filter(n => !n.read).length
    }
  }),
  markAllAsRead: () => set((state) => {
    const newNotifications = state.notifications.map(n => ({ ...n, read: true }))
    return {
      notifications: newNotifications,
      unreadCount: 0
    }
  })
}))

export function useNotifications(userId?: string) {
  const { notifications, unreadCount, setNotifications, addNotification, markAsRead, markAllAsRead } = useNotificationStore()

  useEffect(() => {
    if (!userId) return

    const fetchNotifications = async () => {
      try {
        const res = await fetch('/api/notifications')
        if (res.ok) {
          const { data } = await res.json()
          setNotifications(data || [])
        }
      } catch (error) {
        console.error("Failed to fetch notifications:", error)
      }
    }
    fetchNotifications()

    const channel = pusherClient.subscribe(`private-user-${userId}`)
    
    channel.bind('new-notification', (data: Notification) => {
      addNotification(data)
    })

    return () => {
      pusherClient.unsubscribe(`private-user-${userId}`)
    }
  }, [userId, setNotifications, addNotification])

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead
  }
}
