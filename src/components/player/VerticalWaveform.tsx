import React from "react"

export function VerticalWaveform({
  color,
  muted,
}: {
  color: string
  muted: boolean
}) {
  const bars = [0.35, 0.6, 0.8, 0.5, 0.9, 0.7, 1, 0.6, 0.75, 0.45, 0.85, 0.55]
  return (
    <div
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

export default VerticalWaveform
