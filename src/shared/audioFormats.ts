export const AUDIO_MIME_TYPES = [
  "audio/wav",
  "audio/mpeg",
  "audio/aiff",
  "audio/x-aiff",
  "audio/flac",
  "audio/ogg",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/aac",
  "audio/mp4a-latm",
] as const

export const AUDIO_FILE_ACCEPT = [
  "audio/*",
  ".wav",
  ".mp3",
  ".aif",
  ".aiff",
  ".flac",
  ".ogg",
  ".aac",
  ".m4a",
  ...AUDIO_MIME_TYPES,
].join(",")

export function getAudioExtension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? ""
}

export function getSavePickerMimeType(
  fileName: string,
  mimeType: string,
): string {
  return getAudioExtension(fileName) === "m4a" ? "audio/mp4" : mimeType || "audio/*"
}
