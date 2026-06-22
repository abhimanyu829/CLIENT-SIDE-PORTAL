"use client"

import { useEffect, useRef } from "react"

export default function BackgroundVideo() {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const HLS_URL =
      "https://stream.mux.com/kimF2ha9zLrX64H00UgLGPflCzNtl1T0215MlAmeOztv8.m3u8"

    let rafId: number
    let startTime: number | null = null
    const FADE_DURATION = 500
    let hlsInstance: any = null
    let destroyed = false

    function fadeIn(timestamp: number) {
      if (destroyed) return
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / FADE_DURATION, 1)
      if (video) video.style.opacity = String(progress)
      if (progress < 1) rafId = requestAnimationFrame(fadeIn)
    }

    function startFade() {
      startTime = null
      rafId = requestAnimationFrame(fadeIn)
    }

    // Silently swallow all media errors so they never surface as "[object Event]"
    const onVideoError = () => { /* intentionally silent */ }
    video.addEventListener("error", onVideoError)
    video.style.opacity = "0"

    const loadVideo = async () => {
      try {
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          // Native HLS — Safari
          video.src = HLS_URL
          video.addEventListener("canplay", startFade, { once: true })
          video.play().catch(() => {})
        } else {
          // hls.js — Chrome / Firefox / Edge
          const HlsModule = await import("hls.js")
          const Hls = HlsModule.default

          if (!Hls.isSupported()) return

          hlsInstance = new Hls({
            autoStartLoad: true,
            // Suppress hls.js from re-throwing network/media events
            enableWorker: false,
          })

          // Handle HLS-level errors silently
          hlsInstance.on(Hls.Events.ERROR, (_: any, data: any) => {
            if (data?.fatal) {
              // Fatal error — destroy quietly, don't rethrow
              try { hlsInstance?.destroy() } catch (_) {}
              hlsInstance = null
            }
          })

          hlsInstance.loadSource(HLS_URL)
          hlsInstance.attachMedia(video)

          hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
            if (destroyed) return
            video.play().catch(() => {})
            startFade()
          })
        }
      } catch {
        // Any unexpected error during setup — fail silently
      }
    }

    loadVideo()

    return () => {
      destroyed = true
      cancelAnimationFrame(rafId)
      video.removeEventListener("error", onVideoError)
      try { hlsInstance?.destroy() } catch (_) {}
    }
  }, [])

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-0 overflow-hidden pointer-events-none"
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        className="w-full h-full object-cover"
        style={{ opacity: 0 }}
      />
    </div>
  )
}
