"use client"

import React from "react"
import { useUser } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { Phone } from "lucide-react"

export default function VoiceEnquiryModalButton() {
  const { isSignedIn, isLoaded } = useUser()
  const router = useRouter()

  const handleClick = () => {
    if (!isLoaded) return

    if (!isSignedIn) {
      // Must be logged in: redirect to login and then straight to pricing consultation form
      router.push(`/login?redirect_url=${encodeURIComponent("/pricing#consultation-form")}`)
      return
    }

    // If logged in: redirect smoothly to the pricing consultation form
    router.push("/pricing#consultation-form")
  }

  return (
    <button
      onClick={handleClick}
      className="group relative inline-flex w-full sm:w-auto items-center justify-center gap-2.5 overflow-hidden rounded-2xl border border-zinc-200/90 bg-white/95 px-7 py-4 text-xs sm:text-sm font-bold uppercase tracking-wider text-zinc-900 shadow-md shadow-zinc-950/5 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:scale-[1.03] hover:border-zinc-300 hover:bg-white hover:shadow-xl hover:shadow-zinc-950/10 active:translate-y-0 active:scale-[0.98] cursor-pointer"
    >
      <Phone className="w-4 h-4 text-rose-600 transition-transform duration-300 group-hover:scale-110" />
      <span>Request AI Call Enquiry</span>
    </button>
  )
}
