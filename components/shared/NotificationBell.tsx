"use client"

import { useState, useRef, useEffect } from "react"
import { useNotifications } from "@/hooks/useNotifications"
import { Button } from "@/components/ui/button"

export function NotificationBell({ userId }: { userId?: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications(userId)

  // Handle click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  const handleMarkAllRead = async () => {
    markAllAsRead()
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllAsRead: true })
      })
    } catch (error) {
      console.error("Failed to sync mark all read")
    }
  }

  const handleMarkRead = async (id: string, read: boolean) => {
    if (read) return
    markAsRead(id)
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })
    } catch (error) {
      console.error("Failed to sync mark read")
    }
  }

  const getTimeAgo = (date: string | Date) => {
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
    const diffDays = Math.round((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return "Today"
    return rtf.format(diffDays, 'day')
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <Button 
        variant="ghost" 
        size="icon" 
        className="relative"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="text-xl">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-background">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-background border rounded-xl shadow-2xl z-50 overflow-hidden origin-top-right animate-in fade-in zoom-in-95 duration-200">
          <div className="p-4 border-b flex justify-between items-center bg-muted/20">
            <h3 className="font-bold">Notifications</h3>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={handleMarkAllRead} className="h-8 text-xs text-blue-600">
                Mark all read
              </Button>
            )}
          </div>
          
          <div className="max-h-[400px] overflow-y-auto divide-y">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                <span className="text-3xl block mb-2">🎉</span>
                You're all caught up!
              </div>
            ) : (
              notifications.map((notif) => (
                <div 
                  key={notif.id} 
                  className={`p-4 hover:bg-muted/30 transition-colors cursor-pointer flex gap-3 ${!notif.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                  onClick={() => handleMarkRead(notif.id, notif.read)}
                >
                  <div className="mt-1 shrink-0">
                    {notif.type === 'message' && <span className="text-blue-500 text-lg">💬</span>}
                    {notif.type === 'system' && <span className="text-zinc-500 text-lg">⚙️</span>}
                    {notif.type === 'billing' && <span className="text-green-500 text-lg">💳</span>}
                    {notif.type === 'alert' && <span className="text-red-500 text-lg">⚠️</span>}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between items-start">
                      <p className={`text-sm ${!notif.read ? 'font-bold' : 'font-medium text-foreground/80'}`}>
                        {notif.title}
                      </p>
                      <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                        {getTimeAgo(notif.createdAt)}
                      </span>
                    </div>
                    <p className={`text-sm ${!notif.read ? 'text-foreground/90' : 'text-muted-foreground'}`}>
                      {notif.message}
                    </p>
                  </div>
                  {!notif.read && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 shrink-0"></div>
                  )}
                </div>
              ))
            )}
          </div>
          
          <div className="p-2 border-t bg-muted/10">
            <Button variant="ghost" className="w-full text-xs text-muted-foreground">View all notifications</Button>
          </div>
        </div>
      )}
    </div>
  )
}
