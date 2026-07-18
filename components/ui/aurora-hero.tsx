"use client"

import React from "react"
import { cn } from "@/lib/utils"

export interface AuroraHeroProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The main title text to display with the glass displacement effect. */
  title?: string
}

export function AuroraHero({
  title = "An awesome title",
  className,
  ...props
}: AuroraHeroProps) {
  const filterImageHref =
    "data:image/svg+xml," +
    encodeURIComponent(`
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1' color-interpolation-filters='sRGB'>
      <g>
        <rect width='1' height='1' fill='black' />
        <rect width='1' height='1' fill='url(#red)' style='mix-blend-mode:screen' />
        <rect width='1' height='1' fill='url(#green)' style='mix-blend-mode:screen' />
        <rect width='1' height='1' fill='url(#yellow)' style='mix-blend-mode:screen' />
      </g>
      <defs>
        <radialGradient id='yellow' cx='0' cy='0' r='1' >
          <stop stop-color='yellow' />
          <stop stop-color='yellow' offset='1' stop-opacity='0' />
        </radialGradient>
        <radialGradient id='green' cx='1' cy='0' r='1' >
          <stop stop-color='green' />
          <stop stop-color='green' offset='1' stop-opacity='0' />
        </radialGradient>
        <radialGradient id='red' cx='0' cy='1' r='1' >
          <stop stop-color='red' />
          <stop stop-color='red' offset='1' stop-opacity='0' />
        </radialGradient>
      </defs>
    </svg>
  `)

  return (
    <section
      className={cn(
        "aurora-hero-wrapper relative h-[500px] min-h-[400px] w-full overflow-hidden sm:h-[600px]",
        className
      )}
      {...props}
    >
      <style>{`
        .aurora-hero-wrapper {
          background: #fbfaf7;
          font-family: Inter, sans-serif;
        }
        @keyframes auroraStripeDrift {
          0% { background-position: 0 0, 0 0; }
          50% { background-position: 0 0, 72px 0; }
          100% { background-position: 0 0, 144px 0; }
        }
        .aurora-hero-bg {
          width: 100%;
          height: 100%;
          position: absolute;
          inset: 0;
          background:
            linear-gradient(90deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.96) 20%, rgba(255,255,255,0.54) 38%, rgba(255,255,255,0.08) 60%, rgba(255,255,255,0.0) 100%),
            repeating-linear-gradient(
              90deg,
              rgba(248, 247, 244, 0.96) 0px,
              rgba(248, 247, 244, 0.96) 18px,
              rgba(196, 220, 174, 0.9) 19px,
              rgba(196, 220, 174, 0.9) 28px,
              rgba(255, 247, 224, 0.94) 29px,
              rgba(255, 247, 224, 0.94) 38px,
              rgba(255, 173, 140, 0.88) 39px,
              rgba(255, 173, 140, 0.88) 49px,
              rgba(255, 117, 132, 0.94) 50px,
              rgba(255, 117, 132, 0.94) 63px,
              rgba(255, 255, 255, 0.9) 64px,
              rgba(255, 255, 255, 0.9) 78px,
              rgba(213, 230, 188, 0.9) 79px,
              rgba(213, 230, 188, 0.9) 88px,
              rgba(240, 173, 96, 0.9) 89px,
              rgba(240, 173, 96, 0.9) 100px,
              rgba(255, 114, 128, 0.96) 101px,
              rgba(255, 114, 128, 0.96) 115px,
              rgba(255, 250, 238, 0.92) 116px,
              rgba(255, 250, 238, 0.92) 132px
            );
          background-size: auto, 132px 100%;
          filter: blur(2px) saturate(145%);
          transform: scale(1.03);
          animation: auroraStripeDrift 18s linear infinite;
        }
        .aurora-hero-bg::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(
            90deg,
            rgba(255,255,255,1) 0%,
            rgba(255,255,255,0.98) 22%,
            rgba(255,255,255,0.56) 40%,
            rgba(255,255,255,0.1) 62%,
            rgba(255,255,255,0) 100%
          );
        }
        .aurora-hero-bg::after {
          content: "";
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse at 12% 50%, rgba(255,255,255,0.66) 0%, rgba(255,255,255,0.28) 32%, transparent 55%),
            radial-gradient(ellipse at 62% 48%, rgba(255, 222, 220, 0.18) 0%, transparent 45%),
            radial-gradient(ellipse at 88% 48%, rgba(210, 228, 198, 0.16) 0%, transparent 42%);
        }
        .aurora-content {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          display: flex;
          place-content: center;
          place-items: center;
          flex-flow: column;
          gap: 4.5%;
          text-align: center;
          backdrop-filter: contrast(0.9) blur(7px) url(#fluted);
          -webkit-backdrop-filter: contrast(0.9) blur(7px) url(#fluted);
          mix-blend-mode: difference;
          filter: invert(1);
        }
        .h1-scalingSize {
          font-size: calc(1rem - -5vw);
          position: relative;
          isolation: isolate;
          font-weight: 700;
        }
        .h1-scalingSize::first-letter {
          font-size: 300%;
        }
        .h1-scalingSize::before {
          content: attr(data-text);
          position: absolute;
          inset: 0;
          background: white;
          text-shadow: 0 0 1px #ffffff;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          background-color: white;
          -webkit-mask: linear-gradient(#000 0 0) luminance;
          mask: linear-gradient(#000 0 0) luminance, alpha;
          backdrop-filter: blur(19px) brightness(12.5);
          -webkit-text-stroke: 1px white;
          display: flex;
          margin: auto;
          z-index: 0;
          pointer-events: none;
        }
      `}</style>

      <div className="aurora-hero-bg" />

      {title ? (
        <div className="aurora-content">
          <h1 className="h1-scalingSize" data-text={title}>
            {title}
          </h1>
        </div>
      ) : null}

      <svg
        version="1.1"
        xmlns="http://www.w3.org/2000/svg"
        xmlnsXlink="http://www.w3.org/1999/xlink"
        colorInterpolationFilters="sRGB"
        style={{
          position: "absolute",
          opacity: 0,
          height: 0,
          width: 0,
          pointerEvents: "none",
        }}
        aria-hidden="true"
        focusable="false"
      >
        <filter id="fluted" primitiveUnits="objectBoundingBox">
          <feImage
            x="0"
            y="0"
            result="image_0"
            crossOrigin="anonymous"
            href={filterImageHref}
            preserveAspectRatio="none meet"
            width=".03"
            height="1"
          />
          <feTile in="image_0" result="tile_0" />
          <feGaussianBlur
            stdDeviation=".0001"
            edgeMode="none"
            in="tile_0"
            result="bar_smoothness"
            x="0"
            y="0"
          />
          <feDisplacementMap
            scale=".08"
            xChannelSelector="R"
            yChannelSelector="G"
            in="SourceGraphic"
            in2="bar_smoothness"
            result="displacement_0"
          />
        </filter>
      </svg>
    </section>
  )
}

export default AuroraHero
