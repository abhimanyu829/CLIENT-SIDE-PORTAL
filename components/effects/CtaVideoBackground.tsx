"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

export function CtaVideoBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const video = videoRef.current;
    if (!video) return;

    const src = "https://stream.mux.com/8wrHPCX2dC3msyYU9ObwqNdm00u3ViXvOSHUMRYSEe5Q.m3u8";

    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(video);
      return () => hls.destroy();
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
    }
  }, [mounted]);

  return (
    <>
      {/* Background HLS Video */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        {mounted && (
          <video
            ref={videoRef}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover opacity-80"
          />
        )}
      </div>

      {/* Top fade */}
      <div
        className="absolute top-0 left-0 right-0 z-[1] pointer-events-none"
        style={{ height: '200px', background: 'linear-gradient(to bottom, hsl(var(--card)), transparent)' }}
      />
      {/* Bottom fade */}
      <div
        className="absolute bottom-0 left-0 right-0 z-[1] pointer-events-none"
        style={{ height: '200px', background: 'linear-gradient(to top, hsl(var(--card)), transparent)' }}
      />
      
      {/* Whitish overlay for better visibility */}
      <div className="absolute inset-0 z-[1] bg-gradient-to-br from-white/60 to-gray-200/60 mix-blend-overlay pointer-events-none" />
      <div className="absolute inset-0 z-[1] bg-white/50 pointer-events-none" />
    </>
  );
}
