import {
  FOLDER_MIME,
  type DriveLocation,
  type GDriveItem,
  type GSharedDrive,
} from "./googleDrive"

export const MOCK_DRIVE_TOKEN = "__his_tracks_mock_drive__"

const MOCK_SHARED_DRIVES: GSharedDrive[] = [
  { id: "mock-shared-worship", name: "찬양팀 공유 드라이브" },
  { id: "mock-shared-live", name: "공연 자료 공유 드라이브" },
]

const MOCK_ITEMS: GDriveItem[] = [
  {
    id: "mock-folder-band",
    name: "밴드 세션",
    mimeType: FOLDER_MIME,
    modifiedTime: "2026-09-18T08:30:00.000Z",
    parents: ["root"],
  },
  {
    id: "mock-folder-live",
    name: "라이브 녹음",
    mimeType: FOLDER_MIME,
    modifiedTime: "2026-09-12T11:10:00.000Z",
    parents: ["root"],
  },
  {
    id: "mock-click",
    name: "Click_120BPM.wav",
    mimeType: "audio/wav",
    size: "441044",
    modifiedTime: "2026-09-18T08:20:00.000Z",
    parents: ["root"],
  },
  {
    id: "mock-guide",
    name: "Guide_Vocal.wav",
    mimeType: "audio/wav",
    size: "529244",
    modifiedTime: "2026-09-18T08:18:00.000Z",
    parents: ["root"],
  },
  {
    id: "mock-drums",
    name: "01_Drums.wav",
    mimeType: "audio/wav",
    size: "617444",
    modifiedTime: "2026-09-18T07:55:00.000Z",
    parents: ["mock-folder-band"],
  },
  {
    id: "mock-bass",
    name: "02_Bass.wav",
    mimeType: "audio/wav",
    size: "617444",
    modifiedTime: "2026-09-18T07:54:00.000Z",
    parents: ["mock-folder-band"],
  },
  {
    id: "mock-guitar",
    name: "03_Guitar.wav",
    mimeType: "audio/wav",
    size: "617444",
    modifiedTime: "2026-09-18T07:53:00.000Z",
    parents: ["mock-folder-band"],
  },
  {
    id: "mock-keys",
    name: "04_Keys.wav",
    mimeType: "audio/wav",
    size: "617444",
    modifiedTime: "2026-09-18T07:52:00.000Z",
    parents: ["mock-folder-band"],
  },
  {
    id: "mock-room",
    name: "Room_Mic.wav",
    mimeType: "audio/wav",
    size: "705644",
    modifiedTime: "2026-09-12T11:05:00.000Z",
    parents: ["mock-folder-live"],
  },
  {
    id: "mock-shared-folder-sunday",
    name: "주일 예배",
    mimeType: FOLDER_MIME,
    modifiedTime: "2026-09-20T03:00:00.000Z",
    parents: ["mock-shared-worship"],
  },
  {
    id: "mock-shared-praise",
    name: "Praise_Guide.wav",
    mimeType: "audio/wav",
    size: "617444",
    modifiedTime: "2026-09-20T02:50:00.000Z",
    parents: ["mock-shared-worship"],
  },
  {
    id: "mock-shared-vocal",
    name: "Sunday_Vocal.wav",
    mimeType: "audio/wav",
    size: "705644",
    modifiedTime: "2026-09-20T02:45:00.000Z",
    parents: ["mock-shared-folder-sunday"],
  },
  {
    id: "mock-shared-live-master",
    name: "Live_Master.wav",
    mimeType: "audio/wav",
    size: "882044",
    modifiedTime: "2026-09-19T13:10:00.000Z",
    parents: ["mock-shared-live"],
  },
]

const FREQUENCIES: Record<string, number> = {
  "mock-click": 880,
  "mock-guide": 440,
  "mock-drums": 110,
  "mock-bass": 82.41,
  "mock-guitar": 196,
  "mock-keys": 261.63,
  "mock-room": 329.63,
  "mock-shared-praise": 392,
  "mock-shared-vocal": 523.25,
  "mock-shared-live-master": 293.66,
}

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

export async function listMockSharedDrives(): Promise<GSharedDrive[]> {
  await wait(250)
  return MOCK_SHARED_DRIVES
}

export async function listMockDriveItems(
  location: DriveLocation,
): Promise<GDriveItem[]> {
  await wait(350)
  const parentId = location.folderId ?? location.driveId ?? "root"
  return MOCK_ITEMS.filter((item) => item.parents?.includes(parentId))
}

function createWaveBlob(frequency: number, durationSeconds = 4): Blob {
  const sampleRate = 44_100
  const sampleCount = sampleRate * durationSeconds
  const bytesPerSample = 2
  const dataSize = sampleCount * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  const writeText = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i))
  }

  writeText(0, "RIFF")
  view.setUint32(4, 36 + dataSize, true)
  writeText(8, "WAVE")
  writeText(12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * bytesPerSample, true)
  view.setUint16(32, bytesPerSample, true)
  view.setUint16(34, 16, true)
  writeText(36, "data")
  view.setUint32(40, dataSize, true)

  for (let sample = 0; sample < sampleCount; sample++) {
    const time = sample / sampleRate
    const pulse = Math.sin(2 * Math.PI * frequency * time)
    const harmonic = Math.sin(2 * Math.PI * frequency * 2 * time) * 0.18
    const fade = Math.min(1, sample / 1200, (sampleCount - sample) / 1800)
    view.setInt16(44 + sample * 2, (pulse + harmonic) * fade * 8000, true)
  }

  return new Blob([buffer], { type: "audio/wav" })
}

export async function downloadMockDriveFile(
  fileId: string,
  onProgress: (percentage: number) => void,
): Promise<Blob> {
  for (const percentage of [8, 24, 46, 68, 86, 100]) {
    await wait(90)
    onProgress(percentage)
  }
  return createWaveBlob(FREQUENCIES[fileId] ?? 440)
}
