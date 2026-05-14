import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

// Matches next-auth session user shape + our custom fields
export interface AuthUser {
  id: string
  name: string | null
  email: string | null
  image: string | null
  role: "ADMIN" | "CLIENT" | "STAFF"
  permissions: string[]
  avatarUrl?: string | null
}

interface AuthState {
  user: AuthUser | null
  isLoading: boolean
  isHydrated: boolean

  // Actions
  setUser: (user: AuthUser | null) => void
  setLoading: (loading: boolean) => void
  setHydrated: (hydrated: boolean) => void
  updateUser: (updates: Partial<AuthUser>) => void
  clearUser: () => void

  // Derived getters
  isAdmin: () => boolean
  isStaff: () => boolean
  hasPermission: (permission: string) => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: true,
      isHydrated: false,

      setUser: (user) => set({ user, isLoading: false }),
      setLoading: (isLoading) => set({ isLoading }),
      setHydrated: (isHydrated) => set({ isHydrated }),

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),

      clearUser: () => set({ user: null, isLoading: false }),

      isAdmin: () => get().user?.role === "ADMIN",
      isStaff: () => ["ADMIN", "STAFF"].includes(get().user?.role ?? ""),

      hasPermission: (permission: string) => {
        const { user } = get()
        if (!user) return false
        if (user.role === "ADMIN") return true // admins bypass all
        return user.permissions.includes(permission)
      },
    }),
    {
      name: "auth-store",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : ({} as Storage)
      ),
      // Only persist non-sensitive display fields
      partialize: (state) => ({
        user: state.user
          ? {
              id: state.user.id,
              name: state.user.name,
              email: state.user.email,
              image: state.user.image,
              role: state.user.role,
              permissions: state.user.permissions,
              avatarUrl: state.user.avatarUrl,
            }
          : null,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true)
      },
    }
  )
)
