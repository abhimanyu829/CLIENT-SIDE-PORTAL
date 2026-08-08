"use client"

import React, { useEffect, useRef } from 'react'

interface Point {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  baseAlpha: number
}

export function NeuralBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({
    x: -1000,
    y: -1000,
    active: false,
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number
    let points: Point[] = []

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = {
        x: e.clientX,
        y: e.clientY,
        active: true,
      }
    }

    const handleMouseLeave = () => {
      mouseRef.current.active = false
    }

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      initPoints()
    }

    const initPoints = () => {
      const numPoints = Math.floor((canvas.width * canvas.height) / 7000)
      points = []
      for (let i = 0; i < numPoints; i++) {
        points.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 1.2,
          vy: (Math.random() - 0.5) * 1.2,
          radius: Math.random() * 1.8 + 1.2,
          baseAlpha: Math.random() * 0.5 + 0.3,
        })
      }
    }

    const draw = () => {
      if (!ctx || !canvas) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const mouse = mouseRef.current

      // Draw cursor ambient glow spotlight
      if (mouse.active) {
        const spotGlow = ctx.createRadialGradient(
          mouse.x,
          mouse.y,
          0,
          mouse.x,
          mouse.y,
          250
        )
        spotGlow.addColorStop(0, 'rgba(161, 98, 7, 0.12)')
        spotGlow.addColorStop(0.5, 'rgba(139, 92, 246, 0.05)')
        spotGlow.addColorStop(1, 'rgba(0, 0, 0, 0)')
        ctx.fillStyle = spotGlow
        ctx.beginPath()
        ctx.arc(mouse.x, mouse.y, 250, 0, Math.PI * 2)
        ctx.fill()
      }

      // Update and draw points
      for (let i = 0; i < points.length; i++) {
        const p = points[i]

        // Add subtle wave turbulence
        p.vx += (Math.random() - 0.5) * 0.08
        p.vy += (Math.random() - 0.5) * 0.08

        // Mouse attraction/repulsion interaction
        if (mouse.active) {
          const mdx = mouse.x - p.x
          const mdy = mouse.y - p.y
          const mdist = Math.sqrt(mdx * mdx + mdy * mdy)
          if (mdist < 180 && mdist > 0) {
            const force = (180 - mdist) / 180
            p.vx += (mdx / mdist) * force * 0.3
            p.vy += (mdy / mdist) * force * 0.3
          }
        }

        // Limit speed
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy)
        if (speed > 1.8) {
          p.vx = (p.vx / speed) * 1.8
          p.vy = (p.vy / speed) * 1.8
        }

        p.x += p.vx
        p.y += p.vy

        // Bounce gently at borders
        if (p.x < 0) { p.x = 0; p.vx *= -1 }
        if (p.x > canvas.width) { p.x = canvas.width; p.vx *= -1 }
        if (p.y < 0) { p.y = 0; p.vy *= -1 }
        if (p.y > canvas.height) { p.y = canvas.height; p.vy *= -1 }

        // Point rendering
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(161, 98, 7, ${p.baseAlpha})`
        ctx.fill()

        // Draw node connections
        for (let j = i + 1; j < points.length; j++) {
          const p2 = points[j]
          const dx = p.x - p2.x
          const dy = p.y - p2.y
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist < 150) {
            ctx.beginPath()
            ctx.strokeStyle = `rgba(161, 98, 7, ${(1 - dist / 150) * 0.35})`
            ctx.lineWidth = 1
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(p2.x, p2.y)
            ctx.stroke()
          }
        }

        // Mouse line connections
        if (mouse.active) {
          const mdx = mouse.x - p.x
          const mdy = mouse.y - p.y
          const mdist = Math.sqrt(mdx * mdx + mdy * mdy)
          if (mdist < 200) {
            ctx.beginPath()
            ctx.strokeStyle = `rgba(161, 98, 7, ${(1 - mdist / 200) * 0.6})`
            ctx.lineWidth = 1.2
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(mouse.x, mouse.y)
            ctx.stroke()
          }
        }
      }

      animationFrameId = requestAnimationFrame(draw)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseleave', handleMouseLeave)
    window.addEventListener('resize', resize)
    resize()
    draw()

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseleave', handleMouseLeave)
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return (
    <div className="absolute inset-0 z-[2] overflow-hidden pointer-events-none">
      <canvas ref={canvasRef} className="block h-full w-full opacity-90" />
      {/* Soft background ambient gradient shapes */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-600/5 rounded-full blur-3xl" />
    </div>
  )
}

