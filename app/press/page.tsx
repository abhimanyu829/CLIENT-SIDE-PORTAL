import React from "react"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "404 - Page Not Found",
  description: "The path may be broken, but the journey isn't. Let's get you back.",
}

export default function Press404Page() {
  return (
    <>
      <style>{`
        @font-face {
          font-family: "Geist Mono:SemiBold";
          font-style: normal;
          font-weight: 600;
          font-display: swap;
          src: url("https://static.figma.com/font/GeistMono_wght__1") format("woff2");
        }

        .font-geist-mono {
          font-family: "Geist Mono:SemiBold", monospace;
        }

        .heading-404-gradient {
          background: linear-gradient(
            247.3282658084845deg,
            rgb(255, 255, 255) 2.5334%,
            rgba(255, 255, 255, 0.4) 93.612%
          );
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
      `}</style>

      <main className="relative min-h-[100svh] w-full bg-black overflow-x-hidden select-none">
        {/* Background Video */}
        <video
          autoPlay
          loop
          muted
          playsInline
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover opacity-100 z-0 pointer-events-none"
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260801_001207_ec20d138-aa45-4b2b-ab8c-bdc71607f240.mp4"
        />

        {/* Header Logo */}
        <div className="absolute left-1/2 -translate-x-1/2 top-[32px] sm:top-[80px] z-20 transition-transform origin-center scale-75 sm:scale-100 flex items-center justify-center">
          {/* Geometric Pixel Mark SVG */}
          <svg
            viewBox="0 0 54 40"
            fill="none"
            className="w-[54px] h-[40px] shrink-0"
            aria-hidden="true"
          >
            <path d="M38 0H26V12H38V0Z" fill="white" />
            <path d="M54 12H38V28H54V12Z" fill="white" />
            <path d="M38 28H26V40H38V28Z" fill="white" />
            <path d="M26 12H16V22H26V12Z" fill="white" />
            <path d="M16 22H8V30H16V22Z" fill="white" />
            <path d="M16 2H6V12H16V2Z" fill="white" />
            <path d="M6 12H0V18H6V12Z" fill="white" />
          </svg>
        </div>

        {/* Centered 404 Content */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center text-center w-[min(100%-40px,360px)] sm:w-[483px] gap-[28px] sm:gap-[44px]">
          {/* 404 Heading */}
          <h1 className="font-geist-mono font-600 leading-[1.1] text-center heading-404-gradient h-auto min-h-0 pb-4 overflow-visible text-[clamp(140px,52vw,200px)] sm:text-[295.751px] tracking-[-0.09em] sm:tracking-[-24.6459px]">
            404
          </h1>

          {/* Divider */}
          <div className="h-[1px] bg-white w-full sm:w-[425px] shrink-0" />

          {/* Message */}
          <p className="font-geist-mono font-600 leading-[1.1] text-white text-center w-full text-[clamp(16px,4.5vw,20px)] sm:text-[24px] tracking-[-1.3px] sm:tracking-[-2px]">
            The path may be broken, but the journey isn't. Let's get you back.
          </p>
        </div>
      </main>
    </>
  )
}
