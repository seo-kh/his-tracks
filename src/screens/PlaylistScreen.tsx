import React, { useState } from "react"
import { useNavigate } from "react-router-dom"
import { usePlaylist } from "../context/PlaylistContext"
import type { Playlist, SortOrder } from "../types/playlist"
import { PlaylistMusicIcon } from "../components/common/Icons"

export function PlaylistScreen() {
  const navigate = useNavigate()
  const {
    playlists,
    sortOrder,
    setSortOrder,
    createPlaylist,
    renamePlaylist,
    deletePlaylist,
  } = usePlaylist()

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
    const newPl = createPlaylist(name)
    setCreateName("")
    setShowCreateSheet(false)
    navigate(`/player/${newPl.id}`)
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
      renamePlaylist(renameId, renameValue.trim())
    }
    setRenameId(null)
  }

  const handleDeleteStart = (id: string) => {
    setCardMenuId(null)
    setDeleteConfirmId(id)
  }

  const handleDeleteConfirm = () => {
    if (deleteConfirmId) deletePlaylist(deleteConfirmId)
    setDeleteConfirmId(null)
  }

  const sorted = [...playlists].sort((a, b) =>
    sortOrder === "name"
      ? a.name.localeCompare(b.name)
      : b.createdAt - a.createdAt,
  )

  // ----------- UI --------------

  const TopBar = () => {
   return <div
        className="playlist-topbar"
        style={{ padding: "16px 16px 10px", flexShrink: 0 }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* + button */}
          <AddButton onClick={() => {
            setCreateName("")
            setShowCreateSheet(true)
          }} />

          {/* Title pill */}
          <div
            style={{
              fontWeight: 600,
              fontSize: 16,
              color: "#fff",
            }}
          >
            재생 목록
          </div>

          {/* ... button */}
          <ContextModal 
          show={showSortMenu}
          setShow={() => { setShowSortMenu((v) => !v) }}
          child={
           <SortMenu>
                <SortElement 
                  name="이름순"
                  isSelected={sortOrder === "name"}
                  onClick={() => {
                    setSortOrder("name")
                    setShowSortMenu(false)
                  }} /> 

                <SortElement
                  name="날짜순"
                  isSelected={sortOrder === "date"}
                  onClick={() => {
                    setSortOrder("date")
                    setShowSortMenu(false)
                  }}
                 />
              </SortMenu> 
            }
          />
        </div>
      </div> 
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        background: "#000",
        overflow: "hidden",
      }}
    >
      {/* Top bar */}
      <TopBar />

      {/* Playlist grid */}
      <div
        className="playlist-scroll safe-bottom"
        style={{ flex: 1, overflowY: "auto", padding: "10px 16px" }}
      >
        <div className="playlist-content">
          {playlists.length === 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "60%",
                gap: 14,
                opacity: 0.4,
              }}
            >
              <PlaylistMusicIcon />
              <p
                style={{
                  color: "#666",
                  fontSize: 14,
                  margin: 0,
                  textAlign: "center",
                  lineHeight: 1.6,
                }}
              >
                재생 목록이 없습니다.
                <br />+ 버튼을 눌러 추가하세요.
              </p>
            </div>
          ) : (
            <div className="playlist-grid">
              {sorted.map((pl) => (
                <div
                  key={pl.id}
                  onClick={() => navigate(`/player/${pl.id}`)}
                  style={{ cursor: "pointer" }}
                >
                  {/* Card */}
                  <div
                    style={{
                      background: "#1c1c1e",
                      borderRadius: 12,
                      aspectRatio: "1/1",
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                    }}
                  >
                    <PlaylistMusicIcon />
                    <button
                      onClick={(e) => handleCardMenu(pl.id, e)}
                      style={{
                        position: "absolute",
                        bottom: 8,
                        right: 8,
                        background: "rgba(0,0,0,0.5)",
                        border: "none",
                        borderRadius: "50%",
                        width: 28,
                        height: 28,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        color: "#fff",
                      }}
                    >
                      <svg
                        width="14"
                        height="4"
                        viewBox="0 0 14 4"
                        fill="white"
                      >
                        <circle cx="2" cy="2" r="1.5" />
                        <circle cx="7" cy="2" r="1.5" />
                        <circle cx="12" cy="2" r="1.5" />
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
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRenameSubmit()
                          if (e.key === "Escape") setRenameId(null)
                        }}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          width: "100%",
                          background: "#1c1c1e",
                          border: "1px solid #007AFF",
                          borderRadius: 6,
                          padding: "4px 8px",
                          color: "#fff",
                          fontSize: 14,
                          fontWeight: 600,
                          outline: "none",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 14,
                          color: "#fff",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
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
            <div
              style={{
                textAlign: "center",
                padding: "24px 0 12px",
                color: "#444",
                fontSize: 13,
              }}
            >
              재생 목록 ({playlists.length})
            </div>
          )}
        </div>
      </div>

      {/* Overlays */}
      {showSortMenu && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 50 }}
          onClick={() => setShowSortMenu(false)}
        />
      )}

      {/* Card context menu */}
      {cardMenuId && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 200 }}
            onClick={() => setCardMenuId(null)}
          />
          <div
            style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 201,
              background: "#1c1c1e",
              borderRadius: "14px 14px 0 0",
              padding:
                "12px 16px calc(16px + env(safe-area-inset-bottom, 0px))",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 4,
                  borderRadius: 2,
                  background: "#48484a",
                }}
              />
            </div>
            <div
              style={{
                background: "#2c2c2e",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              <div
                onClick={() => {
                  const pl = playlists.find((p) => p.id === cardMenuId)
                  if (pl) handleRenameStart(pl)
                }}
                style={{
                  padding: "15px 18px",
                  cursor: "pointer",
                  color: "#fff",
                  fontSize: 16,
                  borderBottom: "1px solid #3a3a3c",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#007AFF"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                이름 바꾸기
              </div>
              <div
                onClick={() => handleDeleteStart(cardMenuId)}
                style={{
                  padding: "15px 18px",
                  cursor: "pointer",
                  color: "#ef4444",
                  fontSize: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14H6L5 6" />
                  <path d="M10 11v6M14 11v6M9 6V4h6v2" />
                </svg>
                삭제
              </div>
            </div>
            <button
              onClick={() => setCardMenuId(null)}
              style={{
                width: "100%",
                marginTop: 10,
                padding: "14px",
                background: "#2c2c2e",
                border: "none",
                borderRadius: 12,
                color: "#fff",
                fontSize: 16,
                fontWeight: 600,
                cursor: "pointer",
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
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              zIndex: 300,
            }}
          />
          <div
            style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 301,
              background: "#1c1c1e",
              borderRadius: "14px 14px 0 0",
              padding:
                "20px 16px calc(20px + env(safe-area-inset-bottom, 0px))",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 4,
                  borderRadius: 2,
                  background: "#48484a",
                }}
              />
            </div>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 600,
                  color: "#fff",
                  marginBottom: 8,
                }}
              >
                재생 목록 삭제
              </div>
              <div style={{ fontSize: 14, color: "#888", lineHeight: 1.5 }}>
                &ldquo;{playlists.find((p) => p.id === deleteConfirmId)?.name}
                &rdquo; 재생 목록을
                <br />
                삭제하시겠습니까?
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setDeleteConfirmId(null)}
                style={{
                  flex: 1,
                  padding: "14px",
                  background: "#2c2c2e",
                  border: "none",
                  borderRadius: 12,
                  color: "#fff",
                  fontSize: 16,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                취소
              </button>
              <button
                onClick={handleDeleteConfirm}
                style={{
                  flex: 1,
                  padding: "14px",
                  background: "#ef4444",
                  border: "none",
                  borderRadius: 12,
                  color: "#fff",
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: "pointer",
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
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
              zIndex: 300,
              backdropFilter: "blur(4px)",
            }}
            onClick={() => setShowCreateSheet(false)}
          />
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 301,
              width: "min(280px, calc(100vw - 48px))",
              background: "#2c2c2e",
              borderRadius: 14,
              overflow: "hidden",
              boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
            }}
          >
            {/* Alert title + message */}
            <div style={{ padding: "20px 16px 12px", textAlign: "center" }}>
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 600,
                  color: "#fff",
                  marginBottom: 4,
                }}
              >
                새 재생 목록
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "#8e8e93",
                  marginBottom: 16,
                  lineHeight: 1.4,
                }}
              >
                재생 목록 이름을 입력하세요.
              </div>
              <input
                autoFocus
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateSubmit()
                  if (e.key === "Escape") setShowCreateSheet(false)
                }}
                placeholder="목록 이름"
                style={{
                  width: "100%",
                  background: "#1c1c1e",
                  border: "1px solid #48484a",
                  borderRadius: 8,
                  padding: "10px 12px",
                  color: "#fff",
                  fontSize: 15,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
            {/* Buttons */}
            <div style={{ display: "flex", borderTop: "1px solid #48484a" }}>
              <button
                onClick={() => setShowCreateSheet(false)}
                style={{
                  flex: 1,
                  padding: "14px",
                  background: "none",
                  border: "none",
                  borderRight: "1px solid #48484a",
                  color: "#fff",
                  fontSize: 16,
                  fontWeight: 400,
                  cursor: "pointer",
                }}
              >
                취소
              </button>
              <button
                onClick={handleCreateSubmit}
                disabled={!createName.trim()}
                style={{
                  flex: 1,
                  padding: "14px",
                  background: "none",
                  border: "none",
                  color: createName.trim() ? "#007AFF" : "#48484a",
                  fontSize: 16,
                  fontWeight: 600,
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

function ContextModal({ show, setShow, child }: { show: boolean, setShow: () => void, child: React.ReactNode }) {
    return <div style={{ position: "relative" }}>
            <button
              onClick={setShow}
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "#1c1c1e",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
              }}
            >
              <svg width="18" height="5" viewBox="0 0 18 5" fill="white">
                <circle cx="2" cy="2.5" r="2" />
                <circle cx="9" cy="2.5" r="2" />
                <circle cx="16" cy="2.5" r="2" />
              </svg>
            </button>
            { show &&  child }
          </div>
}

function SortMenu({ children }: { children: React.ReactNode }) {
  return <div
            style={{
              position: "absolute",
              right: 0,
              top: 50,
              zIndex: 100,
              background: "#1c1c1e",
              borderRadius: 12,
              overflow: "hidden",
              boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
              minWidth: 160,
              border: "1px solid #2c2c2e",
            }}
          >
            {
              children
            }
          </div>
}

function SortElement({ name, isSelected, onClick }: { name: string, isSelected: boolean, onClick: () => void }) {
  return <div
            onClick={onClick}
            style={{
              padding: "13px 18px",
              cursor: "pointer",
              color: isSelected ? "#007AFF" : "#fff",
              fontSize: 15,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            {name}
            {isSelected && (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#007AFF"
                strokeWidth="3"
                strokeLinecap="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
}

function AddButton({ onClick }: { onClick: () => void }) {
  return <button
            onClick={onClick}
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "#1c1c1e",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
            }}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              stroke="white"
              strokeWidth="2.2"
              strokeLinecap="round">
              <line x1="9" y1="2" x2="9" y2="16" />
              <line x1="2" y1="9" x2="16" y2="9" />
            </svg>
          </button>
}


export default PlaylistScreen
