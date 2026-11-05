export interface TimelineSection {
  title: string
  start: string
  end: string
  startSeconds: number
  endSeconds: number
}

export interface TrackTimeline {
  duration: string
  durationSeconds: number
  tracks: TimelineSection[]
}

const timelineKey = (playlistId: string) =>
  `his-tracks:${playlistId}:timeline`

function parseTime(value: unknown): number {
  if (typeof value !== "string" || !/^\d{2}:\d{2}:\d{2}$/.test(value)) {
    throw new Error("INVALID_TIME")
  }
  const [hours, minutes, seconds] = value.split(":").map(Number)
  if (minutes > 59 || seconds > 59) throw new Error("INVALID_TIME")
  return hours * 3600 + minutes * 60 + seconds
}

export function parseTrackTimeline(value: unknown): TrackTimeline {
  if (!value || typeof value !== "object") throw new Error("INVALID_TIMELINE")
  const raw = value as {
    duration?: unknown
    tracks?: unknown
  }
  const durationSeconds = parseTime(raw.duration)
  if (!Array.isArray(raw.tracks) || raw.tracks.length === 0) {
    throw new Error("INVALID_TRACKS")
  }

  const tracks = raw.tracks.map((item, index) => {
    if (!item || typeof item !== "object") throw new Error("INVALID_TRACK")
    const track = item as { title?: unknown; start?: unknown; end?: unknown }
    if (typeof track.title !== "string" || !track.title.trim()) {
      throw new Error("INVALID_TITLE")
    }
    const startSeconds = parseTime(track.start)
    const endSeconds = parseTime(track.end)
    if (
      endSeconds <= startSeconds ||
      endSeconds > durationSeconds ||
      (index > 0 &&
        startSeconds <
          parseTime(
            (raw.tracks as Array<{ end?: unknown }>)[index - 1]?.end,
          ))
    ) {
      throw new Error("INVALID_RANGE")
    }
    return {
      title: track.title.trim(),
      start: track.start as string,
      end: track.end as string,
      startSeconds,
      endSeconds,
    }
  })

  return {
    duration: raw.duration as string,
    durationSeconds,
    tracks,
  }
}

export async function parseTrackTimelineFile(
  file: File,
): Promise<TrackTimeline> {
  return parseTrackTimeline(JSON.parse(await file.text()))
}

export function saveTrackTimeline(
  playlistId: string,
  timeline: TrackTimeline,
) {
  localStorage.setItem(timelineKey(playlistId), JSON.stringify(timeline))
}

export function loadTrackTimeline(
  playlistId: string,
): TrackTimeline | null {
  try {
    const raw = localStorage.getItem(timelineKey(playlistId))
    return raw ? parseTrackTimeline(JSON.parse(raw)) : null
  } catch {
    localStorage.removeItem(timelineKey(playlistId))
    return null
  }
}

export function deleteTrackTimeline(playlistId: string) {
  localStorage.removeItem(timelineKey(playlistId))
}

export function findTimelineSectionIndex(
  timeline: TrackTimeline,
  time: number,
): number {
  const index = timeline.tracks.findIndex(
    (section) => time >= section.startSeconds && time < section.endSeconds,
  )
  if (index >= 0) return index
  if (time >= timeline.durationSeconds) return timeline.tracks.length - 1
  return 0
}
