import React, { useRef } from "react"
import ReactDOM from "react-dom/client"
import CloudConnectScreen from "../../screens/cloud/CloudConnectScreen"
import {
  persistAudioFiles,
  saveTrackMetadata,
  type StoredTrackMetadata,
} from "../../services/audio/audioStorage"
import type { Playlist } from "../../shared/types"
import "../../styles/index.css"
import { initFromHash } from "../../services/cloud/googleDrive"

const PLAYLIST_STORAGE_KEY = "playlists"
const TRACK_COLORS = [
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

function loadPlaylists(): Playlist[] {
  try {
    const raw = localStorage.getItem(PLAYLIST_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Playlist[]) : []
  } catch {
    return []
  }
}

function resolvePlaylist(): Playlist {
  const playlists = loadPlaylists()
  const requestedId = new URLSearchParams(window.location.search).get("playlistId")
  const requested = playlists.find((playlist) => playlist.id === requestedId)
  if (requested) return requested
  if (playlists[0]) return playlists[0]

  const playlist: Playlist = {
    id: crypto.randomUUID(),
    name: "클라우드 가져오기",
    createdAt: Date.now(),
  }
  localStorage.setItem(PLAYLIST_STORAGE_KEY, JSON.stringify([playlist]))
  return playlist
}

function routeUrl(route: "playlist" | "player", playlistId?: string) {
  const url = new URL(`../${route}/`, window.location.href)
  if (playlistId) url.searchParams.set("playlistId", playlistId)
  return url
}

async function createTrackMetadata(
  files: File[],
  directoryName: string,
): Promise<StoredTrackMetadata[]> {
  const context = new AudioContext()
  try {
    return await Promise.all(
      files.map(async (file, index) => {
        let duration = 0
        try {
          duration = (await context.decodeAudioData(await file.arrayBuffer())).duration
        } catch {
          // The player will skip files that the browser cannot decode.
        }
        return {
          id: crypto.randomUUID(),
          name: file.name.replace(/\.[^/.]+$/, ""),
          fileName: file.name,
          path: `${directoryName || "Google Drive"}/${file.name}`,
          duration,
          muted: false,
          soloed: false,
          volume: 0.85,
          color: TRACK_COLORS[index % TRACK_COLORS.length],
        }
      }),
    )
  } finally {
    await context.close()
  }
}

function CloudEntry() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const playlist = resolvePlaylist()

  return (
    <CloudConnectScreen
      open
      realFileInputRef={fileInputRef}
      onClose={() => window.location.assign(routeUrl("playlist"))}
      onComplete={async (files, directoryHandle, directoryName, shouldPlay) => {
        await persistAudioFiles(playlist.id, files, directoryHandle)
        saveTrackMetadata(
          playlist.id,
          await createTrackMetadata(files, directoryName),
        )
        window.location.assign(
          shouldPlay
            ? routeUrl("player", playlist.id)
            : routeUrl("playlist"),
        )
      }}
    />
  )
}

initFromHash()

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <CloudEntry />
  </React.StrictMode>,
)
