import { useEffect, useRef, useState } from "react"
import { deletePlaylistAudio } from "../services/audio/audioStorage"
import { initFromHash } from "../services/cloud/googleDrive"
import PlayerScreen from "../screens/player/PlayerScreen"
import PlaylistScreen from "../screens/playlist/PlaylistScreen"
import type { Playlist, SortOrder, Track } from "../shared/types"

const PLAYLIST_STORAGE_KEY = "playlists"

// ── Root App ───────────────────────────────────────────────────────────────

function loadPlaylists(): Playlist[] {
  try {
    const raw = localStorage.getItem(PLAYLIST_STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function savePlaylists(pls: Playlist[]) {
  try {
    localStorage.setItem(PLAYLIST_STORAGE_KEY, JSON.stringify(pls))
  } catch {
    /* quota */
  }
}

interface AppProps {
  initialPlaylistId?: string | null
}

export default function App({ initialPlaylistId = null }: AppProps) {
  const [playlists, setPlaylists] = useState<Playlist[]>(loadPlaylists)
  const [sortOrder, setSortOrder] = useState<SortOrder>("date")
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(
    initialPlaylistId,
  )
  const tracksMapRef = useRef<Map<string, Track[]>>(new Map())

  // On first mount: read token from URL hash placed by the Express OAuth callback.
  // This is a no-op in local dev (hash is empty) and when no server is running.
  useEffect(() => {
    initFromHash()
  }, [])

  useEffect(() => {
    const preventGesture = (event: Event) => event.preventDefault()
    const preventZoomKeys = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        ["+", "=", "-", "0"].includes(event.key)
      )
        event.preventDefault()
    }
    const preventZoomWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) event.preventDefault()
    }
    const lockLandscape = () => {
      const orientation = screen.orientation as ScreenOrientation & {
        lock?: (orientation: string) => Promise<void>
      }
      void orientation?.lock?.("landscape").catch(() => undefined)
    }
    lockLandscape()
    document.addEventListener("gesturestart", preventGesture, {
      passive: false,
    })
    document.addEventListener("gesturechange", preventGesture, {
      passive: false,
    })
    document.addEventListener("gestureend", preventGesture, { passive: false })
    document.addEventListener("keydown", preventZoomKeys)
    document.addEventListener("wheel", preventZoomWheel, { passive: false })
    document.addEventListener("pointerdown", lockLandscape, { once: true })
    return () => {
      document.removeEventListener("gesturestart", preventGesture)
      document.removeEventListener("gesturechange", preventGesture)
      document.removeEventListener("gestureend", preventGesture)
      document.removeEventListener("keydown", preventZoomKeys)
      document.removeEventListener("wheel", preventZoomWheel)
      document.removeEventListener("pointerdown", lockLandscape)
    }
  }, [])

  useEffect(() => {
    savePlaylists(playlists)
  }, [playlists])

  const handleCreate = (name: string) => {
    const newPl: Playlist = {
      id: crypto.randomUUID(),
      name,
      createdAt: Date.now(),
    }
    setPlaylists((prev) => [...prev, newPl])
    tracksMapRef.current.set(newPl.id, [])
    setActivePlaylistId(newPl.id)
  }

  const handleOpen = (id: string) => {
    if (!tracksMapRef.current.has(id)) tracksMapRef.current.set(id, [])
    setActivePlaylistId(id)
  }

  const handleBack = (tracks: Track[]) => {
    if (activePlaylistId) tracksMapRef.current.set(activePlaylistId, tracks)
    setActivePlaylistId(null)
  }

  const handleRename = (id: string, name: string) => {
    setPlaylists((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)))
  }

  const handleDelete = (id: string) => {
    setPlaylists((prev) => prev.filter((p) => p.id !== id))
    tracksMapRef.current.delete(id)
    if (activePlaylistId === id) setActivePlaylistId(null)
    void deletePlaylistAudio(id)
  }

  const landscapeGuard = (
    <div className="landscape-guard" role="status">
      <svg
        width="54"
        height="54"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="6" y="2" width="12" height="20" rx="2" />
        <path d="M3 9a9 9 0 0 0 9 9" />
        <polyline points="3 4 3 9 8 9" />
      </svg>
      <strong>기기를 가로로 회전해 주세요</strong>
      <span>His Tracks는 가로 화면에서만 사용할 수 있습니다.</span>
    </div>
  )

  if (activePlaylistId) {
    const pl = playlists.find((p) => p.id === activePlaylistId)
    if (!pl) {
      setActivePlaylistId(null)
      return null
    }
    return (
      <>
        <PlayerScreen
          playlist={pl}
          initialTracks={tracksMapRef.current.get(activePlaylistId) ?? []}
          onBack={handleBack}
        />
        {landscapeGuard}
      </>
    )
  }

  return (
    <>
      <PlaylistScreen
        playlists={playlists}
        sortOrder={sortOrder}
        onOpen={handleOpen}
        onCreate={handleCreate}
        onRename={handleRename}
        onDelete={handleDelete}
        onSort={setSortOrder}
      />
      {landscapeGuard}
    </>
  )
}
