"use client"

import React, { useState } from "react"
import { X, Bot, Sparkles } from "lucide-react"

export default function WhatsAppFloatingWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [message, setMessage] = useState("Hi! I would like to enquire about your software & AI solutions.")

  // Target WhatsApp Bot Number: +1 711-719-8356 (E.164: +17117198356 / 17117198356)
  const phoneDigits = "17117198356"
  const encodedMsg = encodeURIComponent(message)
  const whatsappUrl = `https://wa.me/${phoneDigits}?text=${encodedMsg}`

  return (
    <div className="fixed bottom-24 right-4 sm:bottom-28 sm:right-6 z-[10001] flex flex-col items-end print:hidden">
      {/* Expanded Clean White Dialog Box */}
      {isOpen && (
        <div className="mb-3 w-80 sm:w-88 rounded-3xl bg-white border border-zinc-200/90 text-zinc-900 shadow-2xl p-5 animate-in fade-in slide-in-from-bottom-3 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100 mb-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                  <Bot className="w-5 h-5" />
                </div>
                <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-zinc-950 flex items-center gap-1.5">
                  Abhibhi AI Bot
                  <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                </h4>
                <p className="text-[11px] font-medium text-emerald-600 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active on WhatsApp
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* White Card Intro Bubble */}
          <p className="text-xs text-zinc-700 leading-relaxed mb-3.5 bg-zinc-50 p-3.5 rounded-2xl border border-zinc-100 font-normal">
            👋 Hello! Our AI Bots are active 24/7 on WhatsApp to answer your questions, share instant pricing quotes, and assist you.
          </p>

          {/* Text Area & Submit */}
          <div className="space-y-3">
            <textarea
              rows={2}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full text-xs bg-zinc-50 border border-zinc-200 rounded-xl p-3 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all resize-none font-medium"
              placeholder="Type your question..."
            />

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.694.072-2.18-.544-1.898-.787-3.119-2.735-3.214-2.861-.095-.126-.763-1.016-.763-1.938 0-.923.484-1.378.655-1.569.172-.191.374-.239.5-.239.125 0 .25.002.359.007.114.005.267-.043.418.321.156.376.533 1.303.579 1.398.047.095.078.207.016.332-.063.125-.094.204-.188.313-.094.11-.198.245-.282.329-.095.094-.194.197-.083.388.111.19.493.813 1.059 1.317.728.648 1.341.85 1.532.944.19.096.303.08.416-.051.114-.131.487-.567.616-.761.13-.194.258-.162.433-.098.174.064 1.109.523 1.299.618.19.095.316.142.363.222.047.08.047.464-.097.869z" />
              </svg>
              Chat on WhatsApp Directly
            </a>
          </div>
        </div>
      )}

      {/* Perfectly Circular Floating WhatsApp Button - Placed Above 'Chat with us' */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 sm:w-[60px] sm:h-[60px] rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-[0_8px_28px_rgba(16,185,129,0.4),0_4px_12px_rgba(0,0,0,0.12)] border-2 border-white flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer relative"
        aria-label="Open WhatsApp AI Chat"
        title="Chat on WhatsApp"
      >
        <span className="absolute -top-1 -right-1 flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-400 border-2 border-white" />
        </span>

        <svg className="w-7 h-7 fill-current" viewBox="0 0 24 24">
          <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.694.072-2.18-.544-1.898-.787-3.119-2.735-3.214-2.861-.095-.126-.763-1.016-.763-1.938 0-.923.484-1.378.655-1.569.172-.191.374-.239.5-.239.125 0 .25.002.359.007.114.005.267-.043.418.321.156.376.533 1.303.579 1.398.047.095.078.207.016.332-.063.125-.094.204-.188.313-.094.11-.198.245-.282.329-.095.094-.194.197-.083.388.111.19.493.813 1.059 1.317.728.648 1.341.85 1.532.944.19.096.303.08.416-.051.114-.131.487-.567.616-.761.13-.194.258-.162.433-.098.174.064 1.109.523 1.299.618.19.095.316.142.363.222.047.08.047.464-.097.869z" />
        </svg>
      </button>
    </div>
  )
}
