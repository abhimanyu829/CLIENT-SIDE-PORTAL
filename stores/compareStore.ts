import { create } from 'zustand'

interface ProductPreview {
  id: string
  name: string
  slug: string
}

interface CompareStore {
  comparedProducts: ProductPreview[]
  addProduct: (product: ProductPreview) => void
  removeProduct: (id: string) => void
  clearCompare: () => void
}

export const useCompareStore = create<CompareStore>((set) => ({
  comparedProducts: [],
  addProduct: (product) => set((state) => {
    if (state.comparedProducts.find(p => p.id === product.id)) return state
    if (state.comparedProducts.length >= 4) return state // max 4
    return { comparedProducts: [...state.comparedProducts, product] }
  }),
  removeProduct: (id) => set((state) => ({
    comparedProducts: state.comparedProducts.filter(p => p.id !== id)
  })),
  clearCompare: () => set({ comparedProducts: [] })
}))
