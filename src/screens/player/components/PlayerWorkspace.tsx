import { useCallback, useEffect, useRef, useState } from "react"
import type * as React from "react"
import {
  deletePlaylistAudio,
  deletePlaylistAudioFiles,
  loadPlaylistAudio,
  loadTrackMetadata,
  persistAudioFiles,
  saveTrackMetadata,
} from "../../../services/audio/audioStorage"
import {
  estimateSelectedAudioMemory,
  estimateTimelineSectionMemory,
  formatMemorySize,
  getAudioMemoryCheck,
  type AudioMemoryCheck,
} from "../../../services/audio/audioMemory"
import {
  findTimelineSectionIndex,
  loadTrackTimeline,
  parseTrackTimelineFile,
  saveTrackTimeline,
  type TimelineSection,
  type TrackTimeline,
} from "../../../services/audio/trackTimeline"
import CloudConnectScreen from "../../cloud/CloudConnectScreen"
import AddFileSheet from "../../cloud/components/AddFileSheet"
import type { Playlist, Track } from "../../../shared/types"
import { PLAYER_FILE_ACCEPT } from "../../../shared/audioFormats"
import ChannelStrip from "./ChannelStrip"
import {
  BackIcon,
  FolderIcon,
  MusicIcon,
  PauseIcon,
  PlayIcon,
  StopIcon,
  TrashIcon,
} from "./PlayerIcons"
import {
  TRACK_COLORS,
  createSilentWaveUrl,
  effectiveGain,
  formatTime,
} from "../playerUtils"

// ── Player Screen ──────────────────────────────────────────────────────────

interface PlayerScreenProps {
  playlist: Playlist
  initialTracks: Track[]
  onBack: (tracks: Track[]) => void
}

function sliceAudioBuffer(
  context: AudioContext,
  source: AudioBuffer,
  section: TimelineSection,
): AudioBuffer {
  const startFrame = Math.max(
    0,
    Math.min(source.length, Math.floor(section.startSeconds * source.sampleRate)),
  )
  const endFrame = Math.max(
    startFrame + 1,
    Math.min(source.length, Math.ceil(section.endSeconds * source.sampleRate)),
  )
  const output = context.createBuffer(
    source.numberOfChannels,
    endFrame - startFrame,
    source.sampleRate,
  )
  for (let channel = 0; channel < source.numberOfChannels; channel++) {
    output.copyToChannel(
      source.getChannelData(channel).subarray(startFrame, endFrame),
      channel,
    )
  }
  return output
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
  const [timeline, setTimeline] = useState<TrackTimeline | null>(() =>
    loadTrackTimeline(playlist.id),
  )
  const [loadedSectionIndex, setLoadedSectionIndex] = useState<number | null>(
    null,
  )
  const [configError, setConfigError] = useState(false)
  const [memoryWarning, setMemoryWarning] = useState<
    (AudioMemoryCheck & { fileCount: number }) | null
  >(null)

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
  const restoreStartedRef = useRef(false)
  const sectionLoadRequestRef = useRef(0)
  const loadedSectionIndexRef = useRef<number | null>(null)

  tracksRef.current = tracks
  isPlayingRef.current = isPlaying
  draggingIdRef.current = draggingId

  const maxDuration =
    timeline?.durationSeconds ??
    tracks.reduce((max, t) => Math.max(max, t.duration), 0)
  const activeSection = timeline
    ? timeline.tracks[
        findTimelineSectionIndex(timeline, isSeeking ? seekValue : currentTime)
      ]
    : null

  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext()
    return audioCtxRef.current
  }, [])

  const checkMemoryCapacity = useCallback(
    async (
      files: File[],
      knownDurations?: number[],
      sectionDuration?: number,
    ) => {
      if (files.length === 0) return true
      const sampleRate = getAudioCtx().sampleRate
      const estimatedBytes =
        sectionDuration && sectionDuration > 0
          ? await estimateTimelineSectionMemory(
              files,
              sampleRate,
              sectionDuration,
              knownDurations,
            )
          : await estimateSelectedAudioMemory(
              files,
              sampleRate,
              knownDurations,
            )
      const check = getAudioMemoryCheck(estimatedBytes)
      if (check.estimatedBytes <= check.safeLimitBytes) return true
      setMemoryWarning({ ...check, fileCount: files.length })
      return false
    },
    [getAudioCtx],
  )

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
  }, [getAudioCtx])

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
      section?: TimelineSection,
    ) => {
      const ctx = audioCtxRef.current ?? new AudioContext()
      audioCtxRef.current = ctx
      const decoded: Track[] = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        try {
          const buffer = await ctx.decodeAudioData(await file.arrayBuffer())
          const playbackBuffer = section
            ? sliceAudioBuffer(ctx, buffer, section)
            : buffer
          const stored = storedTracks?.[i]?.metadata
          decoded.push({
            id: stored?.id ?? crypto.randomUUID(),
            name: stored?.name ?? file.name.replace(/\.[^/.]+$/, ""),
            fileName: file.name,
            path: stored?.path ?? `${directoryName}/${file.name}`,
            buffer: playbackBuffer,
            file,
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
    if (initialTracks.length > 0 || restoreStartedRef.current) return
    restoreStartedRef.current = true
    let cancelled = false
    setIsLoading(true)
    const originalMetadata = loadTrackMetadata(playlist.id)
    loadPlaylistAudio(playlist.id)
      .then(async (stored) => {
        const files = stored.map((item) => item.file)
        const section = timeline?.tracks[0]
        const canDecode = await checkMemoryCapacity(
          files,
          stored.map((item) => item.metadata.duration),
          section ? section.endSeconds - section.startSeconds : undefined,
        )
        if (!canDecode || cancelled) return
        const decoded = await decodeFiles(
          files,
          "",
          stored,
          section,
        )
        if (!cancelled) {
          storageReadyRef.current = true
          setTracks(decoded)
          setLoadedSectionIndex(section ? 0 : null)
          loadedSectionIndexRef.current = section ? 0 : null
          saveTrackMetadata(
            playlist.id,
            decoded.map(({ buffer: _buffer, file: _file, ...track }) => track),
          )
          const decodedNames = new Set(decoded.map((track) => track.fileName))
          const failedNames = originalMetadata
            .map((item) => item.fileName)
            .filter((fileName) => !decodedNames.has(fileName))
          if (failedNames.length > 0) {
            void deletePlaylistAudioFiles(playlist.id, failedNames)
          }
        }
      })
      .finally(() => {
        storageReadyRef.current = true
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [
    checkMemoryCapacity,
    decodeFiles,
    initialTracks.length,
    playlist.id,
    timeline,
  ])

  useEffect(() => {
    if (!storageReadyRef.current) return
    saveTrackMetadata(
      playlist.id,
      tracks.map(({ buffer: _buffer, file: _file, ...track }) => track),
    )
  }, [playlist.id, tracks])

  const loadTimelineSection = useCallback(
    async (
      sectionIndex: number,
      sourceTracks: Track[],
    ): Promise<Track[] | null> => {
      if (!timeline) return sourceTracks
      if (
        loadedSectionIndexRef.current === sectionIndex &&
        sourceTracks.length > 0
      ) {
        return sourceTracks
      }

      const section = timeline.tracks[sectionIndex]
      if (!section) return null
      const requestId = ++sectionLoadRequestRef.current
      const files = sourceTracks.map((track) => track.file)
      const canDecode = await checkMemoryCapacity(
        files,
        sourceTracks.map((track) => track.duration),
        section.endSeconds - section.startSeconds,
      )
      if (!canDecode || requestId !== sectionLoadRequestRef.current) return null

      const stored = sourceTracks.map((track) => ({
        file: track.file,
        metadata: {
          id: track.id,
          name: track.name,
          fileName: track.fileName,
          path: track.path,
          duration: track.duration,
          muted: track.muted,
          soloed: track.soloed,
          volume: track.volume,
          color: track.color,
        },
      }))
      const decoded = await decodeFiles(files, "", stored, section)
      if (requestId !== sectionLoadRequestRef.current) return null
      tracksRef.current = decoded
      loadedSectionIndexRef.current = sectionIndex
      setLoadedSectionIndex(sectionIndex)
      setTracks(decoded)
      return decoded
    },
    [checkMemoryCapacity, decodeFiles, timeline],
  )

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
    async (offset: number, currentTracks: Track[]) => {
      let playbackTracks = currentTracks
      let sourceOffset = offset
      let sectionIndex: number | null = null
      let section: TimelineSection | undefined

      if (timeline) {
        sectionIndex = findTimelineSectionIndex(timeline, offset)
        section = timeline.tracks[sectionIndex]
        sourceOffset = Math.max(0, offset - section.startSeconds)
        if (loadedSectionIndexRef.current !== sectionIndex) {
          setIsLoading(true)
          const loaded = await loadTimelineSection(sectionIndex, currentTracks)
          setIsLoading(false)
          if (!loaded) {
            setIsPlaying(false)
            return
          }
          playbackTracks = loaded
        }
      }

      const ctx = activatePlaybackAudioSession()
      stopAllSources()
      gainNodesRef.current.clear()
      analyserNodesRef.current.clear()
      const startAt = ctx.currentTime
      startTimeRef.current = startAt - offset
      playbackTracks.forEach((track) => {
        if (sourceOffset >= track.buffer.duration) return
        const gain = ctx.createGain()
        gain.gain.value = effectiveGain(track, playbackTracks)
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
        src.start(startAt, sourceOffset)
        sourceNodesRef.current.set(track.id, src)
      })
      setIsPlaying(true)
      const tick = () => {
        const ctx2 = audioCtxRef.current
        if (!ctx2) return
        const elapsed = ctx2.currentTime - startTimeRef.current
        const maxDur =
          timeline?.durationSeconds ??
          tracksRef.current.reduce((m, t) => Math.max(m, t.duration), 0)
        if (elapsed >= maxDur && maxDur > 0) {
          setCurrentTime(maxDur)
          setSeekValue(maxDur)
          setIsPlaying(false)
          pauseOffsetRef.current = 0
          pausePlaybackAudioSession()
          return
        }
        if (
          timeline &&
          section &&
          sectionIndex !== null &&
          elapsed >= section.endSeconds
        ) {
          stopAllSources()
          const nextIndex = sectionIndex + 1
          if (nextIndex < timeline.tracks.length) {
            void startPlayback(
              timeline.tracks[nextIndex].startSeconds,
              tracksRef.current,
            )
          }
          return
        }
        setCurrentTime(elapsed)
        animFrameRef.current = requestAnimationFrame(tick)
      }
      animFrameRef.current = requestAnimationFrame(tick)
    },
    [
      activatePlaybackAudioSession,
      loadTimelineSection,
      pausePlaybackAudioSession,
      stopAllSources,
      timeline,
    ],
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
      void startPlayback(pauseOffsetRef.current, tracks)
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
    if (isPlayingRef.current) {
      void startPlayback(seekValue, tracksRef.current)
    }
  }

  const handleFileLoad = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const configFile = files.find(
      (file) =>
        file.name.toLowerCase() === "tracks.json" ||
        file.type === "application/json",
    )
    const audioCandidates = files.filter((file) => file !== configFile)
    const existingNames = new Set(tracks.map((t) => t.name))
    const newFiles = audioCandidates.filter(
      (f) => !existingNames.has(f.name.replace(/\.[^/.]+$/, "")),
    )
    let nextTimeline = timeline
    let timelineChanged = false
    if (configFile) {
      try {
        nextTimeline = await parseTrackTimelineFile(configFile)
        saveTrackTimeline(playlist.id, nextTimeline)
        setTimeline(nextTimeline)
        timelineChanged = true
      } catch {
        setConfigError(true)
        if (fileInputRef.current) fileInputRef.current.value = ""
        return
      }
    }

    if (!newFiles.length && !timelineChanged) {
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }

    setIsLoading(true)
    const sectionIndex = nextTimeline
      ? findTimelineSectionIndex(nextTimeline, currentTime)
      : null
    const section =
      sectionIndex === null ? undefined : nextTimeline?.tracks[sectionIndex]
    const filesToDecode = timelineChanged
      ? [...tracks.map((track) => track.file), ...newFiles]
      : newFiles
    const knownDurations = timelineChanged
      ? [...tracks.map((track) => track.duration), ...newFiles.map(() => 0)]
      : undefined
    if (
      !(await checkMemoryCapacity(
        filesToDecode,
        knownDurations,
        section ? section.endSeconds - section.startSeconds : undefined,
      ))
    ) {
      setIsLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }

    let nextTracks: Track[]
    if (timelineChanged) {
      const stored = tracks.map((track) => ({
        file: track.file,
        metadata: {
          id: track.id,
          name: track.name,
          fileName: track.fileName,
          path: track.path,
          duration: track.duration,
          muted: track.muted,
          soloed: track.soloed,
          volume: track.volume,
          color: track.color,
        },
      }))
      const existingDecoded = await decodeFiles(
        tracks.map((track) => track.file),
        "",
        stored,
        section,
      )
      const newDecoded = await decodeFiles(
        newFiles,
        "기기 파일",
        undefined,
        section,
      )
      nextTracks = [...existingDecoded, ...newDecoded]
      loadedSectionIndexRef.current = sectionIndex
      setLoadedSectionIndex(sectionIndex)
    } else {
      const newDecoded = await decodeFiles(
        newFiles,
        "기기 파일",
        undefined,
        section,
      )
      nextTracks = [...tracks, ...newDecoded]
    }

    tracksRef.current = nextTracks
    setTracks(nextTracks)
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
        className="player-transport-bar"
        style={{
          flexShrink: 0,
          background: "linear-gradient(180deg, #252525 0%, #1e1e1e 100%)",
          borderBottom: "1px solid #333",
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
            accept={PLAYER_FILE_ACCEPT}
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            height: 16,
            marginBlock: 16,
          }}
        >
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
        {activeSection && (
          <div
            style={{
              alignSelf: "center",
              maxWidth: "min(520px, 80vw)",
              marginTop: -10,
              padding: "4px 12px",
              borderRadius: 999,
              background: "rgba(0,122,255,0.12)",
              color: "#66aaff",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              fontWeight: 600,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {activeSection.title}
          </div>
        )}
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

      {configError && (
        <>
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 362,
              background: "rgba(0,0,0,0.72)",
              backdropFilter: "blur(5px)",
            }}
          />
          <div
            role="alertdialog"
            aria-modal="true"
            style={{
              position: "fixed",
              left: "50%",
              top: "50%",
              zIndex: 363,
              width: "min(360px, calc(100vw - 48px))",
              transform: "translate(-50%, -50%)",
              overflow: "hidden",
              borderRadius: 15,
              background: "#2c2c2e",
              border: "1px solid #5a4140",
              textAlign: "center",
            }}
          >
            <div style={{ padding: "22px 20px 18px" }}>
              <div style={{ color: "#fff", fontSize: 17, fontWeight: 700 }}>
                tracks.json을 읽을 수 없습니다
              </div>
              <div
                style={{
                  color: "#b0b0b5",
                  fontSize: 13,
                  lineHeight: 1.6,
                  marginTop: 10,
                }}
              >
                duration, title, start, end 값과 hh:mm:ss 시간 형식을
                확인해주세요.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setConfigError(false)}
              style={{
                width: "100%",
                padding: "14px",
                border: "none",
                borderTop: "1px solid #48484a",
                background: "transparent",
                color: "#007AFF",
                fontSize: 15,
                fontWeight: 700,
              }}
            >
              확인
            </button>
          </div>
        </>
      )}

      {memoryWarning && (
        <>
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 360,
              background: "rgba(0,0,0,0.72)",
              backdropFilter: "blur(5px)",
            }}
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="memory-warning-title"
            style={{
              position: "fixed",
              left: "50%",
              top: "50%",
              zIndex: 361,
              width:
                "min(380px, calc(100vw - 48px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)))",
              transform: "translate(-50%, -50%)",
              overflow: "hidden",
              borderRadius: 15,
              background: "#2c2c2e",
              border: "1px solid #5a4140",
              boxShadow: "0 22px 70px rgba(0,0,0,0.78)",
            }}
          >
            <div style={{ padding: "22px 20px 18px", textAlign: "center" }}>
              <div
                id="memory-warning-title"
                style={{ color: "#fff", fontSize: 17, fontWeight: 700 }}
              >
                선택한 음원이 너무 많습니다
              </div>
              <div
                style={{
                  color: "#b0b0b5",
                  fontSize: 13,
                  lineHeight: 1.65,
                  marginTop: 10,
                }}
              >
                선택한 {memoryWarning.fileCount}개 음원을 PCM으로 불러오려면 약{" "}
                <strong style={{ color: "#ff9f8f" }}>
                  {formatMemorySize(memoryWarning.estimatedBytes)}
                </strong>
                의 메모리가 필요합니다.
                <br />
                현재 안전하게 사용할 수 있는 예상 한도는{" "}
                <strong style={{ color: "#fff" }}>
                  {formatMemorySize(memoryWarning.safeLimitBytes)}
                </strong>
                입니다.
              </div>
              <div
                style={{
                  color: "#8e8e93",
                  fontSize: 11,
                  lineHeight: 1.55,
                  marginTop: 12,
                  padding: "9px 10px",
                  borderRadius: 8,
                  background: "#221a1a",
                }}
              >
                앱 크래시를 방지하기 위해{" "}
                {formatMemorySize(memoryWarning.reservedBytes)}의 여유 메모리를
                남겨둡니다. 파일 수를 줄여 다시 선택해주세요.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMemoryWarning(null)}
              style={{
                width: "100%",
                padding: "14px",
                border: "none",
                borderTop: "1px solid #48484a",
                background: "transparent",
                color: "#007AFF",
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              확인
            </button>
          </div>
        </>
      )}

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
          const configFile = files.find(
            (file) =>
              file.name.toLowerCase() === "tracks.json" ||
              file.type === "application/json",
          )
          const audioFiles = files.filter((file) => file !== configFile)
          let nextTimeline = timeline
          let timelineChanged = false
          if (configFile) {
            try {
              nextTimeline = await parseTrackTimelineFile(configFile)
              saveTrackTimeline(playlist.id, nextTimeline)
              setTimeline(nextTimeline)
              timelineChanged = true
            } catch {
              setConfigError(true)
              return
            }
          }

          const existingNames = new Set(tracks.map((track) => track.name))
          const newFiles = audioFiles.filter(
            (file) =>
              !existingNames.has(file.name.replace(/\.[^/.]+$/, "")),
          )
          if (newFiles.length === 0 && !timelineChanged) return
          setIsLoading(true)
          const sectionIndex = nextTimeline
            ? findTimelineSectionIndex(nextTimeline, currentTime)
            : null
          const section =
            sectionIndex === null ? undefined : nextTimeline?.tracks[sectionIndex]
          const filesToDecode = timelineChanged
            ? [...tracks.map((track) => track.file), ...newFiles]
            : newFiles
          if (
            !(await checkMemoryCapacity(
              filesToDecode,
              timelineChanged
                ? [...tracks.map((track) => track.duration), ...newFiles.map(() => 0)]
                : undefined,
              section ? section.endSeconds - section.startSeconds : undefined,
            ))
          ) {
            setIsLoading(false)
            return
          }
          await persistAudioFiles(playlist.id, newFiles, directoryHandle)

          let nextTracks: Track[]
          let addedTracks: Track[]
          if (timelineChanged) {
            const stored = tracks.map((track) => ({
              file: track.file,
              metadata: {
                id: track.id,
                name: track.name,
                fileName: track.fileName,
                path: track.path,
                duration: track.duration,
                muted: track.muted,
                soloed: track.soloed,
                volume: track.volume,
                color: track.color,
              },
            }))
            const existingDecoded = await decodeFiles(
              tracks.map((track) => track.file),
              "",
              stored,
              section,
            )
            addedTracks = await decodeFiles(
              newFiles,
              directoryName,
              undefined,
              section,
            )
            nextTracks = [...existingDecoded, ...addedTracks]
            loadedSectionIndexRef.current = sectionIndex
            setLoadedSectionIndex(sectionIndex)
          } else {
            addedTracks = await decodeFiles(
              newFiles,
              directoryName,
              undefined,
              section,
            )
            nextTracks = [...tracks, ...addedTracks]
          }
          saveTrackMetadata(
            playlist.id,
            nextTracks.map(
              ({ buffer: _buffer, file: _file, ...track }) => track,
            ),
          )
          if (!shouldPlay) {
            stopAllSources()
            onBack(nextTracks)
            return
          }
          if (!addedTracks.length && !timelineChanged) {
            setIsLoading(false)
            return
          }
          tracksRef.current = nextTracks
          setTracks(nextTracks)
          setIsLoading(false)
          if (shouldPlay) void startPlayback(currentTime, nextTracks)
        }}
      />
    </div>
  )
}
