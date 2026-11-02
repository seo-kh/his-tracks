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
