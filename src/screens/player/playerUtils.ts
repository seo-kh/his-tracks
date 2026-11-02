import type { Track } from "../../shared/types"

export const TRACK_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#a855f7",
  "#06b6d4",
  "#f97316",
  "#ec4899",
  "#14b8a6",
  "#84cc16",
]

// ── Helpers ────────────────────────────────────────────────────────────────

export function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

export function createSilentWaveUrl(): string {
  const sampleRate = 8_000
  const sampleCount = sampleRate
  const dataSize = sampleCount * 2
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)
  const writeText = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++)
      view.setUint8(offset + i, value.charCodeAt(i))
  }

  writeText(0, "RIFF")
  view.setUint32(4, 36 + dataSize, true)
  writeText(8, "WAVE")
  writeText(12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeText(36, "data")
  view.setUint32(40, dataSize, true)
  return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }))
}

export function effectiveGain(track: Track, all: Track[]): number {
  const anySoloed = all.some((t) => t.soloed)
  if (anySoloed) return track.soloed && !track.muted ? track.volume : 0
  return track.muted ? 0 : track.volume
}
