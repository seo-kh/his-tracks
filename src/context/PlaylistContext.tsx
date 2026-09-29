import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from "react"
import type { Playlist, SortOrder } from "../types/playlist"
import type { Track } from "../types/track"
import { generateUUID } from "../utils/uuid"

interface PlaylistContextValue {
  playlists: Playlist[]
  sortOrder: SortOrder
  setSortOrder: (order: SortOrder) => void
  createPlaylist: (name: string) => Playlist
  renamePlaylist: (id: string, name: string) => void
  deletePlaylist: (id: string) => void
  getPlaylist: (id: string) => Playlist | undefined
  getTracks: (playlistId: string) => Track[]
  setTracks: (playlistId: string, tracks: Track[]) => void
}

const PlaylistContext = createContext<PlaylistContextValue | null>(null)

function loadPlaylists(): Playlist[] {
  try {
    const raw = localStorage.getItem("playlists")
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function savePlaylists(pls: Playlist[]) {
  try {
    localStorage.setItem("playlists", JSON.stringify(pls))
  } catch {
    /* quota */
  }
}

export function PlaylistProvider({ children }: { children: React.ReactNode }) {
  const [playlists, setPlaylists] = useState<Playlist[]>(loadPlaylists)
  const [sortOrder, setSortOrder] = useState<SortOrder>("date")
  const tracksMapRef = useRef<Map<string, Track[]>>(new Map())

  useEffect(() => {
    savePlaylists(playlists)
  }, [playlists])

  const createPlaylist = (name: string): Playlist => {
    const newPl: Playlist = { id: generateUUID(), name, createdAt: Date.now() }
    setPlaylists((prev) => [...prev, newPl])
    tracksMapRef.current.set(newPl.id, [])
    return newPl
  }

  const renamePlaylist = (id: string, name: string) => {
    setPlaylists((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)))
  }

  const deletePlaylist = (id: string) => {
    setPlaylists((prev) => prev.filter((p) => p.id !== id))
    tracksMapRef.current.delete(id)
  }

  const getPlaylist = (id: string) => {
    return playlists.find((p) => p.id === id)
  }

  const getTracks = (playlistId: string): Track[] => {
    return tracksMapRef.current.get(playlistId) ?? []
  }

  const setTracks = (playlistId: string, tracks: Track[]) => {
    tracksMapRef.current.set(playlistId, tracks)
  }

  return (
    <PlaylistContext.Provider
      value={{
        playlists,
        sortOrder,
        setSortOrder,
        createPlaylist,
        renamePlaylist,
        deletePlaylist,
        getPlaylist,
        getTracks,
        setTracks,
      }}
    >
      {children}
    </PlaylistContext.Provider>
  )
}

export function usePlaylist() {
  const ctx = useContext(PlaylistContext)
  if (!ctx) {
    throw new Error("usePlaylist must be used within a PlaylistProvider")
  }
  return ctx
}

export default PlaylistContext
