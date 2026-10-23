import { useCallback, useEffect, useRef, useState } from "react"
import type * as React from "react"
import {
  signInWithGoogle,
  signInImplicit,
  signInViaServer,
  signOutViaServer,
  clearToken,
  getStoredToken,
  listDriveItems,
  downloadDriveFile,
  saveBlobToDirectory,
  saveBlobToFileHandle,
  FOLDER_MIME,
  type GDriveItem,
} from "../../../services/cloud/googleDrive"
import {
  downloadMockDriveFile,
  listMockDriveItems,
  MOCK_DRIVE_TOKEN,
} from "../../../services/cloud/mockGoogleDrive"

// Client ID for popup (PKCE) fallback — only needed when not using the Express server.
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ""
const GOOGLE_CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET ?? ""
const HAS_SERVER =
  import.meta.env.PROD || import.meta.env.VITE_USE_SERVER === "true"
const USE_MOCK_DRIVE =
  import.meta.env.DEV && import.meta.env.VITE_GOOGLE_DRIVE_MOCK !== "false"

// ── Add File Sheet ─────────────────────────────────────────────────────────

import { CheckIcon, ChevronRight, DriveIcon, FileFolderIcon } from "./CloudIcons"

// ── Cloud Connect Modal ────────────────────────────────────────────────────

type CloudStep = "provider" | "files" | "confirm" | "downloading" | "done"
type CloudProvider = "google"

// GDriveItem alias used throughout the UI (imported from googleDrive.ts)
type DriveItem = GDriveItem

function formatBytes(bytes: string): string {
  const n = parseInt(bytes, 10)
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} MB`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)} KB`
  return `${n} B`
}

function DriveFileIcon({ mimeType }: { mimeType: string }) {
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

function DriveFolderIcon() {
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

interface CloudConnectModalProps {
  open: boolean
  onClose: () => void
  onComplete: (
    files: File[],
    directoryHandle: FileSystemDirectoryHandle | null,
    directoryName: string,
    shouldPlay: boolean,
  ) => Promise<void>
  realFileInputRef: React.RefObject<HTMLInputElement | null>
}

export default function CloudConnectModal({
  open,
  onClose,
  onComplete,
  realFileInputRef,
}: CloudConnectModalProps) {
  const [step, setStep] = useState<CloudStep>("provider")
  const [provider, setProvider] = useState<CloudProvider | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState("")
  const [driveItems, setDriveItems] = useState<DriveItem[]>([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [loadError, setLoadError] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [fileProgresses, setFileProgresses] = useState<Map<string, number>>(
    new Map(),
  )
  const [downloadedFiles, setDownloadedFiles] = useState<Map<string, File>>(
    new Map(),
  )
  const [saveDirName, setSaveDirName] = useState("")
  const [usesIndividualFilePicker, setUsesIndividualFilePicker] =
    useState(false)
  const [destinationError, setDestinationError] = useState("")
  const [finishing, setFinishing] = useState(false)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const dirHandleRef = useRef<FileSystemDirectoryHandle | null>(null)
  const fileHandlesRef = useRef<Map<string, FileSystemFileHandle>>(new Map())
  const [folderStack, setFolderStack] = useState<
    { id: string; name: string }[]
  >(
    [],
  )

  const currentFolderId =
    folderStack.length > 0 ? folderStack[folderStack.length - 1].id : null

  // Load Drive items whenever folder changes or token arrives
  const loadItems = useCallback(
    async (token: string, folderId: string | null) => {
      setLoadingItems(true)
      setLoadError("")
      try {
        const items =
          token === MOCK_DRIVE_TOKEN
            ? await listMockDriveItems(folderId)
            : await listDriveItems(token, folderId)
        setDriveItems(items)
      } catch (e: any) {
        if (e?.message === "UNAUTHORIZED") {
          setAccessToken(null)
          setStep("provider")
          setConnectError("세션이 만료되었습니다. 다시 로그인해주세요.")
        } else {
          setLoadError("목록을 불러오지 못했습니다.")
        }
      } finally {
        setLoadingItems(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (step === "files" && accessToken) {
      loadItems(accessToken, currentFolderId)
    }
  }, [step, accessToken, currentFolderId, loadItems])

  const navigateInto = (item: DriveItem) => {
    setFolderStack((prev) => [...prev, { id: item.id, name: item.name }])
  }
  const navigateTo = (index: number) => {
    setFolderStack((prev) => prev.slice(0, index))
  }

  const reset = () => {
    setStep("provider")
    setProvider(null)
    setConnecting(false)
    setConnectError("")
    setDriveItems([])
    setLoadingItems(false)
    setLoadError("")
    setSelectedIds(new Set())
    setFileProgresses(new Map())
    setDownloadedFiles(new Map())
    setSaveDirName("")
    setUsesIndividualFilePicker(false)
    setDestinationError("")
    setFinishing(false)
    setAccessToken(null)
    dirHandleRef.current = null
    fileHandlesRef.current.clear()
    setFolderStack([])
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleProviderSelect = async (p: CloudProvider) => {
    if (USE_MOCK_DRIVE) {
      setProvider(p)
      setConnecting(true)
      setConnectError("")
      await new Promise((resolve) => window.setTimeout(resolve, 550))
      setAccessToken(MOCK_DRIVE_TOKEN)
      setConnecting(false)
      setStep("files")
      return
    }

    // Reuse existing session token if valid
    const cached = getStoredToken()
    if (cached) {
      setProvider(p)
      setAccessToken(cached)
      setStep("files")
      return
    }

    setProvider(p)
    setConnecting(true)
    setConnectError("")

    // ── Production: Express server handles OAuth (full-page redirect) ──────
    if (HAS_SERVER) {
      signInViaServer()
      // Page will reload after redirect — no further state updates needed.
      return
    }

    // ── Development: popup-based PKCE / implicit flow ──────────────────────
    if (!GOOGLE_CLIENT_ID) {
      setConnecting(false)
      setConnectError(
        "VITE_GOOGLE_CLIENT_ID 환경 변수가 설정되지 않았습니다.\n(개발 환경에서는 .env에 Client ID가 필요합니다.)",
      )
      return
    }
    try {
      let token: string
      try {
        token = await signInWithGoogle(GOOGLE_CLIENT_ID)
      } catch {
        token = await signInImplicit(GOOGLE_CLIENT_ID)
      }
      setAccessToken(token)
      setConnecting(false)
      setStep("files")
    } catch (e: any) {
      setConnecting(false)
      if (e?.message === "AbortError") {
        setProvider(null)
        return
      }
      setConnectError(e?.message ?? "Google 로그인에 실패했습니다.")
    }
  }

  const toggleFile = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const downloadOneFile = async (
    token: string,
    item: DriveItem,
  ): Promise<File> => {
    const onProgress = (pct: number) => {
      setFileProgresses((prev) => new Map(prev).set(item.id, pct))
    }
    const blob =
      token === MOCK_DRIVE_TOKEN
        ? await downloadMockDriveFile(item.id, onProgress)
        : await downloadDriveFile(token, item.id, onProgress)
    const fileHandle = fileHandlesRef.current.get(item.id)
    if (fileHandle) return saveBlobToFileHandle(blob, fileHandle)
    if (dirHandleRef.current)
      return saveBlobToDirectory(blob, item.name, dirHandleRef.current)
    throw new Error("PUBLIC_DESTINATION_REQUIRED")
  }

  const handlePickDestination = async () => {
    if (selectedIds.size === 0 || !accessToken) return
    setDestinationError("")
    dirHandleRef.current = null
    fileHandlesRef.current.clear()
    const pickerWindow = window as typeof window & {
      showDirectoryPicker?: (options: {
        mode: "readwrite"
      }) => Promise<FileSystemDirectoryHandle>
      showSaveFilePicker?: (options: {
        suggestedName: string
        types: { description: string; accept: Record<string, string[]> }[]
      }) => Promise<FileSystemFileHandle>
    }

    try {
      if (pickerWindow.showDirectoryPicker) {
        const handle = await pickerWindow.showDirectoryPicker({
          mode: "readwrite",
        })
        dirHandleRef.current = handle
        setSaveDirName(handle.name)
        setUsesIndividualFilePicker(false)
        setStep("confirm")
        return
      }

      if (pickerWindow.showSaveFilePicker) {
        const selected = driveItems.filter((item) => selectedIds.has(item.id))
        for (const item of selected) {
          const handle = await pickerWindow.showSaveFilePicker({
            suggestedName: item.name,
            types: [
              {
                description: "오디오 파일",
                accept: {
                  [item.mimeType || "audio/*"]: [
                    `.${item.name.split(".").pop() ?? "wav"}`,
                  ],
                },
              },
            ],
          })
          fileHandlesRef.current.set(item.id, handle)
        }
        setSaveDirName("시스템에서 선택한 공개 위치")
        setUsesIndividualFilePicker(true)
        setStep("confirm")
        return
      }
    } catch (e: any) {
      if (e?.name === "AbortError") return
      setDestinationError(
        "시스템 저장 위치 선택기를 열 수 없습니다. 브라우저 또는 앱의 파일 접근 권한을 확인해주세요.",
      )
      return
    }

    setDestinationError(
      "현재 브라우저는 공개 저장 위치 선택을 지원하지 않습니다. Chrome 또는 Edge 데스크톱 환경이나 네이티브 앱에서 다시 시도해주세요.",
    )
  }

  const handleConfirmedDownload = async () => {
    if (selectedIds.size === 0 || !accessToken) return
    const selected = driveItems.filter((f) => selectedIds.has(f.id))
    const initial = new Map(selected.map((f) => [f.id, 0]))
    setFileProgresses(initial)
    setStep("downloading")

    const results = new Map<string, File>()
    const BATCH = 4
    for (let i = 0; i < selected.length; i += BATCH) {
      const batch = selected.slice(i, i + BATCH)
      await Promise.all(
        batch.map(async (item) => {
          try {
            const file = await downloadOneFile(accessToken, item)
            results.set(item.id, file)
          } catch {
            setFileProgresses((prev) => new Map(prev).set(item.id, -1))
          }
        }),
      )
    }

    setDownloadedFiles(results)
    setStep("done")
  }

  const handleFinish = async (shouldPlay: boolean) => {
    const files = Array.from(downloadedFiles.values())
    if (files.length === 0) {
      handleClose()
      return
    }
    setFinishing(true)
    await onComplete(files, dirHandleRef.current, saveDirName, shouldPlay)
    handleClose()
  }

  const handleSignOut = () => {
    if (accessToken === MOCK_DRIVE_TOKEN) {
      setAccessToken(null)
      setStep("provider")
      setProvider(null)
      setDriveItems([])
      setFolderStack([])
      setSelectedIds(new Set())
      return
    }
    if (HAS_SERVER) {
      signOutViaServer() // redirects to /auth/logout → clears hash → back to SPA
      return
    }
    clearToken()
    setAccessToken(null)
    setStep("provider")
    setProvider(null)
    setDriveItems([])
    setFolderStack([])
    setSelectedIds(new Set())
  }

  const visibleItems = driveItems
  const audioItems = visibleItems.filter((i) => i.mimeType !== FOLDER_MIME)
  const allSelected =
    audioItems.length > 0 && audioItems.every((i) => selectedIds.has(i.id))

  if (!open) return null

  return (
    <div className={`cloud-modal${open ? " open" : ""}`}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 16px 12px",
          borderBottom: "1px solid #2c2c2e",
          flexShrink: 0,
        }}
      >
        <button
          onClick={handleClose}
          style={{
            background: "none",
            border: "none",
            color: "#007AFF",
            fontSize: 16,
            cursor: "pointer",
            padding: "4px 0",
          }}
        >
          취소
        </button>
        <span style={{ fontWeight: 600, fontSize: 17, color: "#fff" }}>
          {step === "provider"
            ? "연결하기"
            : step === "files"
              ? "Google Drive"
              : step === "confirm"
                ? "저장 확인"
                : step === "downloading"
                  ? "다운로드 중"
                  : "완료"}
        </span>
        {step === "files" ? (
          <button
            onClick={handlePickDestination}
            disabled={selectedIds.size === 0}
            style={{
              background: "none",
              border: "none",
              color: selectedIds.size ? "#007AFF" : "#3a3a3c",
              fontSize: 16,
              cursor: selectedIds.size ? "pointer" : "default",
              fontWeight: 600,
            }}
          >
            다음
          </button>
        ) : (
          <div style={{ width: 48 }} />
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {/* Provider selection */}
        {step === "provider" && !connecting && (
          <div style={{ padding: 20 }}>
            <p
              style={{
                color: "#636366",
                fontSize: 13,
                marginBottom: 24,
                lineHeight: 1.6,
              }}
            >
              연결할 클라우드 드라이브를 선택하세요.
            </p>
            {USE_MOCK_DRIVE && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "#102a1a",
                  border: "1px solid #245c38",
                  borderRadius: 9,
                  padding: "9px 11px",
                  color: "#64d98b",
                  fontSize: 11,
                  marginBottom: 14,
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "#22c55e",
                    boxShadow: "0 0 8px #22c55e",
                  }}
                />
                로컬 Mock 환경 · Google 로그인 성공 상태로 테스트합니다
              </div>
            )}
            {connectError && (
              <div
                style={{
                  background: "#2a1010",
                  border: "1px solid #5a2020",
                  borderRadius: 10,
                  padding: "10px 14px",
                  fontSize: 12,
                  color: "#ff6b6b",
                  marginBottom: 16,
                  lineHeight: 1.5,
                }}
              >
                {connectError}
              </div>
            )}
            <div
              className="sheet-row"
              style={{
                background: "#2c2c2e",
                borderRadius: 12,
                marginBottom: 10,
                padding: "14px 16px",
              }}
              onClick={() => handleProviderSelect("google")}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: "#1c1c1e",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <DriveIcon />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#fff", fontWeight: 600, fontSize: 15 }}>
                  Google Drive
                </div>
                <div style={{ color: "#636366", fontSize: 12, marginTop: 2 }}>
                  {USE_MOCK_DRIVE
                    ? "테스트 계정으로 바로 연결"
                    : "Google 계정으로 연결"}
                </div>
              </div>
              <ChevronRight />
            </div>
          </div>
        )}

        {/* OAuth connecting spinner */}
        {connecting && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: 300,
              gap: 16,
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
              />
            </svg>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "#636366",
                letterSpacing: "0.06em",
              }}
            >
              {USE_MOCK_DRIVE
                ? "테스트 계정 연결 중..."
                : "Google 로그인 중..."}
            </span>
            <span
              style={{
                fontSize: 11,
                color: "#48484a",
                maxWidth: 220,
                textAlign: "center",
                lineHeight: 1.5,
              }}
            >
              {USE_MOCK_DRIVE
                ? "로컬 Mock Drive를 준비하고 있습니다"
                : "팝업 창에서 Google 계정으로 로그인하세요"}
            </span>
          </div>
        )}

        {/* File browser */}
        {step === "files" && (
          <div>
            {/* Breadcrumb + sign-out */}
            <div
              style={{
                padding: "10px 20px 8px",
                display: "flex",
                alignItems: "center",
                gap: 4,
                flexWrap: "wrap",
              }}
            >
              <button
                onClick={() => navigateTo(0)}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={folderStack.length === 0 ? "#e0e0e0" : "#636366"}
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: folderStack.length === 0 ? "#e0e0e0" : "#636366",
                    letterSpacing: "0.04em",
                  }}
                >
                  내 드라이브
                </span>
              </button>
              {folderStack.map((seg, idx) => (
                <span
                  key={seg.id}
                  style={{ display: "flex", alignItems: "center", gap: 4 }}
                >
                  <svg
                    width="6"
                    height="10"
                    viewBox="0 0 6 10"
                    fill="none"
                    stroke="#444"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  >
                    <polyline points="1,1 5,5 1,9" />
                  </svg>
                  <button
                    onClick={() => navigateTo(idx + 1)}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color:
                        idx === folderStack.length - 1 ? "#e0e0e0" : "#636366",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {seg.name}
                  </button>
                </span>
              ))}
              <button
                onClick={handleSignOut}
                title="로그아웃"
                style={{
                  marginLeft: "auto",
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#48484a"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>

            {/* Toolbar */}
            <div
              style={{
                padding: "4px 20px 8px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid #2c2c2e",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "#48484a",
                  letterSpacing: "0.04em",
                }}
              >
                {loadingItems
                  ? "불러오는 중..."
                  : `${audioItems.length}개 파일 · ${
                      selectedIds.size > 0
                        ? `${selectedIds.size}개 선택됨`
                        : "선택 안됨"
                    }`}
              </span>
              {audioItems.length > 0 && (
                <button
                  onClick={() => {
                    if (allSelected) setSelectedIds(new Set())
                    else setSelectedIds(new Set(audioItems.map((i) => i.id)))
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#007AFF",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  {allSelected ? "전체 해제" : "전체 선택"}
                </button>
              )}
            </div>

            {destinationError && (
              <div
                style={{
                  margin: "10px 20px 2px",
                  padding: "10px 12px",
                  background: "#331c12",
                  border: "1px solid #704022",
                  borderRadius: 9,
                  color: "#ffb267",
                  fontSize: 12,
                  lineHeight: 1.55,
                }}
              >
                {destinationError}
              </div>
            )}

            {/* Loading spinner */}
            {loadingItems && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  padding: 40,
                }}
              >
                <svg
                  width="32"
                  height="32"
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
                  />
                </svg>
              </div>
            )}

            {/* Error */}
            {loadError && !loadingItems && (
              <div style={{ padding: "20px", textAlign: "center" }}>
                <div
                  style={{ color: "#ff6b6b", fontSize: 13, marginBottom: 12 }}
                >
                  {loadError}
                </div>
                <button
                  onClick={() =>
                    accessToken && loadItems(accessToken, currentFolderId)
                  }
                  style={{
                    background: "#2c2c2e",
                    border: "none",
                    borderRadius: 8,
                    padding: "8px 16px",
                    color: "#007AFF",
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  다시 시도
                </button>
              </div>
            )}

            {/* Empty state */}
            {!loadingItems && !loadError && visibleItems.length === 0 && (
              <div
                style={{
                  padding: "40px 20px",
                  textAlign: "center",
                  color: "#48484a",
                  fontSize: 13,
                }}
              >
                이 폴더는 비어 있습니다.
              </div>
            )}

            {/* File/folder rows */}
            {!loadingItems &&
              visibleItems.map((item) => {
                const isFolder = item.mimeType === FOLDER_MIME
                const selected = selectedIds.has(item.id)
                const date = new Date(item.modifiedTime).toLocaleDateString(
                  "ko-KR",
                  { month: "short", day: "numeric" },
                )

                if (isFolder) {
                  return (
                    <div
                      key={item.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        padding: "11px 20px",
                        borderBottom: "1px solid #1c1c1e",
                        cursor: "pointer",
                        background: "transparent",
                        transition: "background 0.1s",
                      }}
                      onClick={() => navigateInto(item)}
                    >
                      <DriveFolderIcon />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            color: "#e0e0e0",
                            fontSize: 14,
                            fontWeight: 500,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {item.name}
                        </div>
                        <div
                          style={{
                            color: "#48484a",
                            fontSize: 11,
                            marginTop: 2,
                          }}
                        >
                          폴더 · {date}
                        </div>
                      </div>
                      <svg
                        width="8"
                        height="13"
                        viewBox="0 0 8 13"
                        fill="none"
                        stroke="#48484a"
                        strokeWidth="2"
                        strokeLinecap="round"
                      >
                        <polyline points="1,1 7,6.5 1,12" />
                      </svg>
                    </div>
                  )
                }

                return (
                  <div
                    key={item.id}
                    onClick={() => toggleFile(item.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: "11px 20px",
                      borderBottom: "1px solid #1c1c1e",
                      cursor: "pointer",
                      background: selected
                        ? "rgba(0,122,255,0.08)"
                        : "transparent",
                      transition: "background 0.1s",
                    }}
                  >
                    <DriveFileIcon mimeType={item.mimeType} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          color: "#fff",
                          fontSize: 14,
                          fontWeight: 500,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.name}
                      </div>
                      <div
                        style={{
                          color: "#48484a",
                          fontSize: 11,
                          marginTop: 3,
                          display: "flex",
                          gap: 6,
                        }}
                      >
                        <span>{item.size ? formatBytes(item.size) : "—"}</span>
                        <span style={{ color: "#333" }}>·</span>
                        <span>{date}</span>
                      </div>
                    </div>
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        flexShrink: 0,
                        border: `2px solid ${selected ? "#007AFF" : "#3a3a3c"}`,
                        background: selected ? "#007AFF" : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.15s",
                      }}
                    >
                      {selected && <CheckIcon size={11} />}
                    </div>
                  </div>
                )
              })}
          </div>
        )}

        {/* Download confirmation */}
        {step === "confirm" && (
          <div
            style={{
              minHeight: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
            }}
          >
            <div
              style={{
                width: "min(420px, 100%)",
                background: "#242426",
                border: "1px solid #3a3a3c",
                borderRadius: 16,
                padding: 22,
                boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  margin: "0 auto 14px",
                  background: "#132d4b",
                  color: "#4da3ff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <FileFolderIcon />
              </div>
              <div
                style={{
                  color: "#fff",
                  fontWeight: 650,
                  fontSize: 17,
                  textAlign: "center",
                }}
              >
                선택한 음원을 다운로드할까요?
              </div>
              <div
                style={{
                  color: "#8e8e93",
                  fontSize: 13,
                  lineHeight: 1.6,
                  textAlign: "center",
                  marginTop: 8,
                }}
              >
                {selectedIds.size}개 파일을{" "}
                <strong style={{ color: "#d1d1d6" }}>{saveDirName}</strong>에
                저장합니다.
              </div>
              {usesIndividualFilePicker && (
                <div
                  style={{
                    color: "#70b7ff",
                    fontSize: 11,
                    lineHeight: 1.55,
                    background: "#132a42",
                    borderRadius: 8,
                    padding: "9px 10px",
                    marginTop: 14,
                  }}
                >
                  디렉터리 선택을 지원하지 않는 환경이므로 각 파일에 대해 시스템
                  팝업에서 선택한 공개 위치를 사용합니다.
                </div>
              )}
              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button
                  onClick={() => setStep("files")}
                  style={{
                    flex: 1,
                    padding: "12px",
                    border: "none",
                    borderRadius: 10,
                    background: "#3a3a3c",
                    color: "#fff",
                    fontSize: 15,
                    cursor: "pointer",
                  }}
                >
                  취소
                </button>
                <button
                  onClick={handleConfirmedDownload}
                  style={{
                    flex: 1,
                    padding: "12px",
                    border: "none",
                    borderRadius: 10,
                    background: "#007AFF",
                    color: "#fff",
                    fontSize: 15,
                    fontWeight: 650,
                    cursor: "pointer",
                  }}
                >
                  다운로드
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Per-file download progress */}
        {step === "downloading" && (
          <div style={{ padding: "16px 20px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 16,
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 44 44"
                style={{
                  animation: "spin 0.9s linear infinite",
                  flexShrink: 0,
                }}
              >
                <circle
                  cx="22"
                  cy="22"
                  r="18"
                  fill="none"
                  stroke="#2a2a2a"
                  strokeWidth="4"
                />
                <circle
                  cx="22"
                  cy="22"
                  r="18"
                  fill="none"
                  stroke="#007AFF"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray="28 85"
                />
              </svg>
              <span style={{ color: "#fff", fontWeight: 600, fontSize: 15 }}>
                다운로드 중
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "#636366",
                  marginLeft: "auto",
                }}
              >
                {
                  Array.from(fileProgresses.values()).filter((p) => p >= 100)
                    .length
                }{" "}
                / {fileProgresses.size} 완료
              </span>
            </div>
            {saveDirName && (
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "#48484a",
                  marginBottom: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 22"
                  fill="none"
                  stroke="#48484a"
                  strokeWidth="1.5"
                >
                  <path d="M2 5a2 2 0 0 1 2-2h4l2.5 3H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5z" />
                </svg>
                {saveDirName}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {driveItems
                .filter((f) => fileProgresses.has(f.id))
                .map((file) => {
                  const pct = fileProgresses.get(file.id) ?? 0
                  const failed = pct === -1
                  const done = pct >= 100
                  return (
                    <div key={file.id}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 5,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            minWidth: 0,
                          }}
                        >
                          {done ? (
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="#22c55e"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              style={{ flexShrink: 0 }}
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : failed ? (
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="#ef4444"
                              strokeWidth="2"
                              strokeLinecap="round"
                              style={{ flexShrink: 0 }}
                            >
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          ) : (
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="#007AFF"
                              strokeWidth="2"
                              strokeLinecap="round"
                              style={{ flexShrink: 0 }}
                            >
                              <path d="M12 2v10M12 12l-3-3m3 3l3-3" />
                              <path d="M2 17l.621 2.485A2 2 0 0 0 4.561 21h14.878a2 2 0 0 0 1.94-1.515L22 17" />
                            </svg>
                          )}
                          <span
                            style={{
                              fontSize: 13,
                              color: done
                                ? "#8e8e93"
                                : failed
                                  ? "#ef4444"
                                  : "#fff",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {file.name}
                          </span>
                        </div>
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 11,
                            color: done
                              ? "#22c55e"
                              : failed
                                ? "#ef4444"
                                : "#636366",
                            flexShrink: 0,
                            marginLeft: 8,
                          }}
                        >
                          {done
                            ? "완료"
                            : failed
                              ? "오류"
                              : `${Math.round(pct)}%`}
                        </span>
                      </div>
                      <div
                        style={{
                          background: "#2c2c2e",
                          borderRadius: 3,
                          height: 4,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            borderRadius: 3,
                            background: done
                              ? "#22c55e"
                              : failed
                                ? "#ef4444"
                                : "#007AFF",
                            width: `${failed ? 100 : pct}%`,
                            transition: "width 0.07s linear",
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        )}

        {/* Done */}
        {step === "done" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: 40,
              gap: 16,
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "#1a3a1a",
                border: "2px solid #22c55e",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#22c55e"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ color: "#fff", fontWeight: 600, fontSize: 17 }}>
                다운로드 완료
              </div>
              <div style={{ color: "#636366", fontSize: 13, marginTop: 6 }}>
                {downloadedFiles.size}개 파일이 저장되었습니다.
              </div>
            </div>
            <div
              style={{
                color: "#fff",
                fontSize: 16,
                fontWeight: 600,
                marginTop: 8,
              }}
            >
              지금 재생하시겠습니까?
            </div>
            <div
              style={{ display: "flex", gap: 10, width: "min(320px, 100%)" }}
            >
              <button
                disabled={finishing}
                onClick={() => handleFinish(false)}
                style={{
                  flex: 1,
                  padding: "12px",
                  border: "none",
                  borderRadius: 10,
                  background: "#3a3a3c",
                  color: "#fff",
                  fontSize: 15,
                  cursor: "pointer",
                  opacity: finishing ? 0.5 : 1,
                }}
              >
                아니요
              </button>
              <button
                disabled={finishing}
                onClick={() => handleFinish(true)}
                style={{
                  flex: 1,
                  padding: "12px",
                  border: "none",
                  borderRadius: 10,
                  background: "#22c55e",
                  color: "#06160a",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: "pointer",
                  opacity: finishing ? 0.5 : 1,
                }}
              >
                {finishing ? "저장 중..." : "예"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
