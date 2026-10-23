import React from "react"

export function PlaylistMusicIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
      <rect width="8" height="3" rx="1.5" x="10" y="18" fill="#555" />
      <rect width="8" height="3" rx="1.5" x="10" y="25" fill="#555" />
      <rect width="8" height="3" rx="1.5" x="10" y="32" fill="#555" />
      <rect width="8" height="3" rx="1.5" x="10" y="39" fill="#555" />
      <path d="M28 14v20" stroke="#555" strokeWidth="3" strokeLinecap="round" />
      <path d="M28 14l10-3v5l-10 3V14z" fill="#555" />
      <circle cx="25" cy="34" r="4" fill="#555" />
      <circle cx="35" cy="31" r="4" fill="#555" />
    </svg>
  )
}

export function GlobeIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#007AFF"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
}

export function FileFolderIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="#007AFF">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    </svg>
  )
}

export function ChevronRight() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#555"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

export function DriveIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 87.3 78">
      <path
        d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0a7.9 7.9 0 0 0 1.05 4z"
        fill="#0066da"
      />
      <path
        d="M43.65 25L29.9 1.2a8.2 8.2 0 0 0-3.3 3.3L1.05 49.15A7.9 7.9 0 0 0 0 53h27.5z"
        fill="#00ac47"
      />
      <path
        d="M73.55 76.8a8.2 8.2 0 0 0 3.3-3.3l1.6-2.75 7.65-13.25A7.9 7.9 0 0 0 87.3 53H59.8l5.85 11.5z"
        fill="#ea4335"
      />
      <path
        d="M43.65 25L57.4 1.2A8.4 8.4 0 0 0 53.35 0H33.95a8.4 8.4 0 0 0-4.05 1.2z"
        fill="#00832d"
      />
      <path
        d="M59.8 53H87.3a7.9 7.9 0 0 0-1.05-4L72.5 24.5l-3.65-6.35-13.75 23.8z"
        fill="#2684fc"
      />
      <path
        d="M27.5 53l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h51.4c1.6 0 3.15-.45 4.5-1.2L59.8 53z"
        fill="#ffba00"
      />
    </svg>
  )
}

export function DropboxIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 256 218">
      <path
        d="M64 0L0 41l64 41 64-41zM192 0l-64 41 64 41 64-41zM0 123l64 41 64-41-64-41zM256 123l-64 41-64-41 64-41zM64 177l64 41 64-41-64-41z"
        fill="#0061FF"
      />
    </svg>
  )
}

export function OneDriveIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="#0078D4">
      <path d="M20.5 11A4.5 4.5 0 0 0 16.3 8a5.5 5.5 0 0 0-10.8 1.5A4 4 0 0 0 4 17.5h16.5a3 3 0 0 0 0-6z" />
    </svg>
  )
}

export function CheckIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export function DriveFileIcon({ mimeType }: { mimeType: string }) {
  const ext =
    mimeType === "audio/mpeg"
      ? "MP3"
      : mimeType === "audio/aiff" || mimeType === "audio/x-aiff"
        ? "AIF"
        : "WAV"
  const color = "#f97316"
  return (
    <div
      style={{
        width: 38,
        height: 38,
        borderRadius: 8,
        background: `${color}22`,
        border: `1px solid ${color}44`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
      <span
        style={{
          fontSize: 7,
          fontWeight: 700,
          color,
          marginTop: 2,
          letterSpacing: "0.04em",
        }}
      >
        {ext}
      </span>
    </div>
  )
}

export function DriveFolderIcon() {
  return (
    <div
      style={{
        width: 38,
        height: 38,
        borderRadius: 8,
        background: "#1a2a10",
        border: "1px solid #2a4a20",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg width="20" height="18" viewBox="0 0 24 22" fill="none">
        <path
          d="M2 5a2 2 0 0 1 2-2h4l2.5 3H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5z"
          fill="#4ade80"
          opacity="0.25"
        />
        <path
          d="M2 5a2 2 0 0 1 2-2h4l2.5 3H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5z"
          stroke="#4ade80"
          strokeWidth="1.5"
          fill="none"
        />
      </svg>
    </div>
  )
}

export function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <polygon points="2,1 13,7 2,13" />
    </svg>
  )
}

export function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <rect x="2" y="1" width="3.5" height="12" rx="0.5" />
      <rect x="8.5" y="1" width="3.5" height="12" rx="0.5" />
    </svg>
  )
}

export function StopIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <rect x="1" y="1" width="10" height="10" rx="1" />
    </svg>
  )
}

export function FolderIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  )
}

export function TrashIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6M9 6V4h6v2" />
    </svg>
  )
}

export function MusicIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: "#444" }}
    >
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  )
}

export function BackIcon() {
  return (
    <svg
      width="10"
      height="16"
      viewBox="0 0 10 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <polyline points="8,1 2,8 8,15" />
    </svg>
  )
}
