import React, { useRef, useState, useEffect } from "react"
import type { Track } from "../../types/track"
import { formatTime } from "../../types/track"
import { LevelMeter } from "./LevelMeter"
import { VerticalWaveform } from "./VerticalWaveform"

export interface ChannelStripProps {
  track: Track
  index: number
  isDragging: boolean
  isDragOver: boolean
  onMute: () => void
  onSolo: () => void
  onVolume: (v: number) => void
  onStripPointerDown: (e: React.PointerEvent, id: string) => void
  analyserNodesRef: React.RefObject<Map<string, AnalyserNode> | null>
}

export function ChannelStrip({
  track,
  index,
  isDragging,
  isDragOver,
  onMute,
  onSolo,
  onVolume,
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
      for (const entry of entries) {
        setFaderHeight(Math.max(60, entry.contentRect.height))
      }
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
        cursor: isDragging ? "grabbing" : "default",
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
    </div>
  )
}

export default ChannelStrip
