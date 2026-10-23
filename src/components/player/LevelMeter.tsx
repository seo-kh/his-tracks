import React, { useEffect, useRef } from "react"

interface LevelMeterProps {
  trackId: string
  analyserNodesRef: React.RefObject<Map<string, AnalyserNode> | null>
  height: number
}

export function LevelMeter({
  trackId,
  analyserNodesRef,
  height,
}: LevelMeterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const peakRef = useRef<number>(0)
  const peakHoldRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const SEGMENTS = 24,
      GAP = 1.5,
      W = 7

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw)
      const analyser = analyserNodesRef.current?.get(trackId)
      let level = 0
      if (analyser) {
        const data = new Float32Array(analyser.frequencyBinCount)
        analyser.getFloatTimeDomainData(data)
        let sum = 0
        for (let i = 0; i < data.length; i++) sum += data[i] * data[i]
        const rms = Math.sqrt(sum / data.length)
        const db = 20 * Math.log10(Math.max(rms, 1e-10))
        level = Math.max(0, Math.min(1, (db + 60) / 60))
      }
      if (level >= peakRef.current) {
        peakRef.current = level
        peakHoldRef.current = 60
      } else {
        peakHoldRef.current--
        if (peakHoldRef.current <= 0)
          peakRef.current = Math.max(0, peakRef.current - 0.01)
      }
      const H = height
      canvas.width = W
      canvas.height = H
      const segH = (H - GAP * (SEGMENTS - 1)) / SEGMENTS
      for (let i = 0; i < SEGMENTS; i++) {
        const segFraction = (SEGMENTS - 1 - i) / (SEGMENTS - 1)
        const lit = segFraction <= level
        const isPeak = Math.abs(segFraction - peakRef.current) < 1 / SEGMENTS
        let color: string
        if (segFraction > 0.88) color = lit || isPeak ? "#ef4444" : "#2a1212"
        else if (segFraction > 0.65)
          color = lit || isPeak ? "#eab308" : "#1e1a08"
        else color = lit || isPeak ? "#22c55e" : "#0c1f10"
        const y = i * (segH + GAP)
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.roundRect(0, y, W, segH, 1)
        ctx.fill()
      }
    }
    draw()
    return () => cancelAnimationFrame(rafRef.current)
  }, [trackId, analyserNodesRef, height])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        left: 6,
        top: 0,
        width: 7,
        height,
        display: "block",
        imageRendering: "pixelated",
      }}
    />
  )
}

export default LevelMeter
