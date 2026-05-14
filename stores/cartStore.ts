import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

export interface CartItem {
  productId: string
  tierId: string
  productName: string
  tierName: string
  slug: string
  thumbnailUrl: string | null
  price: number
  currency: string
  billingPeriod: "MONTHLY" | "ANNUAL" | "LIFETIME" | "ONE_TIME"
  quantity: number
}

interface CartState {
  items: CartItem[]
  couponCode: string | null
  couponDiscount: number // percentage 0-100

  // Actions
  addItem: (item: CartItem) => void
  removeItem: (tierId: string) => void
  updateQuantity: (tierId: string, quantity: number) => void
  clearCart: () => void
  applyCoupon: (code: string, discount: number) => void
  removeCoupon: () => void

  // Derived
  itemCount: () => number
  subtotal: () => number
  discountAmount: () => number
  total: () => number
  hasItem: (tierId: string) => boolean
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      couponCode: null,
      couponDiscount: 0,

      addItem: (item) =>
        set((state) => {
          const existing = state.items.find((i) => i.tierId === item.tierId)
          if (existing) {
            // Update quantity if already in cart
            return {
              items: state.items.map((i) =>
                i.tierId === item.tierId
                  ? { ...i, quantity: i.quantity + item.quantity }
                  : i
              ),
            }
          }
          return { items: [...state.items, item] }
        }),

      removeItem: (tierId) =>
        set((state) => ({
          items: state.items.filter((i) => i.tierId !== tierId),
        })),

      updateQuantity: (tierId, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((i) => i.tierId !== tierId)
              : state.items.map((i) =>
                  i.tierId === tierId ? { ...i, quantity } : i
                ),
        })),

      clearCart: () => set({ items: [], couponCode: null, couponDiscount: 0 }),

      applyCoupon: (code, discount) =>
        set({ couponCode: code, couponDiscount: Math.min(100, Math.max(0, discount)) }),

      removeCoupon: () => set({ couponCode: null, couponDiscount: 0 }),

      // Computed selectors
      itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

      subtotal: () =>
        get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),

      discountAmount: () => {
        const { couponDiscount } = get()
        if (!couponDiscount) return 0
        return Math.round(get().subtotal() * (couponDiscount / 100))
      },

      total: () => Math.max(0, get().subtotal() - get().discountAmount()),

      hasItem: (tierId) => get().items.some((i) => i.tierId === tierId),
    }),
    {
      name: "cart-store",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : ({} as Storage)
      ),
    }
  )
)
