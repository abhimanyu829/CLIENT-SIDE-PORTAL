"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

export interface TestimonialItem {
  id: string
  body: string
  rating?: number | null
  user?: {
    name: string | null
    avatarUrl: string | null
  } | null
  product?: {
    name: string
  } | null
}

interface RotatingTestimonialsProps {
  testimonials: TestimonialItem[]
}

function TestimonialCard({ t }: { t: TestimonialItem }) {
  const stars = t.rating ?? 5

  return (
    <div className="bg-card text-card-foreground rounded-xl p-[24px] border border-border card-hover shadow-sm flex flex-col justify-between h-full">
      <div>
        <div className="flex gap-1 mb-4" aria-label={`${stars} out of 5 stars`}>
          {Array.from({ length: 5 }).map((_, i) => (
            <span
              key={i}
              className={`text-[12px] ${i < stars ? "text-amber-400" : "text-muted-foreground/30"}`}
            >
              ★
            </span>
          ))}
        </div>
        <p className="text-muted-foreground mb-6 leading-relaxed text-[16px]">&ldquo;{t.body}&rdquo;</p>
      </div>
      <div className="flex items-center gap-3 border-t border-border/50 pt-4 mt-auto">
        {t.user?.avatarUrl ? (
          <img
            src={t.user.avatarUrl}
            alt={t.user.name || ""}
            className="w-10 h-10 rounded-full object-cover border border-border shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-sm font-bold text-primary-foreground shrink-0">
            {(t.user?.name || "?").charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="font-medium text-[16px] truncate">{t.user?.name || "Verified Customer"}</p>
          <p className="text-muted-foreground text-[12px] font-mono truncate">
            Verified Customer · {t.product?.name || "Service"}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function RotatingTestimonials({ testimonials }: RotatingTestimonialsProps) {
  const [index, setIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [visibleCount, setVisibleCount] = useState(3)
  const touchStartX = useRef<number | null>(null)

  // Responsive items-per-view matching Tailwind breakpoints
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 640) {
        setVisibleCount(1)
      } else if (window.innerWidth < 1024) {
        setVisibleCount(2)
      } else {
        setVisibleCount(3)
      }
    }
    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  const count = testimonials.length
  const maxIndex = Math.max(0, count - visibleCount)

  const nextSlide = useCallback(() => {
    setIndex((prev) => (prev >= maxIndex ? 0 : prev + 1))
  }, [maxIndex])

  const prevSlide = useCallback(() => {
    setIndex((prev) => (prev <= 0 ? maxIndex : prev - 1))
  }, [maxIndex])

  // Keep index within bounds on resize
  useEffect(() => {
    if (index > maxIndex) {
      setIndex(maxIndex)
    }
  }, [maxIndex, index])

  // Auto-rotate every 5 seconds when more reviews than visible cards
  useEffect(() => {
    if (isPaused || count <= visibleCount) return
    const timer = setInterval(() => {
      nextSlide()
    }, 5000)
    return () => clearInterval(timer)
  }, [isPaused, count, visibleCount, nextSlide])

  // Swipe support for touch screens
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const diff = touchStartX.current - e.changedTouches[0].clientX
    if (diff > 50) {
      nextSlide()
    } else if (diff < -50) {
      prevSlide()
    }
    touchStartX.current = null
  }

  // 1. Fallback when no reviews
  if (count === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl p-8 sm:p-10 text-center space-y-3 shadow-sm">
        <div className="flex justify-center gap-1 text-amber-400 text-lg" aria-hidden="true">★★★★★</div>
        <p className="text-lg font-bold text-foreground">Verified Customer & Admin Feedback</p>
        <p className="text-sm text-muted-foreground max-w-xl mx-auto">
          Explore transparent ratings and star feedback submitted directly by service users and platform administrators.
        </p>
      </div>
    )
  }

  // 2. Static grid when 3 or fewer reviews
  if (count <= 3) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-[16px]">
        {testimonials.map((t) => (
          <TestimonialCard key={t.id} t={t} />
        ))}
      </div>
    )
  }

  // 3. Rotating carousel when more reviews are submitted
  return (
    <div
      className="relative group/rotator"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Prev / Next buttons */}
      <button
        type="button"
        onClick={prevSlide}
        aria-label="Previous review"
        className="hidden sm:flex absolute -left-4 md:-left-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-background/90 hover:bg-background border border-border shadow-md items-center justify-center text-foreground hover:text-primary transition-all duration-200 hover:scale-110 active:scale-95 backdrop-blur-xs cursor-pointer"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      <button
        type="button"
        onClick={nextSlide}
        aria-label="Next review"
        className="hidden sm:flex absolute -right-4 md:-right-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-background/90 hover:bg-background border border-border shadow-md items-center justify-center text-foreground hover:text-primary transition-all duration-200 hover:scale-110 active:scale-95 backdrop-blur-xs cursor-pointer"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      {/* Track */}
      <div className="overflow-hidden py-1">
        <div
          className="flex gap-[16px] transition-transform duration-500 ease-out will-change-transform"
          style={{
            transform:
              visibleCount === 1
                ? `translateX(calc(-${index} * (100% + 16px)))`
                : `translateX(calc(-${index} * ((100% + 16px) / ${visibleCount})))`,
          }}
        >
          {testimonials.map((t) => (
            <div
              key={t.id}
              className="shrink-0 w-full sm:w-[calc(50%-8px)] md:w-[calc((100%-32px)/3)]"
            >
              <TestimonialCard t={t} />
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Dots */}
      <div className="flex items-center justify-center gap-1.5 mt-6">
        {Array.from({ length: maxIndex + 1 }).map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
              i === index
                ? "w-6 bg-primary"
                : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
            }`}
          />
        ))}
      </div>
    </div>
  )
}
