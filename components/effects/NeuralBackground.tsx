"use client"

import React, { useEffect, useRef } from 'react'

interface Point {
  x: number
  y: number
  vx: number
  vy: number
}

export function NeuralBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number
    let points: Point[] = []

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      initPoints()
    }

    const initPoints = () => {
      const numPoints = Math.floor((canvas.width * canvas.height) / 8000) // Increased density
      points = []
      for (let i = 0; i < numPoints; i++) {
        points.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 1.5,
          vy: (Math.random() - 0.5) * 1.5,
        })
      }
    }

    const draw = () => {
      if (!ctx || !canvas) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Pure bright white for visibility against dark Aurora theme
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)') 
      gradient.addColorStop(1, 'rgba(255, 255, 255, 1)') 
      ctx.fillStyle = gradient
      ctx.lineWidth = 1.5

      // Update and draw points
      for (let i = 0; i < points.length; i++) {
        const p = points[i]
        
        // Add brownian motion randomness
        p.vx += (Math.random() - 0.5) * 0.15
        p.vy += (Math.random() - 0.5) * 0.15
        
        // Limit max speed
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy)
        if (speed > 1.2) {
          p.vx = (p.vx / speed) * 1.2
          p.vy = (p.vy / speed) * 1.2
        }

        p.x += p.vx
        p.y += p.vy

        // Bounce off edges
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1

        ctx.beginPath()
        ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2) // Larger points
        ctx.fill()

        // Connect near points
        for (let j = i + 1; j < points.length; j++) {
          const p2 = points[j]
          const dx = p.x - p2.x
          const dy = p.y - p2.y
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist < 180) { // Increased connection distance
            ctx.beginPath()
            ctx.strokeStyle = `rgba(255, 255, 255, ${1 - dist / 180})` // Dynamic opacity based on distance
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(p2.x, p2.y)
            ctx.stroke()
          }
        }
      }

      animationFrameId = requestAnimationFrame(draw)
    }

    window.addEventListener('resize', resize)
    resize()
    draw()

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return (
    <div className="absolute inset-0 z-[2] overflow-hidden pointer-events-none">
      <canvas
        ref={canvasRef}
        className="block h-full w-full opacity-100"
      />
      {/* Dynamic gradient overlay to soften edges */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/40 to-background" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-background/20 to-background/90" />
    </div>
  )
}
