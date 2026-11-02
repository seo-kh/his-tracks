const MEBIBYTE = 1024 ** 2
const GIBIBYTE = 1024 ** 3
const RESERVED_BYTES = 500 * MEBIBYTE
const IOS_FALLBACK_AVAILABLE_BYTES = 1024 * MEBIBYTE
const PCM_CHANNELS = 2
const FLOAT32_BYTES = 4
const PCM_OVERHEAD_RATIO = 1.1

interface PerformanceMemory {
  jsHeapSizeLimit: number
  usedJSHeapSize: number
}

export interface AudioMemoryCheck {
  estimatedBytes: number
  availableBytes: number
  safeLimitBytes: number
  reservedBytes: number
  source: "heap" | "device" | "fallback"
}

export function readAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const audio = new Audio()
    let settled = false

    const finish = (duration?: number, error?: Error) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      audio.removeAttribute("src")
      audio.load()
      URL.revokeObjectURL(objectUrl)
      if (error || !duration || !Number.isFinite(duration)) {
        reject(error ?? new Error("INVALID_AUDIO_DURATION"))
      } else {
        resolve(duration)
      }
    }

    const timeout = window.setTimeout(
      () => finish(undefined, new Error("AUDIO_METADATA_TIMEOUT")),
      10_000,
    )
    audio.preload = "metadata"
    audio.onloadedmetadata = () => finish(audio.duration)
    audio.onerror = () => finish(undefined, new Error("AUDIO_METADATA_ERROR"))
    audio.src = objectUrl
    audio.load()
  })
}

async function estimateFilePcmBytes(
  file: File,
  sampleRate: number,
  knownDuration?: number,
): Promise<number> {
  try {
    const duration =
      knownDuration && knownDuration > 0
        ? knownDuration
        : await readAudioDuration(file)
    const pcmBytes =
      duration * sampleRate * PCM_CHANNELS * FLOAT32_BYTES
    return pcmBytes * PCM_OVERHEAD_RATIO + file.size * 2
  } catch {
    // Compressed audio can expand substantially; use a conservative fallback.
    return Math.max(file.size * 24, file.size + 32 * MEBIBYTE)
  }
}

export async function estimateSelectedAudioMemory(
  files: File[],
  sampleRate: number,
  knownDurations?: number[],
): Promise<number> {
  let total = 0
  for (let index = 0; index < files.length; index++) {
    total += await estimateFilePcmBytes(
      files[index],
      sampleRate,
      knownDurations?.[index],
    )
  }
  return total
}

export function getAudioMemoryCheck(estimatedBytes: number): AudioMemoryCheck {
  const memory = (
    performance as Performance & { memory?: PerformanceMemory }
  ).memory

  let availableBytes: number
  let source: AudioMemoryCheck["source"]

  if (
    memory &&
    memory.jsHeapSizeLimit > 0 &&
    memory.usedJSHeapSize >= 0
  ) {
    availableBytes = Math.max(
      0,
      memory.jsHeapSizeLimit - memory.usedJSHeapSize,
    )
    source = "heap"
  } else {
    const deviceMemory = (
      navigator as Navigator & { deviceMemory?: number }
    ).deviceMemory
    if (deviceMemory && deviceMemory > 0) {
      // Browser tabs cannot normally use all physical RAM.
      availableBytes = Math.min(deviceMemory * GIBIBYTE * 0.5, 2 * GIBIBYTE)
      source = "device"
    } else {
      // iOS/WebKit does not expose memory APIs. Keep a conservative 1GB budget.
      availableBytes = IOS_FALLBACK_AVAILABLE_BYTES
      source = "fallback"
    }
  }

  return {
    estimatedBytes,
    availableBytes,
    safeLimitBytes: Math.max(0, availableBytes - RESERVED_BYTES),
    reservedBytes: RESERVED_BYTES,
    source,
  }
}

export function formatMemorySize(bytes: number): string {
  if (bytes >= GIBIBYTE) return `${(bytes / GIBIBYTE).toFixed(1)}GB`
  return `${Math.ceil(bytes / MEBIBYTE)}MB`
}
