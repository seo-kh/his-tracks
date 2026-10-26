import { useCallback, useEffect, useRef, useState } from "react"
import type * as React from "react"
import {
  deletePlaylistAudio,
  deletePlaylistAudioFiles,
  loadPlaylistAudio,
  persistAudioFiles,
  saveTrackMetadata,
} from "../../../services/audio/audioStorage"
import CloudConnectScreen from "../../cloud/CloudConnectScreen"
import AddFileSheet from "../../cloud/components/AddFileSheet"
import type { Playlist, Track } from "../../../shared/types"
import { AUDIO_FILE_ACCEPT } from "../../../shared/audioFormats"
import ChannelStrip from "./ChannelStrip"
import { BackIcon, FolderIcon, MusicIcon, PauseIcon, PlayIcon, StopIcon, TrashIcon } from "./PlayerIcons"
import { TRACK_COLORS, createSilentWaveUrl, effectiveGain, formatTime } from "../playerUtils"

// ── Player Screen ──────────────────────────────────────────────────────────

interface PlayerScreenProps {
  playlist: Playlist
  initialTracks: Track[]
  onBack: (tracks: Track[]) => void
}

export default function PlayerWorkspace({
  playlist,
  initialTracks,
  onBack,
}: PlayerScreenProps) {
  const [tracks, setTracks] = useState<Track[]>(initialTracks)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [isSeeking, setIsSeeking] = useState(false)
  const [seekValue, setSeekValue] = useState(0)
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [showCloudModal, setShowCloudModal] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  const [isDeleteMode, setIsDeleteMode] = useState(false)
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(
    new Set(),
  )
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dragStartRef = useRef<{
    x: number
    y: number
    moved: boolean
  }>({
    x: 0,
    y: 0,
    moved: false,
  })
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const silentAudioRef = useRef<HTMLAudioElement | null>(null)
  const silentAudioUrlRef = useRef<string | null>(null)
  const gainNodesRef = useRef<Map<string, GainNode>>(new Map())
  const analyserNodesRef = useRef<Map<string, AnalyserNode>>(new Map())
  const sourceNodesRef = useRef<Map<string, AudioBufferSourceNode>>(new Map())
  const startTimeRef = useRef<number>(0)
  const pauseOffsetRef = useRef<number>(0)
  const animFrameRef = useRef<number>(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const tracksRef = useRef<Track[]>([])
  const isPlayingRef = useRef(false)
  const draggingIdRef = useRef<string | null>(null)
  const storageReadyRef = useRef(initialTracks.length > 0)

  tracksRef.current = tracks
  isPlayingRef.current = isPlaying
  draggingIdRef.current = draggingId

  const maxDuration = tracks.reduce((max, t) => Math.max(max, t.duration), 0)

  const getAudioCtx = () => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext()
    return audioCtxRef.current
  }

  const activatePlaybackAudioSession = useCallback(() => {
    const mediaNavigator = navigator as Navigator & {
      audioSession?: { type: string }
    }
    try {
      if (mediaNavigator.audioSession)
        mediaNavigator.audioSession.type = "playback"
    } catch {
      // Older Safari versions use the media-element fallback below.
    }

    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    if (isIOS) {
      if (!silentAudioRef.current) {
        const audio = new Audio()
        const url = createSilentWaveUrl()
        audio.src = url
        audio.loop = true
        audio.preload = "auto"
        audio.volume = 1
        audio.setAttribute("playsinline", "")
        silentAudioRef.current = audio
        silentAudioUrlRef.current = url
      }
      void silentAudioRef.current.play().catch(() => undefined)
    }

    const ctx = getAudioCtx()
    if (ctx.state !== "running") void ctx.resume().catch(() => undefined)
    return ctx
  }, [])

  const pausePlaybackAudioSession = useCallback(() => {
    silentAudioRef.current?.pause()
  }, [])

  useEffect(() => {
    return () => {
      silentAudioRef.current?.pause()
      if (silentAudioUrlRef.current)
        URL.revokeObjectURL(silentAudioUrlRef.current)
      const mediaNavigator = navigator as Navigator & {
        audioSession?: { type: string }
      }
      try {
        if (mediaNavigator.audioSession)
          mediaNavigator.audioSession.type = "auto"
      } catch {
        // The Audio Session API is optional.
      }
      void audioCtxRef.current?.close()
    }
  }, [])

  const decodeFiles = useCallback(
    async (
      files: File[],
      directoryName: string,
      storedTracks?: Awaited<ReturnType<typeof loadPlaylistAudio>>,
    ) => {
      const ctx = audioCtxRef.current ?? new AudioContext()
      audioCtxRef.current = ctx
      const decoded: Track[] = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        try {
          const buffer = await ctx.decodeAudioData(await file.arrayBuffer())
          const stored = storedTracks?.[i]?.metadata
          decoded.push({
            id: stored?.id ?? crypto.randomUUID(),
            name: stored?.name ?? file.name.replace(/\.[^/.]+$/, ""),
            fileName: file.name,
            path: stored?.path ?? `${directoryName}/${file.name}`,
            buffer,
            duration: buffer.duration,
            muted: stored?.muted ?? false,
            soloed: stored?.soloed ?? false,
            volume: stored?.volume ?? 0.85,
            color:
              stored?.color ??
              TRACK_COLORS[
                (tracksRef.current.length + i) % TRACK_COLORS.length
              ],
          })
        } catch {
          console.warn("Could not decode:", file.name)
        }
      }
      return decoded
    },
    [],
  )

  useEffect(() => {
    if (initialTracks.length > 0) return
    let cancelled = false
    setIsLoading(true)
    loadPlaylistAudio(playlist.id)
      .then(async (stored) => {
        const decoded = await decodeFiles(
          stored.map((item) => item.file),
          "",
          stored,
        )
        if (!cancelled) {
          storageReadyRef.current = true
          setTracks(decoded)
        }
      })
      .finally(() => {
        storageReadyRef.current = true
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [decodeFiles, initialTracks.length, playlist.id])

  useEffect(() => {
    if (!storageReadyRef.current) return
    saveTrackMetadata(
      playlist.id,
      tracks.map(({ buffer: _buffer, ...track }) => track),
    )
  }, [playlist.id, tracks])

  const stopAllSources = useCallback(() => {
    sourceNodesRef.current.forEach((node) => {
      try {
        node.stop()
      } catch {
        /* already stopped */
      }
    })
    sourceNodesRef.current.clear()
    analyserNodesRef.current.clear()
    cancelAnimationFrame(animFrameRef.current)
  }, [])

  const startPlayback = useCallback(
    (offset: number, currentTracks: Track[]) => {
      const ctx = activatePlaybackAudioSession()
      stopAllSources()
      gainNodesRef.current.clear()
      analyserNodesRef.current.clear()
      const startAt = ctx.currentTime
      startTimeRef.current = startAt - offset
      currentTracks.forEach((track) => {
        const gain = ctx.createGain()
        gain.gain.value = effectiveGain(track, currentTracks)
        gainNodesRef.current.set(track.id, gain)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 256
        analyser.smoothingTimeConstant = 0.8
        gain.connect(analyser)
        analyser.connect(ctx.destination)
        analyserNodesRef.current.set(track.id, analyser)
        const src = ctx.createBufferSource()
        src.buffer = track.buffer
        src.connect(gain)
        src.start(startAt, offset)
        sourceNodesRef.current.set(track.id, src)
      })
      const tick = () => {
        const ctx2 = audioCtxRef.current
        if (!ctx2) return
        const elapsed = ctx2.currentTime - startTimeRef.current
        const maxDur = tracksRef.current.reduce(
          (m, t) => Math.max(m, t.duration),
          0,
        )
        if (elapsed >= maxDur && maxDur > 0) {
          setCurrentTime(maxDur)
          setSeekValue(maxDur)
          setIsPlaying(false)
          pauseOffsetRef.current = 0
          pausePlaybackAudioSession()
          return
        }
        setCurrentTime(elapsed)
        animFrameRef.current = requestAnimationFrame(tick)
      }
      animFrameRef.current = requestAnimationFrame(tick)
    },
    [activatePlaybackAudioSession, pausePlaybackAudioSession, stopAllSources],
  )

  useEffect(() => {
    if (!isPlaying) return
    tracks.forEach((track) => {
      const gain = gainNodesRef.current.get(track.id)
      if (gain) gain.gain.value = effectiveGain(track, tracks)
    })
  }, [tracks, isPlaying])

  useEffect(() => {
    if (!isSeeking) setSeekValue(currentTime)
  }, [currentTime, isSeeking])

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  const handleStripPointerDown = useCallback(
    (e: React.PointerEvent, id: string) => {
      dragStartRef.current = { x: e.clientX, y: e.clientY, moved: false }
      longPressTimerRef.current = setTimeout(() => {
        if (!dragStartRef.current.moved) {
          setDraggingId(id)
          if (navigator.vibrate) navigator.vibrate(40)
        }
      }, 420)
    },
    [],
  )

  const handleContainerPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const dx = Math.abs(e.clientX - dragStartRef.current.x)
      const dy = Math.abs(e.clientY - dragStartRef.current.y)
      if ((dx > 8 || dy > 8) && !dragStartRef.current.moved) {
        dragStartRef.current.moved = true
        if (!draggingIdRef.current) {
          cancelLongPress()
          return
        }
      }
      if (!draggingIdRef.current) return
      e.preventDefault()
      const container = scrollContainerRef.current
      if (!container) return
      const children = Array.from(container.children) as HTMLElement[]
      for (let i = 0; i < children.length; i++) {
        const rect = children[i].getBoundingClientRect()
        if (e.clientX >= rect.left && e.clientX <= rect.right) {
          setDragOverIdx(i)
          return
        }
      }
    },
    [cancelLongPress],
  )

  const handleContainerPointerUp = useCallback(() => {
    cancelLongPress()
    const currentDraggingId = draggingIdRef.current
    if (currentDraggingId !== null) {
      setDragOverIdx((overIdx) => {
        if (overIdx !== null) {
          setTracks((prev) => {
            const fromIdx = prev.findIndex((t) => t.id === currentDraggingId)
            if (fromIdx === -1 || fromIdx === overIdx) return prev
            const next = [...prev]
            const [removed] = next.splice(fromIdx, 1)
            next.splice(overIdx, 0, removed)
            return next
          })
        }
        return null
      })
      setDraggingId(null)
    }
  }, [cancelLongPress])

  const handlePlayPause = () => {
    if (tracks.length === 0) return
    if (isPlaying) {
      const ctx = audioCtxRef.current
      if (ctx) pauseOffsetRef.current = ctx.currentTime - startTimeRef.current
      stopAllSources()
      pausePlaybackAudioSession()
      setIsPlaying(false)
    } else {
      startPlayback(pauseOffsetRef.current, tracks)
      setIsPlaying(true)
    }
  }

  const handleStop = () => {
    stopAllSources()
    pausePlaybackAudioSession()
    setIsPlaying(false)
    pauseOffsetRef.current = 0
    setCurrentTime(0)
    setSeekValue(0)
  }

  const handleSeekMouseDown = () => {
    setIsSeeking(true)
    if (isPlaying) stopAllSources()
  }
  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    setSeekValue(val)
    setCurrentTime(val)
  }
  const handleSeekMouseUp = () => {
    setIsSeeking(false)
    pauseOffsetRef.current = seekValue
    if (isPlayingRef.current) startPlayback(seekValue, tracksRef.current)
  }

  const handleFileLoad = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const existingNames = new Set(tracks.map((t) => t.name))
    const newFiles = files.filter(
      (f) => !existingNames.has(f.name.replace(/\.[^/.]+$/, "")),
    )
    if (!newFiles.length) {
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }
    setIsLoading(true)
    const ctx = getAudioCtx()
    const newTracks: Track[] = []
    const colorOffset = tracks.length
    for (let i = 0; i < newFiles.length; i++) {
      const file = newFiles[i]
      try {
        const ab = await file.arrayBuffer()
        const buf = await ctx.decodeAudioData(ab)
        newTracks.push({
          id: crypto.randomUUID(),
          name: file.name.replace(/\.[^/.]+$/, ""),
          fileName: file.name,
          path: `기기 파일/${file.name}`,
          buffer: buf,
          duration: buf.duration,
          muted: false,
          soloed: false,
          volume: 0.85,
          color: TRACK_COLORS[(colorOffset + i) % TRACK_COLORS.length],
        })
      } catch {
        console.warn("Could not decode:", file.name)
      }
    }
    setTracks((prev) => [...prev, ...newTracks])
    await persistAudioFiles(playlist.id, newFiles, null)
    setIsLoading(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const enterDeleteMode = () => {
    if (tracks.length === 0) return
    setDraggingId(null)
    setDragOverIdx(null)
    setSelectedTrackIds(new Set())
    setIsDeleteMode(true)
  }

  // Keep an older Fast Refresh render from calling the removed immediate-delete action.
  const handleDeleteAll = enterDeleteMode

  const exitDeleteMode = () => {
    setIsDeleteMode(false)
    setSelectedTrackIds(new Set())
    setShowDeleteConfirm(false)
  }

  const toggleDeleteSelection = (id: string) => {
    setSelectedTrackIds((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAllTracks = () => {
    setSelectedTrackIds((previous) =>
      previous.size === tracks.length
        ? new Set()
        : new Set(tracks.map((track) => track.id)),
    )
  }

  const handleDeleteSelectedTracks = () => {
    if (selectedTrackIds.size === 0) return
    const removedTracks = tracks.filter((track) =>
      selectedTrackIds.has(track.id),
    )
    const removesAllTracks = removedTracks.length === tracks.length

    stopAllSources()
    pausePlaybackAudioSession()
    setIsPlaying(false)
    pauseOffsetRef.current = 0
    setCurrentTime(0)
    setSeekValue(0)
    gainNodesRef.current.clear()
    setTracks((previous) =>
      previous.filter((track) => !selectedTrackIds.has(track.id)),
    )

    if (removesAllTracks) void deletePlaylistAudio(playlist.id)
    else
      void deletePlaylistAudioFiles(
        playlist.id,
        removedTracks.map((track) => track.fileName),
      )
    exitDeleteMode()
  }

  const updateTrack = (id: string, patch: Partial<Track>) => {
    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  }

  const handleVolume = (id: string, vol: number) => {
    setTracks((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, volume: vol } : t))
      const track = next.find((t) => t.id === id)
      if (track) {
        const gain = gainNodesRef.current.get(id)
        if (gain) gain.gain.value = effectiveGain(track, next)
      }
      return next
    })
  }

  const anyMuted = tracks.some((t) => t.muted)
  const anySoloed = tracks.some((t) => t.soloed)
  const handleGlobalMute = () => {
    if (anyMuted) setTracks((prev) => prev.map((t) => ({ ...t, muted: false })))
    else setTracks((prev) => prev.map((t) => ({ ...t, muted: true })))
  }
  const handleGlobalSolo = () => {
    if (anySoloed)
      setTracks((prev) => prev.map((t) => ({ ...t, soloed: false })))
    else setTracks((prev) => prev.map((t) => ({ ...t, soloed: true })))
  }

  const seekPct = maxDuration > 0 ? (seekValue / maxDuration) * 100 : 0
  const allTracksSelected =
    tracks.length > 0 && selectedTrackIds.size === tracks.length

  const handleBack = () => {
    stopAllSources()
    pausePlaybackAudioSession()
    setIsPlaying(false)
    onBack(tracks)
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        background: "#141414",
      }}
    >
      {/* Transport Bar */}
      <div
        className="app-safe-inline"
        style={{
          flexShrink: 0,
          background: "linear-gradient(180deg, #252525 0%, #1e1e1e 100%)",
          borderBottom: "1px solid #333",
          padding: "10px 12px 12px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          boxShadow: "0 2px 12px rgba(0,0,0,0.5)",
        }}
      >
        {/* Row 1: back · name | play stop | time | M S | spacer | tracks | folder trash */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            minWidth: 0,
          }}
        >
          <button
            className="icon-btn"
            onClick={handleBack}
            title="재생 목록으로"
            style={{
              width: 34,
              height: 34,
              flexShrink: 0,
              color: "#007AFF",
              borderColor: "#007AFF22",
              background: "transparent",
            }}
          >
            <BackIcon />
          </button>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "#555",
              letterSpacing: "0.05em",
              maxWidth: "clamp(48px, 12vw, 100px)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flexShrink: 1,
            }}
          >
            {playlist.name}
          </span>
          <div
            style={{
              width: 1,
              height: 18,
              background: "#383838",
              flexShrink: 0,
            }}
          />

          <button
            className={`transport-btn${isPlaying ? " active-play" : ""}`}
            onClick={handlePlayPause}
            title={isPlaying ? "Pause" : "Play"}
            style={{ width: 40, height: 34, flexShrink: 0 }}
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button
            className="transport-btn"
            onClick={handleStop}
            title="Stop"
            style={{ width: 36, height: 34, flexShrink: 0 }}
          >
            <StopIcon />
          </button>

          <div
            style={{
              width: 1,
              height: 18,
              background: "#383838",
              flexShrink: 0,
              margin: "0 2px",
            }}
          />

          <div
            className="transport-time"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 14,
              fontWeight: 500,
              background: "#111",
              border: "1px solid #333",
              borderRadius: 6,
              padding: "4px 8px",
              letterSpacing: "0.04em",
              minWidth: 100,
              textAlign: "center",
              flexShrink: 0,
            }}
          >
            <span style={{ color: "#007AFF" }}>{formatTime(currentTime)}</span>
            <span style={{ color: "#444", margin: "0 3px" }}>/</span>
            <span style={{ color: "#666" }}>{formatTime(maxDuration)}</span>
          </div>

          <button
            className={`transport-btn${anyMuted ? " active-mute" : ""}`}
            onClick={handleGlobalMute}
            title="전체 뮤트"
            style={{
              width: 34,
              height: 34,
              flexShrink: 0,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            M
          </button>
          <button
            className={`transport-btn${anySoloed ? " active-solo" : ""}`}
            onClick={handleGlobalSolo}
            title="전체 솔로"
            style={{
              width: 34,
              height: 34,
              flexShrink: 0,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            S
          </button>

          <div style={{ flex: 1, minWidth: 0 }} />

          {tracks.length > 0 && (
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                color: "#555",
                background: "#1a1a1a",
                border: "1px solid #2a2a2a",
                borderRadius: 4,
                padding: "2px 6px",
                letterSpacing: "0.08em",
                flexShrink: 0,
                whiteSpace: "nowrap",
              }}
            >
              {tracks.length}T
            </div>
          )}
          <div
            style={{
              width: 1,
              height: 18,
              background: "#383838",
              flexShrink: 0,
              margin: "0 2px",
            }}
          />
          <button
            className="icon-btn"
            onClick={() => setShowAddSheet(true)}
            title="오디오 파일 불러오기"
            style={{ width: 36, height: 34, flexShrink: 0 }}
          >
            <FolderIcon />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={AUDIO_FILE_ACCEPT}
            multiple
            style={{ display: "none" }}
            onChange={handleFileLoad}
          />
          <button
            className="icon-btn"
            onClick={enterDeleteMode}
            title="삭제할 트랙 선택"
            aria-pressed={isDeleteMode}
            style={{
              width: 36,
              height: 34,
              flexShrink: 0,
              color: tracks.length ? "#ff453a" : undefined,
              borderColor: isDeleteMode ? "#ff453a" : undefined,
              background: isDeleteMode ? "rgba(255,69,58,0.14)" : undefined,
            }}
          >
            <TrashIcon />
          </button>
        </div>

        {/* Row 2: seek slider */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "#444",
              minWidth: 28,
            }}
          >
            {formatTime(0)}
          </span>
          <input
            type="range"
            className="seek-slider"
            style={
              { flex: 1, "--progress": `${seekPct}%` } as React.CSSProperties
            }
            min={0}
            max={maxDuration || 100}
            step={0.01}
            value={seekValue}
            onMouseDown={handleSeekMouseDown}
            onTouchStart={handleSeekMouseDown}
            onChange={handleSeekChange}
            onMouseUp={handleSeekMouseUp}
            onTouchEnd={handleSeekMouseUp}
          />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "#444",
              minWidth: 28,
              textAlign: "right",
            }}
          >
            {formatTime(maxDuration)}
          </span>
        </div>
      </div>

      {isDeleteMode && (
        <div
          style={{
            minHeight: 52,
            flexShrink: 0,
            padding: "8px 12px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#201819",
            borderBottom: "1px solid #4a2524",
            boxShadow: "0 3px 12px rgba(0,0,0,0.35)",
            zIndex: 12,
          }}
        >
          <div style={{ minWidth: 0, marginRight: "auto" }}>
            <div style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>
              삭제할 트랙을 선택하세요
            </div>
            <div
              style={{
                color: "#a86d69",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                marginTop: 2,
              }}
            >
              {selectedTrackIds.size}개 선택됨
            </div>
          </div>
          <button
            type="button"
            onClick={toggleSelectAllTracks}
            style={{
              height: 34,
              padding: "0 12px",
              borderRadius: 7,
              border: "1px solid #48484a",
              background: "#2c2c2e",
              color: "#fff",
              fontSize: 12,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {allTracksSelected ? "전체 해제" : "전체 선택"}
          </button>
          <button
            type="button"
            onClick={exitDeleteMode}
            style={{
              height: 34,
              padding: "0 12px",
              borderRadius: 7,
              border: "1px solid #48484a",
              background: "#2c2c2e",
              color: "#d1d1d6",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            취소
          </button>
          <button
            type="button"
            disabled={selectedTrackIds.size === 0}
            onClick={() => setShowDeleteConfirm(true)}
            style={{
              height: 34,
              padding: "0 14px",
              borderRadius: 7,
              border: "none",
              background: selectedTrackIds.size > 0 ? "#ff453a" : "#3a2424",
              color: selectedTrackIds.size > 0 ? "#fff" : "#76504e",
              fontSize: 12,
              fontWeight: 700,
              cursor: selectedTrackIds.size > 0 ? "pointer" : "default",
              whiteSpace: "nowrap",
            }}
          >
            최종 삭제
          </button>
        </div>
      )}

      {/* Track area */}
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        {tracks.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              gap: "12px",
            }}
          >
            <MusicIcon />
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: "0.1em",
                color: "#333",
                margin: 0,
              }}
            >
              폴더 버튼을 눌러 오디오 파일을 불러오세요
            </p>
          </div>
        ) : (
          <div
            ref={scrollContainerRef}
            className="tracks-hscroll"
            onPointerMove={handleContainerPointerMove}
            onPointerUp={handleContainerPointerUp}
            onPointerLeave={handleContainerPointerUp}
            style={{
              touchAction: draggingId ? "none" : "pan-x",
              paddingLeft: "env(safe-area-inset-left, 0px)",
              paddingRight: "env(safe-area-inset-right, 0px)",
            }}
          >
            {tracks.map((track, idx) => (
              <ChannelStrip
                key={track.id}
                track={track}
                index={idx}
                isDragging={draggingId === track.id}
                isDragOver={dragOverIdx === idx && draggingId !== track.id}
                isDeleteMode={isDeleteMode}
                isSelectedForDelete={selectedTrackIds.has(track.id)}
                analyserNodesRef={analyserNodesRef}
                onMute={() => updateTrack(track.id, { muted: !track.muted })}
                onSolo={() => updateTrack(track.id, { soloed: !track.soloed })}
                onVolume={(v) => handleVolume(track.id, v)}
                onToggleDeleteSelection={() => toggleDeleteSelection(track.id)}
                onStripPointerDown={handleStripPointerDown}
              />
            ))}
          </div>
        )}
        {isLoading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(20,20,20,0.82)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 14,
              backdropFilter: "blur(4px)",
              zIndex: 10,
            }}
          >
            <svg
              width="44"
              height="44"
              viewBox="0 0 44 44"
              style={{ animation: "spin 0.9s linear infinite" }}
            >
              <circle
                cx="22"
                cy="22"
                r="18"
                fill="none"
                stroke="#2a2a2a"
                strokeWidth="3.5"
              />
              <circle
                cx="22"
                cy="22"
                r="18"
                fill="none"
                stroke="#007AFF"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray="28 85"
                strokeDashoffset="0"
              />
            </svg>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "#777",
                letterSpacing: "0.08em",
              }}
            >
              불러오는 중..
            </span>
          </div>
        )}
        {draggingId && (
          <div
            style={{
              position: "absolute",
              bottom: 12,
              left: "50%",
              transform: "translateX(-50%)",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "#888",
              background: "rgba(0,0,0,0.7)",
              borderRadius: 6,
              padding: "4px 12px",
              pointerEvents: "none",
              letterSpacing: "0.06em",
            }}
          >
            드래그하여 순서 변경
          </div>
        )}
      </div>

      {showDeleteConfirm && (
        <>
          <div
            onClick={() => setShowDeleteConfirm(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 350,
              background: "rgba(0,0,0,0.68)",
              backdropFilter: "blur(5px)",
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="track-delete-title"
            style={{
              position: "fixed",
              left: "50%",
              top: "50%",
              zIndex: 351,
              width: "min(360px, calc(100vw - 40px))",
              transform: "translate(-50%, -50%)",
              overflow: "hidden",
              borderRadius: 15,
              background: "#2c2c2e",
              border: "1px solid #48484a",
              boxShadow: "0 22px 70px rgba(0,0,0,0.75)",
            }}
          >
            <div style={{ padding: "22px 20px 18px", textAlign: "center" }}>
              <div
                id="track-delete-title"
                style={{ color: "#fff", fontSize: 17, fontWeight: 700 }}
              >
                트랙 삭제
              </div>
              <div
                style={{
                  color: "#b0b0b5",
                  fontSize: 13,
                  lineHeight: 1.6,
                  marginTop: 9,
                }}
              >
                선택한 {selectedTrackIds.size}개의 트랙을 삭제하시겠습니까?
                <br />
                삭제한 트랙은 이 재생 목록에서 제거됩니다.
              </div>
            </div>
            <div style={{ display: "flex", borderTop: "1px solid #48484a" }}>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  flex: 1,
                  padding: "14px",
                  border: "none",
                  borderRight: "1px solid #48484a",
                  background: "transparent",
                  color: "#fff",
                  fontSize: 15,
                  cursor: "pointer",
                }}
              >
                아니요
              </button>
              <button
                type="button"
                onClick={handleDeleteSelectedTracks}
                style={{
                  flex: 1,
                  padding: "14px",
                  border: "none",
                  background: "transparent",
                  color: "#ff453a",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                삭제
              </button>
            </div>
          </div>
        </>
      )}

      <AddFileSheet
        open={showAddSheet}
        onClose={() => setShowAddSheet(false)}
        onPickFiles={() => fileInputRef.current?.click()}
        onConnect={() => setShowCloudModal(true)}
      />
      <CloudConnectScreen
        open={showCloudModal}
        onClose={() => setShowCloudModal(false)}
        realFileInputRef={fileInputRef}
        onComplete={async (
          files,
          directoryHandle,
          directoryName,
          shouldPlay,
        ) => {
          if (!files.length) return
          await persistAudioFiles(playlist.id, files, directoryHandle)
          const existingNames = new Set(tracks.map((t) => t.name))
          const newFiles = files.filter(
            (f) => !existingNames.has(f.name.replace(/\.[^/.]+$/, "")),
          )
          const newTracks = await decodeFiles(newFiles, directoryName)
          const nextTracks = [...tracks, ...newTracks]
          saveTrackMetadata(
            playlist.id,
            nextTracks.map(({ buffer: _buffer, ...track }) => track),
          )
          if (!shouldPlay) {
            stopAllSources()
            onBack(nextTracks)
            return
          }
          if (!newTracks.length) return
          setIsLoading(true)
          setTracks((prev) => [...prev, ...newTracks])
          setIsLoading(false)
        }}
      />
    </div>
  )
}
