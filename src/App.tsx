import { useState, useRef, useEffect, useCallback } from "react"
import {
  signInWithGoogle,
  signInImplicit,
  clearToken,
  getStoredToken,
  listDriveItems,
  downloadDriveFile,
  saveBlobToDirectory,
  FOLDER_MIME,
  type GDriveItem,
} from "./googleDrive"

// Google OAuth Client ID — set via environment variable
// In Google Cloud Console: create OAuth 2.0 Web client, add your origin to Authorized JS origins
// and add <origin>/oauth/callback to Authorized redirect URIs
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ""

// UUID
function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

// ── Playlist Types ─────────────────────────────────────────────────────────

interface Playlist {
  id: string
  name: string
  createdAt: number
}

type SortOrder = "name" | "date"

// ── Playlist Screen ────────────────────────────────────────────────────────

function PlaylistMusicIcon() {
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

function PlaylistScreen({
  playlists,
  onOpen,
  onCreate,
  onRename,
  onDelete,
  onSort,
  sortOrder,
}: {
  playlists: Playlist[]
  onOpen: (id: string) => void
  onCreate: (name: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onSort: (order: SortOrder) => void
  sortOrder: SortOrder
}) {
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [showCreateSheet, setShowCreateSheet] = useState(false)
  const [createName, setCreateName] = useState("")
  const [cardMenuId, setCardMenuId] = useState<string | null>(null)
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const handleCreateSubmit = () => {
    const name = createName.trim()
    if (!name) return
    onCreate(name)
    setCreateName("")
    setShowCreateSheet(false)
  }

  const handleCardMenu = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setCardMenuId(id)
  }

  const handleRenameStart = (pl: Playlist) => {
    setCardMenuId(null)
    setRenameValue(pl.name)
    setRenameId(pl.id)
  }

  const handleRenameSubmit = () => {
    if (renameId && renameValue.trim()) {
      onRename(renameId, renameValue.trim())
    }
    setRenameId(null)
  }

  const handleDeleteStart = (id: string) => {
    setCardMenuId(null)
    setDeleteConfirmId(id)
  }

  const handleDeleteConfirm = () => {
    if (deleteConfirmId) onDelete(deleteConfirmId)
    setDeleteConfirmId(null)
  }

  const sorted = [...playlists].sort((a, b) =>
    sortOrder === "name" ? a.name.localeCompare(b.name) : b.createdAt - a.createdAt
  )

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#000", overflow: "hidden" }}>
      {/* Top bar */}
      <div className="playlist-topbar" style={{ padding: "16px 16px 10px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* + button */}
          <button
            onClick={() => { setCreateName(""); setShowCreateSheet(true) }}
            style={{
              width: 44, height: 44, borderRadius: "50%",
              background: "#1c1c1e", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
              <line x1="9" y1="2" x2="9" y2="16" /><line x1="2" y1="9" x2="16" y2="9" />
            </svg>
          </button>

          {/* Title pill */}
          <div style={{
            fontWeight: 600, fontSize: 16, color: "#fff",
          }}>
            재생 목록
          </div>

          {/* ... button */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowSortMenu((v) => !v)}
              style={{
                width: 44, height: 44, borderRadius: "50%",
                background: "#1c1c1e", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
              }}
            >
              <svg width="18" height="5" viewBox="0 0 18 5" fill="white">
                <circle cx="2" cy="2.5" r="2" /><circle cx="9" cy="2.5" r="2" /><circle cx="16" cy="2.5" r="2" />
              </svg>
            </button>
            {showSortMenu && (
              <div style={{
                position: "absolute", right: 0, top: 50, zIndex: 100,
                background: "#1c1c1e", borderRadius: 12, overflow: "hidden",
                boxShadow: "0 8px 32px rgba(0,0,0,0.7)", minWidth: 160,
                border: "1px solid #2c2c2e",
              }}>
                <div
                  onClick={() => { onSort("name"); setShowSortMenu(false) }}
                  style={{
                    padding: "13px 18px", cursor: "pointer", color: sortOrder === "name" ? "#007AFF" : "#fff",
                    fontSize: 15, display: "flex", alignItems: "center", justifyContent: "space-between",
                    borderBottom: "1px solid #2c2c2e",
                  }}
                >
                  이름순
                  {sortOrder === "name" && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
                <div
                  onClick={() => { onSort("date"); setShowSortMenu(false) }}
                  style={{
                    padding: "13px 18px", cursor: "pointer", color: sortOrder === "date" ? "#007AFF" : "#fff",
                    fontSize: 15, display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}
                >
                  날짜순
                  {sortOrder === "date" && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Playlist grid */}
      <div className="playlist-scroll safe-bottom" style={{ flex: 1, overflowY: "auto", padding: "10px 16px" }}>
        <div className="playlist-content">
        {playlists.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60%", gap: 14, opacity: 0.4 }}>
            <PlaylistMusicIcon />
            <p style={{ color: "#666", fontSize: 14, margin: 0, textAlign: "center", lineHeight: 1.6 }}>
              재생 목록이 없습니다.<br />+ 버튼을 눌러 추가하세요.
            </p>
          </div>
        ) : (
          <div className="playlist-grid">
            {sorted.map((pl) => (
              <div key={pl.id} onClick={() => onOpen(pl.id)} style={{ cursor: "pointer" }}>
                {/* Card */}
                <div style={{
                  background: "#1c1c1e", borderRadius: 12,
                  aspectRatio: "1/1", position: "relative",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  overflow: "hidden",
                }}>
                  <PlaylistMusicIcon />
                  <button
                    onClick={(e) => handleCardMenu(pl.id, e)}
                    style={{
                      position: "absolute", bottom: 8, right: 8,
                      background: "rgba(0,0,0,0.5)", border: "none",
                      borderRadius: "50%", width: 28, height: 28,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", color: "#fff",
                    }}
                  >
                    <svg width="14" height="4" viewBox="0 0 14 4" fill="white">
                      <circle cx="2" cy="2" r="1.5"/><circle cx="7" cy="2" r="1.5"/><circle cx="12" cy="2" r="1.5"/>
                    </svg>
                  </button>
                </div>
                {/* Label */}
                <div style={{ marginTop: 8 }}>
                  {renameId === pl.id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={handleRenameSubmit}
                      onKeyDown={(e) => { if (e.key === "Enter") handleRenameSubmit(); if (e.key === "Escape") setRenameId(null) }}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        width: "100%", background: "#1c1c1e", border: "1px solid #007AFF",
                        borderRadius: 6, padding: "4px 8px", color: "#fff",
                        fontSize: 14, fontWeight: 600, outline: "none",
                      }}
                    />
                  ) : (
                    <div style={{ fontWeight: 600, fontSize: 14, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {pl.name}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
                    {new Date(pl.createdAt).toLocaleDateString("ko-KR")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer count */}
        {playlists.length > 0 && (
          <div style={{ textAlign: "center", padding: "24px 0 12px", color: "#444", fontSize: 13 }}>
            재생 목록 ({playlists.length})
          </div>
        )}
        </div>{/* /playlist-content */}
      </div>

      {/* Overlays */}
      {showSortMenu && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50 }} onClick={() => setShowSortMenu(false)} />
      )}

      {/* Card context menu */}
      {cardMenuId && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 200 }} onClick={() => setCardMenuId(null)} />
          <div style={{
            position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 201,
            background: "#1c1c1e", borderRadius: "14px 14px 0 0",
            padding: "12px 16px calc(16px + env(safe-area-inset-bottom, 0px))",
          }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "#48484a" }} />
            </div>
            <div style={{ background: "#2c2c2e", borderRadius: 12, overflow: "hidden" }}>
              <div
                onClick={() => {
                  const pl = playlists.find((p) => p.id === cardMenuId)
                  if (pl) handleRenameStart(pl)
                }}
                style={{
                  padding: "15px 18px", cursor: "pointer", color: "#fff", fontSize: 16,
                  borderBottom: "1px solid #3a3a3c",
                  display: "flex", alignItems: "center", gap: 14,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                이름 바꾸기
              </div>
              <div
                onClick={() => handleDeleteStart(cardMenuId)}
                style={{
                  padding: "15px 18px", cursor: "pointer", color: "#ef4444", fontSize: 16,
                  display: "flex", alignItems: "center", gap: 14,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>
                삭제
              </div>
            </div>
            <button
              onClick={() => setCardMenuId(null)}
              style={{
                width: "100%", marginTop: 10, padding: "14px", background: "#2c2c2e",
                border: "none", borderRadius: 12, color: "#fff", fontSize: 16, fontWeight: 600, cursor: "pointer",
              }}
            >
              취소
            </button>
          </div>
        </>
      )}

      {/* Delete confirm */}
      {deleteConfirmId && (
        <>
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 300 }} />
          <div style={{
            position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 301,
            background: "#1c1c1e", borderRadius: "14px 14px 0 0",
            padding: "20px 16px calc(20px + env(safe-area-inset-bottom, 0px))",
          }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "#48484a" }} />
            </div>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 17, fontWeight: 600, color: "#fff", marginBottom: 8 }}>재생 목록 삭제</div>
              <div style={{ fontSize: 14, color: "#888", lineHeight: 1.5 }}>
                "{playlists.find((p) => p.id === deleteConfirmId)?.name}" 재생 목록을<br />삭제하시겠습니까?
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setDeleteConfirmId(null)}
                style={{
                  flex: 1, padding: "14px", background: "#2c2c2e",
                  border: "none", borderRadius: 12, color: "#fff", fontSize: 16, fontWeight: 500, cursor: "pointer",
                }}
              >
                취소
              </button>
              <button
                onClick={handleDeleteConfirm}
                style={{
                  flex: 1, padding: "14px", background: "#ef4444",
                  border: "none", borderRadius: 12, color: "#fff", fontSize: 16, fontWeight: 600, cursor: "pointer",
                }}
              >
                삭제
              </button>
            </div>
          </div>
        </>
      )}

      {/* Create playlist alert */}
      {showCreateSheet && (
        <>
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, backdropFilter: "blur(4px)" }}
            onClick={() => setShowCreateSheet(false)}
          />
          <div style={{
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            zIndex: 301, width: "min(280px, calc(100vw - 48px))",
            background: "#2c2c2e", borderRadius: 14,
            overflow: "hidden",
            boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
          }}>
            {/* Alert title + message */}
            <div style={{ padding: "20px 16px 12px", textAlign: "center" }}>
              <div style={{ fontSize: 17, fontWeight: 600, color: "#fff", marginBottom: 4 }}>
                새 재생 목록
              </div>
              <div style={{ fontSize: 13, color: "#8e8e93", marginBottom: 16, lineHeight: 1.4 }}>
                재생 목록 이름을 입력하세요.
              </div>
              <input
                autoFocus
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreateSubmit(); if (e.key === "Escape") setShowCreateSheet(false) }}
                placeholder="목록 이름"
                style={{
                  width: "100%", background: "#1c1c1e", border: "1px solid #48484a",
                  borderRadius: 8, padding: "10px 12px", color: "#fff",
                  fontSize: 15, outline: "none", boxSizing: "border-box",
                }}
              />
            </div>
            {/* Buttons */}
            <div style={{ display: "flex", borderTop: "1px solid #48484a" }}>
              <button
                onClick={() => setShowCreateSheet(false)}
                style={{
                  flex: 1, padding: "14px", background: "none", border: "none",
                  borderRight: "1px solid #48484a",
                  color: "#fff", fontSize: 16, fontWeight: 400, cursor: "pointer",
                }}
              >
                취소
              </button>
              <button
                onClick={handleCreateSubmit}
                disabled={!createName.trim()}
                style={{
                  flex: 1, padding: "14px", background: "none", border: "none",
                  color: createName.trim() ? "#007AFF" : "#48484a",
                  fontSize: 16, fontWeight: 600,
                  cursor: createName.trim() ? "pointer" : "default",
                  transition: "color 0.15s",
                }}
              >
                생성
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Add File Sheet ─────────────────────────────────────────────────────────

function GlobeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
}
function FileFolderIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="#007AFF">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    </svg>
  )
}
function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2.5" strokeLinecap="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}
function DriveIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 87.3 78">
      <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0a7.9 7.9 0 0 0 1.05 4z" fill="#0066da"/>
      <path d="M43.65 25L29.9 1.2a8.2 8.2 0 0 0-3.3 3.3L1.05 49.15A7.9 7.9 0 0 0 0 53h27.5z" fill="#00ac47"/>
      <path d="M73.55 76.8a8.2 8.2 0 0 0 3.3-3.3l1.6-2.75 7.65-13.25A7.9 7.9 0 0 0 87.3 53H59.8l5.85 11.5z" fill="#ea4335"/>
      <path d="M43.65 25L57.4 1.2A8.4 8.4 0 0 0 53.35 0H33.95a8.4 8.4 0 0 0-4.05 1.2z" fill="#00832d"/>
      <path d="M59.8 53H87.3a7.9 7.9 0 0 0-1.05-4L72.5 24.5l-3.65-6.35-13.75 23.8z" fill="#2684fc"/>
      <path d="M27.5 53l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h51.4c1.6 0 3.15-.45 4.5-1.2L59.8 53z" fill="#ffba00"/>
    </svg>
  )
}
function DropboxIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 256 218">
      <path d="M64 0L0 41l64 41 64-41zM192 0l-64 41 64 41 64-41zM0 123l64 41 64-41-64-41zM256 123l-64 41-64-41 64-41zM64 177l64 41 64-41-64-41z" fill="#0061FF"/>
    </svg>
  )
}
function OneDriveIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="#0078D4">
      <path d="M20.5 11A4.5 4.5 0 0 0 16.3 8a5.5 5.5 0 0 0-10.8 1.5A4 4 0 0 0 4 17.5h16.5a3 3 0 0 0 0-6z"/>
    </svg>
  )
}
function CheckIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

interface AddFileSheetProps {
  open: boolean
  onClose: () => void
  onPickFiles: () => void
  onConnect: () => void
}

function AddFileSheet({ open, onClose, onPickFiles, onConnect }: AddFileSheetProps) {
  return (
    <>
      <div className={`sheet-overlay${open ? " open" : ""}`} onClick={onClose} />
      <div className={`add-file-sheet${open ? " open" : ""}`}>
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "#48484a" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px 16px" }}>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: "50%", background: "#3a3a3c", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="1" y1="1" x2="13" y2="13" /><line x1="13" y1="1" x2="1" y2="13" />
            </svg>
          </button>
          <span style={{ fontWeight: 600, fontSize: 16, color: "#fff" }}>파일 추가하기</span>
          <div style={{ width: 32 }} />
        </div>
        <div style={{ padding: "0 20px 8px", fontFamily: "var(--font-mono)", fontSize: 11, color: "#636366", letterSpacing: "0.06em" }}>
          위치
        </div>
        <div style={{ background: "#2c2c2e", borderRadius: 12, margin: "0 16px 16px" }}>
          <div className="sheet-row" onClick={() => { onClose(); setTimeout(onPickFiles, 300) }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "#1c3a5e", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <FileFolderIcon />
            </div>
            <span style={{ flex: 1, fontSize: 16, color: "#fff", fontWeight: 500 }}>파일 가져오기</span>
            <ChevronRight />
          </div>
          <div className="sheet-row" onClick={() => { onClose(); setTimeout(onConnect, 300) }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "#0a2a3a", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <GlobeIcon />
            </div>
            <span style={{ flex: 1, fontSize: 16, color: "#fff", fontWeight: 500 }}>연결하기</span>
            <ChevronRight />
          </div>
        </div>
        <div style={{ padding: "0 20px 20px", fontSize: 12, color: "#636366", lineHeight: 1.6 }}>
          <p style={{ margin: "0 0 6px" }}>• <b style={{ color: "#8e8e93" }}>파일 가져오기:</b> 기기에 저장된 음원 파일을 직접 불러옵니다.</p>
          <p style={{ margin: 0 }}>• <b style={{ color: "#8e8e93" }}>연결하기:</b> 클라우드 드라이브에서 파일을 선택하고 다운로드합니다.</p>
        </div>
      </div>
    </>
  )
}

// ── Cloud Connect Modal ────────────────────────────────────────────────────

type CloudStep = "provider" | "files" | "downloading" | "done"
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
  const ext = mimeType === "audio/mpeg" ? "MP3" : (mimeType === "audio/aiff" || mimeType === "audio/x-aiff") ? "AIF" : "WAV"
  const color = "#f97316"
  return (
    <div style={{ width: 38, height: 38, borderRadius: 8, background: `${color}22`, border: `1px solid ${color}44`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
        <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
      </svg>
      <span style={{ fontSize: 7, fontWeight: 700, color, marginTop: 2, letterSpacing: "0.04em" }}>{ext}</span>
    </div>
  )
}

function DriveFolderIcon() {
  return (
    <div style={{ width: 38, height: 38, borderRadius: 8, background: "#1a2a10", border: "1px solid #2a4a20", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <svg width="20" height="18" viewBox="0 0 24 22" fill="none">
        <path d="M2 5a2 2 0 0 1 2-2h4l2.5 3H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5z" fill="#4ade80" opacity="0.25"/>
        <path d="M2 5a2 2 0 0 1 2-2h4l2.5 3H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5z" stroke="#4ade80" strokeWidth="1.5" fill="none"/>
      </svg>
    </div>
  )
}

interface CloudConnectModalProps {
  open: boolean
  onClose: () => void
  onImport: (files: File[]) => void
  realFileInputRef: React.RefObject<HTMLInputElement | null>
}

function CloudConnectModal({ open, onClose, onImport, realFileInputRef }: CloudConnectModalProps) {
  const [step, setStep] = useState<CloudStep>("provider")
  const [provider, setProvider] = useState<CloudProvider | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState("")
  const [driveItems, setDriveItems] = useState<DriveItem[]>([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [loadError, setLoadError] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [fileProgresses, setFileProgresses] = useState<Map<string, number>>(new Map())
  const [downloadedFiles, setDownloadedFiles] = useState<Map<string, File>>(new Map())
  const [saveDirName, setSaveDirName] = useState("")
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const dirHandleRef = useRef<FileSystemDirectoryHandle | null>(null)
  const [folderStack, setFolderStack] = useState<{ id: string; name: string }[]>([])

  const currentFolderId = folderStack.length > 0 ? folderStack[folderStack.length - 1].id : null

  // Load Drive items whenever folder changes or token arrives
  const loadItems = useCallback(async (token: string, folderId: string | null) => {
    setLoadingItems(true)
    setLoadError("")
    try {
      const items = await listDriveItems(token, folderId)
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
  }, [])

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
    setStep("provider"); setProvider(null); setConnecting(false); setConnectError("")
    setDriveItems([]); setLoadingItems(false); setLoadError("")
    setSelectedIds(new Set()); setFileProgresses(new Map()); setDownloadedFiles(new Map())
    setSaveDirName(""); setAccessToken(null)
    dirHandleRef.current = null; setFolderStack([])
  }

  const handleClose = () => { reset(); onClose() }

  const handleProviderSelect = async (p: CloudProvider) => {
    if (!GOOGLE_CLIENT_ID) {
      setConnectError("VITE_GOOGLE_CLIENT_ID 환경 변수가 설정되지 않았습니다.")
      return
    }
    // Reuse existing session token if valid
    const cached = getStoredToken()
    if (cached) {
      setProvider(p); setAccessToken(cached); setStep("files")
      return
    }
    setProvider(p); setConnecting(true); setConnectError("")
    try {
      // Try PKCE flow first; fall back to implicit if token endpoint is blocked (e.g. no callback page)
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
      if (e?.message === "AbortError") { setProvider(null); return }
      setConnectError(e?.message ?? "Google 로그인에 실패했습니다.")
    }
  }

  const toggleFile = (id: string) => {
    setSelectedIds((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  const downloadOneFile = async (token: string, item: DriveItem): Promise<File> => {
    const blob = await downloadDriveFile(token, item.id, (pct) => {
      setFileProgresses((prev) => new Map(prev).set(item.id, pct))
    })
    const file = await saveBlobToDirectory(blob, item.name, dirHandleRef.current)
    return file
  }

  const handlePickAndDownload = async () => {
    if (selectedIds.size === 0 || !accessToken) return
    let dirName = "다운로드 폴더"
    try {
      if ("showDirectoryPicker" in window) {
        const handle = await (window as any).showDirectoryPicker({ mode: "readwrite" })
        dirHandleRef.current = handle
        dirName = handle.name
      }
    } catch (e: any) {
      if (e?.name === "AbortError") return
    }
    setSaveDirName(dirName)
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
        })
      )
    }

    setDownloadedFiles(results)
    setStep("done")
    setTimeout(() => {
      const files = Array.from(results.values())
      if (files.length > 0) onImport(files)
      handleClose()
    }, 1200)
  }

  const handleSignOut = () => {
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
  const allSelected = audioItems.length > 0 && audioItems.every((i) => selectedIds.has(i.id))

  if (!open) return null

  return (
    <div className={`cloud-modal${open ? " open" : ""}`}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 16px 12px", borderBottom: "1px solid #2c2c2e", flexShrink: 0 }}>
        <button onClick={handleClose} style={{ background: "none", border: "none", color: "#007AFF", fontSize: 16, cursor: "pointer", padding: "4px 0" }}>취소</button>
        <span style={{ fontWeight: 600, fontSize: 17, color: "#fff" }}>
          {step === "provider" ? "연결하기" : step === "files" ? "Google Drive" : step === "downloading" ? "다운로드 중" : "완료"}
        </span>
        {step === "files" ? (
          <button onClick={handlePickAndDownload} disabled={selectedIds.size === 0} style={{ background: "none", border: "none", color: selectedIds.size ? "#007AFF" : "#3a3a3c", fontSize: 16, cursor: selectedIds.size ? "pointer" : "default", fontWeight: 600 }}>다음</button>
        ) : (
          <div style={{ width: 48 }} />
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {/* Provider selection */}
        {step === "provider" && !connecting && (
          <div style={{ padding: 20 }}>
            <p style={{ color: "#636366", fontSize: 13, marginBottom: 24, lineHeight: 1.6 }}>연결할 클라우드 드라이브를 선택하세요.</p>
            {connectError && (
              <div style={{ background: "#2a1010", border: "1px solid #5a2020", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#ff6b6b", marginBottom: 16, lineHeight: 1.5 }}>
                {connectError}
              </div>
            )}
            <div className="sheet-row" style={{ background: "#2c2c2e", borderRadius: 12, marginBottom: 10, padding: "14px 16px" }} onClick={() => handleProviderSelect("google")}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "#1c1c1e", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><DriveIcon /></div>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#fff", fontWeight: 600, fontSize: 15 }}>Google Drive</div>
                <div style={{ color: "#636366", fontSize: 12, marginTop: 2 }}>Google 계정으로 연결</div>
              </div>
              <ChevronRight />
            </div>
          </div>
        )}

        {/* OAuth connecting spinner */}
        {connecting && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 300, gap: 16 }}>
            <svg width="44" height="44" viewBox="0 0 44 44" style={{ animation: "spin 0.9s linear infinite" }}>
              <circle cx="22" cy="22" r="18" fill="none" stroke="#2a2a2a" strokeWidth="3.5" />
              <circle cx="22" cy="22" r="18" fill="none" stroke="#007AFF" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="28 85" />
            </svg>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#636366", letterSpacing: "0.06em" }}>Google 로그인 중...</span>
            <span style={{ fontSize: 11, color: "#48484a", maxWidth: 220, textAlign: "center", lineHeight: 1.5 }}>팝업 창에서 Google 계정으로 로그인하세요</span>
          </div>
        )}

        {/* File browser */}
        {step === "files" && (
          <div>
            {/* Breadcrumb + sign-out */}
            <div style={{ padding: "10px 20px 8px", display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
              <button onClick={() => navigateTo(0)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={folderStack.length === 0 ? "#e0e0e0" : "#636366"} strokeWidth="2" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: folderStack.length === 0 ? "#e0e0e0" : "#636366", letterSpacing: "0.04em" }}>내 드라이브</span>
              </button>
              {folderStack.map((seg, idx) => (
                <span key={seg.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke="#444" strokeWidth="1.5" strokeLinecap="round"><polyline points="1,1 5,5 1,9"/></svg>
                  <button onClick={() => navigateTo(idx + 1)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 11, color: idx === folderStack.length - 1 ? "#e0e0e0" : "#636366", letterSpacing: "0.04em" }}>
                    {seg.name}
                  </button>
                </span>
              ))}
              <button onClick={handleSignOut} title="로그아웃" style={{ marginLeft: "auto", background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#48484a" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              </button>
            </div>

            {/* Toolbar */}
            <div style={{ padding: "4px 20px 8px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #2c2c2e" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#48484a", letterSpacing: "0.04em" }}>
                {loadingItems ? "불러오는 중..." : `${audioItems.length}개 파일 · ${selectedIds.size > 0 ? `${selectedIds.size}개 선택됨` : "선택 안됨"}`}
              </span>
              {audioItems.length > 0 && (
                <button onClick={() => { if (allSelected) setSelectedIds(new Set()); else setSelectedIds(new Set(audioItems.map((i) => i.id))) }} style={{ background: "none", border: "none", color: "#007AFF", fontSize: 13, cursor: "pointer" }}>
                  {allSelected ? "전체 해제" : "전체 선택"}
                </button>
              )}
            </div>

            {/* Loading spinner */}
            {loadingItems && (
              <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                <svg width="32" height="32" viewBox="0 0 44 44" style={{ animation: "spin 0.9s linear infinite" }}>
                  <circle cx="22" cy="22" r="18" fill="none" stroke="#2a2a2a" strokeWidth="3.5" />
                  <circle cx="22" cy="22" r="18" fill="none" stroke="#007AFF" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="28 85" />
                </svg>
              </div>
            )}

            {/* Error */}
            {loadError && !loadingItems && (
              <div style={{ padding: "20px", textAlign: "center" }}>
                <div style={{ color: "#ff6b6b", fontSize: 13, marginBottom: 12 }}>{loadError}</div>
                <button onClick={() => accessToken && loadItems(accessToken, currentFolderId)} style={{ background: "#2c2c2e", border: "none", borderRadius: 8, padding: "8px 16px", color: "#007AFF", cursor: "pointer", fontSize: 13 }}>다시 시도</button>
              </div>
            )}

            {/* Empty state */}
            {!loadingItems && !loadError && visibleItems.length === 0 && (
              <div style={{ padding: "40px 20px", textAlign: "center", color: "#48484a", fontSize: 13 }}>
                이 폴더는 비어 있습니다.
              </div>
            )}

            {/* File/folder rows */}
            {!loadingItems && visibleItems.map((item) => {
              const isFolder = item.mimeType === FOLDER_MIME
              const selected = selectedIds.has(item.id)
              const date = new Date(item.modifiedTime).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })

              if (isFolder) {
                return (
                  <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 20px", borderBottom: "1px solid #1c1c1e", cursor: "pointer", background: "transparent", transition: "background 0.1s" }} onClick={() => navigateInto(item)}>
                    <DriveFolderIcon />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: "#e0e0e0", fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                      <div style={{ color: "#48484a", fontSize: 11, marginTop: 2 }}>폴더 · {date}</div>
                    </div>
                    <svg width="8" height="13" viewBox="0 0 8 13" fill="none" stroke="#48484a" strokeWidth="2" strokeLinecap="round"><polyline points="1,1 7,6.5 1,12"/></svg>
                  </div>
                )
              }

              return (
                <div key={item.id} onClick={() => toggleFile(item.id)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 20px", borderBottom: "1px solid #1c1c1e", cursor: "pointer", background: selected ? "rgba(0,122,255,0.08)" : "transparent", transition: "background 0.1s" }}>
                  <DriveFileIcon mimeType={item.mimeType} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "#fff", fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                    <div style={{ color: "#48484a", fontSize: 11, marginTop: 3, display: "flex", gap: 6 }}>
                      <span>{item.size ? formatBytes(item.size) : "—"}</span>
                      <span style={{ color: "#333" }}>·</span>
                      <span>{date}</span>
                    </div>
                  </div>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, border: `2px solid ${selected ? "#007AFF" : "#3a3a3c"}`, background: selected ? "#007AFF" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>
                    {selected && <CheckIcon size={11} />}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Per-file download progress */}
        {step === "downloading" && (
          <div style={{ padding: "16px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <svg width="16" height="16" viewBox="0 0 44 44" style={{ animation: "spin 0.9s linear infinite", flexShrink: 0 }}>
                <circle cx="22" cy="22" r="18" fill="none" stroke="#2a2a2a" strokeWidth="4" />
                <circle cx="22" cy="22" r="18" fill="none" stroke="#007AFF" strokeWidth="4" strokeLinecap="round" strokeDasharray="28 85" />
              </svg>
              <span style={{ color: "#fff", fontWeight: 600, fontSize: 15 }}>다운로드 중</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#636366", marginLeft: "auto" }}>
                {Array.from(fileProgresses.values()).filter((p) => p >= 100).length} / {fileProgresses.size} 완료
              </span>
            </div>
            {saveDirName && (
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#48484a", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="12" height="12" viewBox="0 0 24 22" fill="none" stroke="#48484a" strokeWidth="1.5"><path d="M2 5a2 2 0 0 1 2-2h4l2.5 3H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5z"/></svg>
                {saveDirName}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {driveItems.filter((f) => fileProgresses.has(f.id)).map((file) => {
                const pct = fileProgresses.get(file.id) ?? 0
                const failed = pct === -1
                const done = pct >= 100
                return (
                  <div key={file.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        {done ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}><polyline points="20 6 9 17 4 12"/></svg>
                        ) : failed ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="M12 2v10M12 12l-3-3m3 3l3-3"/><path d="M2 17l.621 2.485A2 2 0 0 0 4.561 21h14.878a2 2 0 0 0 1.94-1.515L22 17"/></svg>
                        )}
                        <span style={{ fontSize: 13, color: done ? "#8e8e93" : failed ? "#ef4444" : "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</span>
                      </div>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: done ? "#22c55e" : failed ? "#ef4444" : "#636366", flexShrink: 0, marginLeft: 8 }}>
                        {done ? "완료" : failed ? "오류" : `${Math.round(pct)}%`}
                      </span>
                    </div>
                    <div style={{ background: "#2c2c2e", borderRadius: 3, height: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: 3, background: done ? "#22c55e" : failed ? "#ef4444" : "#007AFF", width: `${failed ? 100 : pct}%`, transition: "width 0.07s linear" }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Done */}
        {step === "done" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, gap: 16 }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#1a3a1a", border: "2px solid #22c55e", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ color: "#fff", fontWeight: 600, fontSize: 17 }}>다운로드 완료</div>
              <div style={{ color: "#636366", fontSize: 13, marginTop: 6 }}>
                {downloadedFiles.size}개 파일을 불러옵니다...
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Types ──────────────────────────────────────────────────────────────────

interface Track {
  id: string
  name: string
  buffer: AudioBuffer
  duration: number
  muted: boolean
  soloed: boolean
  volume: number
  color: string
}

// ── Constants ──────────────────────────────────────────────────────────────

const TRACK_COLORS = [
  "#3b82f6", "#22c55e", "#f59e0b", "#ef4444",
  "#a855f7", "#06b6d4", "#f97316", "#ec4899",
  "#14b8a6", "#84cc16",
]

// ── Helpers ────────────────────────────────────────────────────────────────

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

function effectiveGain(track: Track, all: Track[]): number {
  const anySoloed = all.some((t) => t.soloed)
  if (anySoloed) return track.soloed && !track.muted ? track.volume : 0
  return track.muted ? 0 : track.volume
}

// ── Icons ──────────────────────────────────────────────────────────────────

function PlayIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><polygon points="2,1 13,7 2,13" /></svg>
}
function PauseIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="2" y="1" width="3.5" height="12" rx="0.5" /><rect x="8.5" y="1" width="3.5" height="12" rx="0.5" /></svg>
}
function StopIcon() {
  return <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="1" y="1" width="10" height="10" rx="1" /></svg>
}
function FolderIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
}
function TrashIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6M9 6V4h6v2" /></svg>
}
function MusicIcon() {
  return <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#444" }}><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
}
function BackIcon() {
  return <svg width="10" height="16" viewBox="0 0 10 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="8,1 2,8 8,15" /></svg>
}

// ── Level Meter ────────────────────────────────────────────────────────────

function LevelMeter({ trackId, analyserNodesRef, height }: { trackId: string; analyserNodesRef: React.RefObject<Map<string, AnalyserNode>>; height: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const peakRef = useRef<number>(0)
  const peakHoldRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const SEGMENTS = 24, GAP = 1.5, W = 7

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw)
      const analyser = analyserNodesRef.current?.get(trackId)
      let level = 0
      if (analyser) {
        const data = new Float32Array(analyser.frequencyBinCount)
        analyser.getFloatTimeDomainData(data)
        let sum = 0
        for (let i = 0; i < data.length; i++) sum += data[i] * data[i]
        const rms = Math.sqrt(sum / data.length)
        const db = 20 * Math.log10(Math.max(rms, 1e-10))
        level = Math.max(0, Math.min(1, (db + 60) / 60))
      }
      if (level >= peakRef.current) { peakRef.current = level; peakHoldRef.current = 60 }
      else { peakHoldRef.current--; if (peakHoldRef.current <= 0) peakRef.current = Math.max(0, peakRef.current - 0.01) }
      const H = height
      canvas.width = W; canvas.height = H
      const segH = (H - GAP * (SEGMENTS - 1)) / SEGMENTS
      for (let i = 0; i < SEGMENTS; i++) {
        const segFraction = (SEGMENTS - 1 - i) / (SEGMENTS - 1)
        const lit = segFraction <= level
        const isPeak = Math.abs(segFraction - peakRef.current) < 1 / SEGMENTS
        let color: string
        if (segFraction > 0.88) color = lit || isPeak ? "#ef4444" : "#2a1212"
        else if (segFraction > 0.65) color = lit || isPeak ? "#eab308" : "#1e1a08"
        else color = lit || isPeak ? "#22c55e" : "#0c1f10"
        const y = i * (segH + GAP)
        ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(0, y, W, segH, 1); ctx.fill()
      }
    }
    draw()
    return () => cancelAnimationFrame(rafRef.current)
  }, [trackId, analyserNodesRef, height])

  return <canvas ref={canvasRef} style={{ position: "absolute", left: 6, top: 0, width: 7, height, display: "block", imageRendering: "pixelated" }} />
}

// ── VerticalWaveform ───────────────────────────────────────────────────────

function VerticalWaveform({ color, muted }: { color: string; muted: boolean }) {
  const bars = [0.35, 0.6, 0.8, 0.5, 0.9, 0.7, 1, 0.6, 0.75, 0.45, 0.85, 0.55]
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 2, width: 44, height: 56, flexShrink: 0, marginTop: 8, opacity: muted ? 0.15 : 0.55, transition: "opacity 0.2s" }}>
      {bars.map((h, i) => <div key={i} style={{ width: 2, height: `${h * 100}%`, background: color, borderRadius: 1 }} />)}
    </div>
  )
}

// ── ChannelStrip ───────────────────────────────────────────────────────────

interface ChannelStripProps {
  track: Track; index: number; isDragging: boolean; isDragOver: boolean
  onMute: () => void; onSolo: () => void; onVolume: (v: number) => void
  onStripPointerDown: (e: React.PointerEvent, id: string) => void
  analyserNodesRef: React.RefObject<Map<string, AnalyserNode>>
}

function ChannelStrip({ track, index, isDragging, isDragOver, onMute, onSolo, onVolume, onStripPointerDown, analyserNodesRef }: ChannelStripProps) {
  const volPct = track.volume * 100
  const faderAreaRef = useRef<HTMLDivElement>(null)
  const [faderHeight, setFaderHeight] = useState(120)

  useEffect(() => {
    const el = faderAreaRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setFaderHeight(Math.max(60, entry.contentRect.height))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const handlePointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement
    if (target.tagName === "BUTTON" || target.tagName === "INPUT") return
    onStripPointerDown(e, track.id)
  }

  return (
    <div
      className="channel-strip"
      onPointerDown={handlePointerDown}
      style={{
        opacity: isDragging ? 0.35 : 1, outline: isDragging ? "2px solid #ffffff44" : undefined,
        borderLeft: isDragOver ? "2px solid #007AFF" : undefined,
        transition: "opacity 0.15s, border 0.1s", cursor: isDragging ? "grabbing" : "default",
        userSelect: "none", WebkitUserSelect: "none",
      }}
    >
      <div style={{ width: "100%", height: 4, background: track.color, opacity: track.muted ? 0.25 : 1, transition: "opacity 0.2s", boxShadow: track.muted ? "none" : `0 0 10px ${track.color}88`, flexShrink: 0 }} />
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#444", marginTop: 6, letterSpacing: "0.06em", userSelect: "none", flexShrink: 0 }}>
        {String(index + 1).padStart(2, "0")}
      </div>
      <div style={{ width: "100%", padding: "4px 8px 0", flexShrink: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 500, color: track.muted ? "#3a3a3a" : "#b0b0b0", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", transition: "color 0.2s", lineHeight: 1.3 }}>
          {track.name}
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#3a3a3a", textAlign: "center", marginTop: 2 }}>
          {formatTime(track.duration)}
        </div>
      </div>
      <VerticalWaveform color={track.color} muted={track.muted} />
      <div ref={faderAreaRef} style={{ flex: 1, minHeight: 0, width: "100%", position: "relative", overflow: "hidden" }}>
        <LevelMeter trackId={track.id} analyserNodesRef={analyserNodesRef} height={faderHeight} />
        <div style={{ position: "absolute", right: 4, top: 0, bottom: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", pointerEvents: "none" }}>
          {["+6", "0", "-6", "-∞"].map((label) => (
            <span key={label} style={{ fontFamily: "var(--font-mono)", fontSize: 7, color: "#3a3a3a", lineHeight: 1 }}>{label}</span>
          ))}
        </div>
        <input
          type="range" className="vol-slider"
          style={{ position: "absolute", top: "50%", left: "50%", width: faderHeight, transform: "translateX(-50%) translateY(-50%) rotate(-90deg)", "--vol-progress": `${volPct}%` } as React.CSSProperties}
          min={0} max={1} step={0.01} value={track.volume}
          onChange={(e) => onVolume(parseFloat(e.target.value))}
        />
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#505050", letterSpacing: "0.04em", flexShrink: 0, marginBottom: 4 }}>
        {Math.round(track.volume * 100)}
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexShrink: 0 }}>
        <button className={`mute-btn${track.muted ? " active" : ""}`} onClick={onMute} title="Mute">M</button>
        <button className={`solo-btn${track.soloed ? " active" : ""}`} onClick={onSolo} title="Solo">S</button>
      </div>
    </div>
  )
}

// ── Player Screen ──────────────────────────────────────────────────────────

interface PlayerScreenProps {
  playlist: Playlist
  initialTracks: Track[]
  onBack: (tracks: Track[]) => void
}

function PlayerScreen({ playlist, initialTracks, onBack }: PlayerScreenProps) {
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

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dragStartRef = useRef<{ x: number; y: number; moved: boolean }>({ x: 0, y: 0, moved: false })
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

  const maxDuration = tracks.reduce((max, t) => Math.max(max, t.duration), 0)

  const getAudioCtx = () => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext()
    return audioCtxRef.current
  }

  const stopAllSources = useCallback(() => {
    sourceNodesRef.current.forEach((node) => { try { node.stop() } catch { /* already stopped */ } })
    sourceNodesRef.current.clear()
    analyserNodesRef.current.clear()
    cancelAnimationFrame(animFrameRef.current)
  }, [])

  const startPlayback = useCallback((offset: number, currentTracks: Track[]) => {
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
      analyser.fftSize = 256; analyser.smoothingTimeConstant = 0.8
      gain.connect(analyser); analyser.connect(ctx.destination)
      analyserNodesRef.current.set(track.id, analyser)
      const src = ctx.createBufferSource()
      src.buffer = track.buffer; src.connect(gain); src.start(startAt, offset)
      sourceNodesRef.current.set(track.id, src)
    })
    const tick = () => {
      const ctx2 = audioCtxRef.current
      if (!ctx2) return
      const elapsed = ctx2.currentTime - startTimeRef.current
      const maxDur = tracksRef.current.reduce((m, t) => Math.max(m, t.duration), 0)
      if (elapsed >= maxDur && maxDur > 0) { setCurrentTime(maxDur); setSeekValue(maxDur); setIsPlaying(false); pauseOffsetRef.current = 0; return }
      setCurrentTime(elapsed)
      animFrameRef.current = requestAnimationFrame(tick)
    }
    animFrameRef.current = requestAnimationFrame(tick)
  }, [stopAllSources])

  useEffect(() => {
    if (!isPlaying) return
    tracks.forEach((track) => {
      const gain = gainNodesRef.current.get(track.id)
      if (gain) gain.gain.value = effectiveGain(track, tracks)
    })
  }, [tracks, isPlaying])

  useEffect(() => { if (!isSeeking) setSeekValue(currentTime) }, [currentTime, isSeeking])

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null }
  }, [])

  const handleStripPointerDown = useCallback((e: React.PointerEvent, id: string) => {
    dragStartRef.current = { x: e.clientX, y: e.clientY, moved: false }
    longPressTimerRef.current = setTimeout(() => {
      if (!dragStartRef.current.moved) { setDraggingId(id); if (navigator.vibrate) navigator.vibrate(40) }
    }, 420)
  }, [])

  const handleContainerPointerMove = useCallback((e: React.PointerEvent) => {
    const dx = Math.abs(e.clientX - dragStartRef.current.x)
    const dy = Math.abs(e.clientY - dragStartRef.current.y)
    if ((dx > 8 || dy > 8) && !dragStartRef.current.moved) {
      dragStartRef.current.moved = true
      if (!draggingIdRef.current) { cancelLongPress(); return }
    }
    if (!draggingIdRef.current) return
    e.preventDefault()
    const container = scrollContainerRef.current
    if (!container) return
    const children = Array.from(container.children) as HTMLElement[]
    for (let i = 0; i < children.length; i++) {
      const rect = children[i].getBoundingClientRect()
      if (e.clientX >= rect.left && e.clientX <= rect.right) { setDragOverIdx(i); return }
    }
  }, [cancelLongPress])

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
      stopAllSources(); setIsPlaying(false)
    } else { startPlayback(pauseOffsetRef.current, tracks); setIsPlaying(true) }
  }

  const handleStop = () => {
    stopAllSources(); setIsPlaying(false); pauseOffsetRef.current = 0; setCurrentTime(0); setSeekValue(0)
  }

  const handleSeekMouseDown = () => { setIsSeeking(true); if (isPlaying) stopAllSources() }
  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => { const val = parseFloat(e.target.value); setSeekValue(val); setCurrentTime(val) }
  const handleSeekMouseUp = () => { setIsSeeking(false); pauseOffsetRef.current = seekValue; if (isPlayingRef.current) startPlayback(seekValue, tracksRef.current) }

  const handleFileLoad = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const existingNames = new Set(tracks.map((t) => t.name))
    const newFiles = files.filter((f) => !existingNames.has(f.name.replace(/\.[^/.]+$/, "")))
    if (!newFiles.length) { if (fileInputRef.current) fileInputRef.current.value = ""; return }
    setIsLoading(true)
    const ctx = getAudioCtx()
    const newTracks: Track[] = []
    const colorOffset = tracks.length
    for (let i = 0; i < newFiles.length; i++) {
      const file = newFiles[i]
      try {
        const ab = await file.arrayBuffer()
        const buf = await ctx.decodeAudioData(ab)
        newTracks.push({ id: generateUUID(), name: file.name.replace(/\.[^/.]+$/, ""), buffer: buf, duration: buf.duration, muted: false, soloed: false, volume: 0.85, color: TRACK_COLORS[(colorOffset + i) % TRACK_COLORS.length] })
      } catch { console.warn("Could not decode:", file.name) }
    }
    setTracks((prev) => [...prev, ...newTracks])
    setIsLoading(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleDeleteAll = () => {
    if (!window.confirm("정말 삭제하시겠습니까?")) return
    stopAllSources(); setIsPlaying(false); pauseOffsetRef.current = 0; setCurrentTime(0); setSeekValue(0)
    gainNodesRef.current.clear(); setTracks([])
  }

  const updateTrack = (id: string, patch: Partial<Track>) => {
    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  }

  const handleVolume = (id: string, vol: number) => {
    setTracks((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, volume: vol } : t))
      const track = next.find((t) => t.id === id)
      if (track) { const gain = gainNodesRef.current.get(id); if (gain) gain.gain.value = effectiveGain(track, next) }
      return next
    })
  }

  const anyMuted = tracks.some((t) => t.muted)
  const anySoloed = tracks.some((t) => t.soloed)
  const handleGlobalMute = () => { if (anyMuted) setTracks((prev) => prev.map((t) => ({ ...t, muted: false }))); else setTracks((prev) => prev.map((t) => ({ ...t, muted: true }))) }
  const handleGlobalSolo = () => { if (anySoloed) setTracks((prev) => prev.map((t) => ({ ...t, soloed: false }))); else setTracks((prev) => prev.map((t) => ({ ...t, soloed: true }))) }

  const seekPct = maxDuration > 0 ? (seekValue / maxDuration) * 100 : 0

  const handleBack = () => {
    stopAllSources()
    setIsPlaying(false)
    onBack(tracks)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#141414" }}>
      {/* Transport Bar */}
      <div style={{
        flexShrink: 0, background: "linear-gradient(180deg, #252525 0%, #1e1e1e 100%)",
        borderBottom: "1px solid #333",
        padding: "10px 12px 12px",
        display: "flex", flexDirection: "column", gap: "10px",
        boxShadow: "0 2px 12px rgba(0,0,0,0.5)",
      }}>
        {/* Row 1: back · name | play stop | time | M S | spacer | tracks | folder trash */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
          <button
            className="icon-btn" onClick={handleBack} title="재생 목록으로"
            style={{ width: 34, height: 34, flexShrink: 0, color: "#007AFF", borderColor: "#007AFF22", background: "transparent" }}
          >
            <BackIcon />
          </button>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#555", letterSpacing: "0.05em", maxWidth: "clamp(48px, 12vw, 100px)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 1 }}>
            {playlist.name}
          </span>
          <div style={{ width: 1, height: 18, background: "#383838", flexShrink: 0 }} />

          <button className={`transport-btn${isPlaying ? " active-play" : ""}`} onClick={handlePlayPause} title={isPlaying ? "Pause" : "Play"} style={{ width: 40, height: 34, flexShrink: 0 }}>
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button className="transport-btn" onClick={handleStop} title="Stop" style={{ width: 36, height: 34, flexShrink: 0 }}><StopIcon /></button>

          <div style={{ width: 1, height: 18, background: "#383838", flexShrink: 0, margin: "0 2px" }} />

          <div className="transport-time" style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 500, background: "#111", border: "1px solid #333", borderRadius: 6, padding: "4px 8px", letterSpacing: "0.04em", minWidth: 100, textAlign: "center", flexShrink: 0 }}>
            <span style={{ color: "#007AFF" }}>{formatTime(currentTime)}</span>
            <span style={{ color: "#444", margin: "0 3px" }}>/</span>
            <span style={{ color: "#666" }}>{formatTime(maxDuration)}</span>
          </div>

          <button className={`transport-btn${anyMuted ? " active-mute" : ""}`} onClick={handleGlobalMute} title="전체 뮤트" style={{ width: 34, height: 34, flexShrink: 0, fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600 }}>M</button>
          <button className={`transport-btn${anySoloed ? " active-solo" : ""}`} onClick={handleGlobalSolo} title="전체 솔로" style={{ width: 34, height: 34, flexShrink: 0, fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600 }}>S</button>

          <div style={{ flex: 1, minWidth: 0 }} />

          {tracks.length > 0 && (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#555", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 4, padding: "2px 6px", letterSpacing: "0.08em", flexShrink: 0, whiteSpace: "nowrap" }}>
              {tracks.length}T
            </div>
          )}
          <div style={{ width: 1, height: 18, background: "#383838", flexShrink: 0, margin: "0 2px" }} />
          <button className="icon-btn" onClick={() => setShowAddSheet(true)} title="오디오 파일 불러오기" style={{ width: 36, height: 34, flexShrink: 0 }}><FolderIcon /></button>
          <input 
           ref={fileInputRef}
           type="file"
          //  accept=".m4a,.aac,.mp4,.mp3,.wav,audio/m4a,audio/x-m4a,audio/aac,audio/mp4,audio/mpeg,audio/*,video/mp4"
            multiple
             style={{ display: "none" }}
              onChange={handleFileLoad} />
          <button className="icon-btn" onClick={handleDeleteAll} title="모든 트랙 삭제" style={{ width: 36, height: 34, flexShrink: 0, color: tracks.length ? "#c0392b" : undefined }}><TrashIcon /></button>
        </div>

        {/* Row 2: seek slider */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#444", minWidth: 28 }}>{formatTime(0)}</span>
          <input type="range" className="seek-slider" style={{ flex: 1, "--progress": `${seekPct}%` } as React.CSSProperties} min={0} max={maxDuration || 100} step={0.01} value={seekValue} onMouseDown={handleSeekMouseDown} onTouchStart={handleSeekMouseDown} onChange={handleSeekChange} onMouseUp={handleSeekMouseUp} onTouchEnd={handleSeekMouseUp} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "#444", minWidth: 28, textAlign: "right" }}>{formatTime(maxDuration)}</span>
        </div>
      </div>

      {/* Track area */}
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        {tracks.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "12px" }}>
            <MusicIcon />
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em", color: "#333", margin: 0 }}>
              폴더 버튼을 눌러 오디오 파일을 불러오세요
            </p>
          </div>
        ) : (
          <div ref={scrollContainerRef} className="tracks-hscroll" onPointerMove={handleContainerPointerMove} onPointerUp={handleContainerPointerUp} onPointerLeave={handleContainerPointerUp} style={{ touchAction: draggingId ? "none" : "pan-x" }}>
            {tracks.map((track, idx) => (
              <ChannelStrip key={track.id} track={track} index={idx} isDragging={draggingId === track.id} isDragOver={dragOverIdx === idx && draggingId !== track.id} analyserNodesRef={analyserNodesRef} onMute={() => updateTrack(track.id, { muted: !track.muted })} onSolo={() => updateTrack(track.id, { soloed: !track.soloed })} onVolume={(v) => handleVolume(track.id, v)} onStripPointerDown={handleStripPointerDown} />
            ))}
          </div>
        )}
        {isLoading && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(20,20,20,0.82)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, backdropFilter: "blur(4px)", zIndex: 10 }}>
            <svg width="44" height="44" viewBox="0 0 44 44" style={{ animation: "spin 0.9s linear infinite" }}>
              <circle cx="22" cy="22" r="18" fill="none" stroke="#2a2a2a" strokeWidth="3.5" />
              <circle cx="22" cy="22" r="18" fill="none" stroke="#007AFF" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="28 85" strokeDashoffset="0" />
            </svg>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#777", letterSpacing: "0.08em" }}>불러오는 중..</span>
          </div>
        )}
        {draggingId && (
          <div style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", fontFamily: "var(--font-mono)", fontSize: 10, color: "#888", background: "rgba(0,0,0,0.7)", borderRadius: 6, padding: "4px 12px", pointerEvents: "none", letterSpacing: "0.06em" }}>
            드래그하여 순서 변경
          </div>
        )}
      </div>

      <AddFileSheet open={showAddSheet} onClose={() => setShowAddSheet(false)} onPickFiles={() => fileInputRef.current?.click()} onConnect={() => setShowCloudModal(true)} />
      <CloudConnectModal
        open={showCloudModal}
        onClose={() => setShowCloudModal(false)}
        realFileInputRef={fileInputRef}
        onImport={async (files) => {
          if (!files.length) return
          const existingNames = new Set(tracks.map((t) => t.name))
          const newFiles = files.filter((f) => !existingNames.has(f.name.replace(/\.[^/.]+$/, "")))
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
              newTracks.push({ id: generateUUID(), name: file.name.replace(/\.[^/.]+$/, ""), buffer: buf, duration: buf.duration, muted: false, soloed: false, volume: 0.85, color: TRACK_COLORS[(colorOffset + i) % TRACK_COLORS.length] })
            } catch { console.warn("Could not decode:", file.name) }
          }
          setTracks((prev) => [...prev, ...newTracks])
          setIsLoading(false)
        }}
      />
    </div>
  )
}

// ── Root App ───────────────────────────────────────────────────────────────

function loadPlaylists(): Playlist[] {
  try {
    const raw = localStorage.getItem("playlists")
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function savePlaylists(pls: Playlist[]) {
  try { localStorage.setItem("playlists", JSON.stringify(pls)) } catch { /* quota */ }
}

export default function App() {
  const [playlists, setPlaylists] = useState<Playlist[]>(loadPlaylists)
  const [sortOrder, setSortOrder] = useState<SortOrder>("date")
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null)
  const tracksMapRef = useRef<Map<string, Track[]>>(new Map())

  useEffect(() => { savePlaylists(playlists) }, [playlists])

  const handleCreate = (name: string) => {
    const newPl: Playlist = { id: generateUUID(), name, createdAt: Date.now() }
    setPlaylists((prev) => [...prev, newPl])
    tracksMapRef.current.set(newPl.id, [])
    setActivePlaylistId(newPl.id)
  }

  const handleOpen = (id: string) => {
    if (!tracksMapRef.current.has(id)) tracksMapRef.current.set(id, [])
    setActivePlaylistId(id)
  }

  const handleBack = (tracks: Track[]) => {
    if (activePlaylistId) tracksMapRef.current.set(activePlaylistId, tracks)
    setActivePlaylistId(null)
  }

  const handleRename = (id: string, name: string) => {
    setPlaylists((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)))
  }

  const handleDelete = (id: string) => {
    setPlaylists((prev) => prev.filter((p) => p.id !== id))
    tracksMapRef.current.delete(id)
    if (activePlaylistId === id) setActivePlaylistId(null)
  }

  if (activePlaylistId) {
    const pl = playlists.find((p) => p.id === activePlaylistId)
    if (!pl) { setActivePlaylistId(null); return null }
    return (
      <PlayerScreen
        playlist={pl}
        initialTracks={tracksMapRef.current.get(activePlaylistId) ?? []}
        onBack={handleBack}
      />
    )
  }

  return (
    <PlaylistScreen
      playlists={playlists}
      sortOrder={sortOrder}
      onOpen={handleOpen}
      onCreate={handleCreate}
      onRename={handleRename}
      onDelete={handleDelete}
      onSort={setSortOrder}
    />
  )
}
// cache-bust: 1789722207
