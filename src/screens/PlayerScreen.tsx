import React, { useState, useRef, useEffect, useCallback } from "react"
import { useParams, useNavigate, useLocation } from "react-router-dom"
import { usePlaylist } from "../context/PlaylistContext"
import type { Track } from "../types/track"
import { TRACK_COLORS, formatTime, effectiveGain } from "../types/track"
import { generateUUID } from "../utils/uuid"
import { ChannelStrip } from "../components/player/ChannelStrip"
import { AddFileSheet } from "../components/modals/AddFileSheet"
import { CloudConnectModal } from "../components/modals/CloudConnectModal"
import {
  PlayIcon,
  PauseIcon,
  StopIcon,
  FolderIcon,
  TrashIcon,
  MusicIcon,
  BackIcon,
} from "../components/common/Icons"

export function PlayerScreen() {
  const { playlistId } = useParams<{ playlistId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { getPlaylist, getTracks, setTracks: persistTracks } = usePlaylist()

  const playlist = playlistId ? getPlaylist(playlistId) : undefined
  const isConnectModalOpen = location.pathname.endsWith("/connect")

  const [tracks, setTracks] = useState<Track[]>(() => {
    return playlistId ? getTracks(playlistId) : []
  })
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [isSeeking, setIsSeeking] = useState(false)
  const [seekValue, setSeekValue] = useState(0)
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dragStartRef = useRef<{ x: number, y: number, moved: boolean }>({
    x: 0,
    y: 0,
    moved: false,
  })
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
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

  tracksRef.current = tracks
  isPlayingRef.current = isPlaying
  draggingIdRef.current = draggingId

  // Sync tracks to PlaylistContext whenever tracks change
  useEffect(() => {
    if (playlistId) {
      persistTracks(playlistId, tracks)
    }
  }, [playlistId, tracks, persistTracks])

  const maxDuration = tracks.reduce((max, t) => Math.max(max, t.duration), 0)

  const getAudioCtx = () => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext()
    return audioCtxRef.current
  }

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
      const ctx = getAudioCtx()
      if (ctx.state === "suspended") ctx.resume()
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
          return
        }
        setCurrentTime(elapsed)
        animFrameRef.current = requestAnimationFrame(tick)
      }
      animFrameRef.current = requestAnimationFrame(tick)
    },
    [stopAllSources],
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

  // Clean up audio sources on unmount
  useEffect(() => {
    return () => {
      stopAllSources()
    }
  }, [stopAllSources])

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
      setIsPlaying(false)
    } else {
      startPlayback(pauseOffsetRef.current, tracks)
      setIsPlaying(true)
    }
  }

  const handleStop = () => {
    stopAllSources()
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
          id: generateUUID(),
          name: file.name.replace(/\.[^/.]+$/, ""),
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
    setIsLoading(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleDeleteAll = () => {
    if (!window.confirm("정말 삭제하시겠습니까?")) return
    stopAllSources()
    setIsPlaying(false)
    pauseOffsetRef.current = 0
    setCurrentTime(0)
    setSeekValue(0)
    gainNodesRef.current.clear()
    setTracks([])
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

  const handleBack = () => {
    stopAllSources()
    setIsPlaying(false)
    navigate("/")
  }

  const handleOpenConnect = () => {
    if (playlistId) {
      navigate(`/player/${playlistId}/connect`)
    }
  }

  const handleCloseConnect = () => {
    if (playlistId) {
      navigate(`/player/${playlistId}`, { replace: true })
    }
  }

  if (!playlist) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100dvh",
          background: "#141414",
          color: "#888",
          gap: 16,
        }}
      >
        <p>재생 목록을 찾을 수 없습니다.</p>
        <button
          onClick={() => navigate("/")}
          style={{
            background: "#007AFF",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "8px 16px",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          목록으로 돌아가기
        </button>
      </div>
    )
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
            multiple
            style={{ display: "none" }}
            onChange={handleFileLoad}
          />
          <button
            className="icon-btn"
            onClick={handleDeleteAll}
            title="모든 트랙 삭제"
            style={{
              width: 36,
              height: 34,
              flexShrink: 0,
              color: tracks.length ? "#c0392b" : undefined,
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
            style={{ touchAction: draggingId ? "none" : "pan-x" }}
          >
            {tracks.map((track, idx) => (
              <ChannelStrip
                key={track.id}
                track={track}
                index={idx}
                isDragging={draggingId === track.id}
                isDragOver={dragOverIdx === idx && draggingId !== track.id}
                analyserNodesRef={analyserNodesRef}
                onMute={() => updateTrack(track.id, { muted: !track.muted })}
                onSolo={() => updateTrack(track.id, { soloed: !track.soloed })}
                onVolume={(v) => handleVolume(track.id, v)}
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

      <AddFileSheet
        open={showAddSheet}
        onClose={() => setShowAddSheet(false)}
        onPickFiles={() => fileInputRef.current?.click()}
        onConnect={handleOpenConnect}
      />

      <CloudConnectModal
        open={isConnectModalOpen}
        onClose={handleCloseConnect}
        realFileInputRef={fileInputRef}
        onImport={async (files) => {
          if (!files.length) return
          const existingNames = new Set(tracks.map((t) => t.name))
          const newFiles = files.filter(
            (f) => !existingNames.has(f.name.replace(/\.[^/.]+$/, "")),
          )
          if (!newFiles.length) return
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
                id: generateUUID(),
                name: file.name.replace(/\.[^/.]+$/, ""),
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
          setIsLoading(false)
        }}
      />
    </div>
  )
}

export default PlayerScreen
