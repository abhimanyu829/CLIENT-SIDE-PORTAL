"use client"

import { useEffect, useRef } from "react"
import { useDebounce } from "@/hooks/useDebounce"

interface ProductSearchProps {
  value: string
  onChange: (value: string) => void
  onSearch: (query: string) => void
  placeholder?: string
  debounceMs?: number
}

export function ProductSearch({
  value,
  onChange,
  onSearch,
  placeholder = "Search products…",
  debounceMs = 300,
}: ProductSearchProps) {
  const debounced = useDebounce(value, debounceMs)
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    onSearch(debounced)
  }, [debounced]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative">
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <circle cx="11" cy="11" r="8" strokeWidth="2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-4 py-2.5 border rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-shadow"
      />
      {value && (
        <button
          onClick={() => { onChange(""); onSearch("") }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-lg leading-none"
        >
          ×
        </button>
      )}
    </div>
  )
}
