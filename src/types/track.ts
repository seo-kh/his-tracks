export interface Track {
  id: string
  name: string
  buffer: AudioBuffer
  duration: number
  muted: boolean
  soloed: boolean
  volume: number
  color: string
}

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

export function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

export function effectiveGain(track: Track, all: Track[]): number {
  const anySoloed = all.some((t) => t.soloed)
  if (anySoloed) return track.soloed && !track.muted ? track.volume : 0
  return track.muted ? 0 : track.volume
}
