export interface Playlist {
  id: string
  name: string
  createdAt: number
}

export type SortOrder = "name" | "date"

export interface Track {
  id: string
  name: string
  fileName: string
  path: string
  buffer: AudioBuffer
  duration: number
  muted: boolean
  soloed: boolean
  volume: number
  color: string
}
