import { useEffect, useRef, useState } from "react"
import type * as React from "react"
import type { Track } from "../../../shared/types"
import { formatTime } from "../playerUtils"
import { CheckIcon } from "./PlayerIcons"

// ── Level Meter ────────────────────────────────────────────────────────────

function LevelMeter({
  trackId,
  analyserNodesRef,
  height,
}: {
  trackId: string
  analyserNodesRef: React.RefObject<Map<string, AnalyserNode>>
  height: number
}) {
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

// ── VerticalWaveform ───────────────────────────────────────────────────────

function VerticalWaveform({
  color,
  muted,
}: {
  color: string
  muted: boolean
}) {
  const bars = [0.35, 0.6, 0.8, 0.5, 0.9, 0.7, 1, 0.6, 0.75, 0.45, 0.85, 0.55]
  return (
    <div
      className="vertical-waveform"
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        gap: 2,
        width: 44,
        height: 56,
        flexShrink: 0,
        marginTop: 8,
        opacity: muted ? 0.15 : 0.55,
        transition: "opacity 0.2s",
      }}
    >
      {bars.map((h, i) => (
        <div
          key={i}
          style={{
            width: 2,
            height: `${h * 100}%`,
            background: color,
            borderRadius: 1,
          }}
        />
      ))}
    </div>
  )
}

// ── ChannelStrip ───────────────────────────────────────────────────────────

interface ChannelStripProps {
  track: Track
  index: number
  isDragging: boolean
  isDragOver: boolean
  isDeleteMode: boolean
  isSelectedForDelete: boolean
  onMute: () => void
  onSolo: () => void
  onVolume: (v: number) => void
  onToggleDeleteSelection: () => void
  onStripPointerDown: (e: React.PointerEvent, id: string) => void
  analyserNodesRef: React.RefObject<Map<string, AnalyserNode>>
}

export default function ChannelStrip({
  track,
  index,
  isDragging,
  isDragOver,
  isDeleteMode,
  isSelectedForDelete,
  onMute,
  onSolo,
  onVolume,
  onToggleDeleteSelection,
  onStripPointerDown,
  analyserNodesRef,
}: ChannelStripProps) {
  const volPct = track.volume * 100
  const faderAreaRef = useRef<HTMLDivElement>(null)
  const [faderHeight, setFaderHeight] = useState(120)

  useEffect(() => {
    const el = faderAreaRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries)
        setFaderHeight(Math.max(60, entry.contentRect.height))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const handlePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement
    if (target.tagName === "BUTTON" || target.tagName === "INPUT") return
    onStripPointerDown(e, track.id)
  }

  return (
    <div
      className="channel-strip"
      onPointerDown={handlePointerDown}
      style={{
        opacity: isDragging ? 0.35 : 1,
        outline: isDragging ? "2px solid #ffffff44" : undefined,
        borderLeft: isDragOver ? "2px solid #007AFF" : undefined,
        transition: "opacity 0.15s, border 0.1s",
        cursor: isDeleteMode ? "pointer" : isDragging ? "grabbing" : "default",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      <div
        style={{
          width: "100%",
          height: 4,
          background: track.color,
          opacity: track.muted ? 0.25 : 1,
          transition: "opacity 0.2s",
          boxShadow: track.muted ? "none" : `0 0 10px ${track.color}88`,
          flexShrink: 0,
        }}
      />
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          color: "#444",
          marginTop: 6,
          letterSpacing: "0.06em",
          userSelect: "none",
          flexShrink: 0,
        }}
      >
        {String(index + 1).padStart(2, "0")}
      </div>
      <div style={{ width: "100%", padding: "4px 8px 0", flexShrink: 0 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 500,
            color: track.muted ? "#3a3a3a" : "#b0b0b0",
            textAlign: "center",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            transition: "color 0.2s",
            lineHeight: 1.3,
          }}
        >
          {track.name}
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            color: "#3a3a3a",
            textAlign: "center",
            marginTop: 2,
          }}
        >
          {formatTime(track.duration)}
        </div>
      </div>
      <VerticalWaveform color={track.color} muted={track.muted} />
      <div
        ref={faderAreaRef}
        style={{
          flex: 1,
          minHeight: 0,
          width: "100%",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <LevelMeter
          trackId={track.id}
          analyserNodesRef={analyserNodesRef}
          height={faderHeight}
        />
        <div
          style={{
            position: "absolute",
            right: 4,
            top: 0,
            bottom: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            pointerEvents: "none",
          }}
        >
          {["+6", "0", "-6", "-∞"].map((label) => (
            <span
              key={label}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 7,
                color: "#3a3a3a",
                lineHeight: 1,
              }}
            >
              {label}
            </span>
          ))}
        </div>
        <input
          type="range"
          className="vol-slider"
          style={
            {
              position: "absolute",
              top: "50%",
              left: "50%",
              width: faderHeight,
              transform: "translateX(-50%) translateY(-50%) rotate(-90deg)",
              "--vol-progress": `${volPct}%`,
            } as React.CSSProperties
          }
          min={0}
          max={1}
          step={0.01}
          value={track.volume}
          onChange={(e) => onVolume(parseFloat(e.target.value))}
        />
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          color: "#505050",
          letterSpacing: "0.04em",
          flexShrink: 0,
          marginBottom: 4,
        }}
      >
        {Math.round(track.volume * 100)}
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexShrink: 0 }}>
        <button
          className={`mute-btn${track.muted ? " active" : ""}`}
          onClick={onMute}
          title="Mute"
        >
          M
        </button>
        <button
          className={`solo-btn${track.soloed ? " active" : ""}`}
          onClick={onSolo}
          title="Solo"
        >
          S
        </button>
      </div>
      {isDeleteMode && (
        <button
          type="button"
          aria-label={`${track.name} ${
            isSelectedForDelete ? "삭제 선택 해제" : "삭제 선택"
          }`}
          aria-pressed={isSelectedForDelete}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onToggleDeleteSelection}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 8,
            border: isSelectedForDelete
              ? "2px solid #ff453a"
              : "2px solid transparent",
            background: isSelectedForDelete
              ? "rgba(255,69,58,0.13)"
              : "rgba(0,0,0,0.12)",
            cursor: "pointer",
            padding: 0,
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 10,
              right: 9,
              width: 24,
              height: 24,
              borderRadius: "50%",
              border: `2px solid ${
                isSelectedForDelete ? "#ff453a" : "#8e8e93"
              }`,
              background: isSelectedForDelete
                ? "#ff453a"
                : "rgba(20,20,20,0.8)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 8px rgba(0,0,0,0.45)",
            }}
          >
            {isSelectedForDelete && <CheckIcon size={12} />}
          </span>
        </button>
      )}
    </div>
  )
}
