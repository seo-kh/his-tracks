import React, { useState, useEffect, useCallback } from "react"
import {
  getStoredToken,
  signInWithGoogle,
  listDrives,
  listDriveItems,
  downloadDriveFile,
  clearToken,
  FOLDER_MIME,
  GDriveItem,
  GDriveInfo,
} from "../../googleDrive" // 경로에 맞게 지정하세요.

interface CloudConnectModalProps {
  open: boolean
  onClose: () => void
  realFileInputRef?: React.RefObject<HTMLInputElement>
  onImport: (files: File[]) => Promise<void>
}

interface BreadcrumbItem {
  id: string | null
  name: string
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ""
const GOOGLE_CLIENT_SECRET = import.meta.env.GOOGLE_CLIENT_SECRET ?? ""

export function CloudConnectModal({ open, onClose, onImport }: CloudConnectModalProps) {
  const [token, setToken] = useState<string | null>(null)
  const [drives, setDrives] = useState<GDriveInfo[]>([])
  const [selectedDriveId, setSelectedDriveId] = useState<string>("user")
  
  const [items, setItems] = useState<GDriveItem[]>([])
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: null, name: "루트" },
  ])
  
  const [loading, setLoading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // 1. 토큰 확인
  useEffect(() => {
    if (open) {
      const stored = getStoredToken()
      if (stored) setToken(stored)
    }
  }, [open])

  // 2. 드라이브 목록 조회
  const fetchDrives = useCallback(async (authToken: string) => {
    try {
      const driveList = await listDrives(authToken)
      setDrives(driveList)
    } catch (err: any) {
      if (err.message === "UNAUTHORIZED") setToken(null)
      else setErrorMsg("드라이브 목록을 불러오지 못했습니다.")
    }
  }, [])

  // 3. 파일/폴더 목록 조회
  const fetchItems = useCallback(async (authToken: string, folderId: string | null, driveId: string) => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const driveItems = await listDriveItems(authToken, folderId, driveId)
      setItems(driveItems)
    } catch (err: any) {
      if (err.message === "UNAUTHORIZED") setToken(null)
      else setErrorMsg("파일 목록을 불러오는 도중 오류가 발생했습니다.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (token && open) {
      fetchDrives(token)
    }
  }, [token, open, fetchDrives])

  useEffect(() => {
    if (token && open) {
      const currentFolderId = breadcrumbs[breadcrumbs.length - 1].id
      fetchItems(token, currentFolderId, selectedDriveId)
    }
  }, [token, open, selectedDriveId, breadcrumbs, fetchItems])

  const handleLogin = async () => {
    try {
      const newToken = await signInWithGoogle(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
      setToken(newToken)
    } catch (e: any) {
      setErrorMsg("Google 로그인 실패: " + e.message)
    }
  }

  const handleDriveChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDriveId = e.target.value
    setSelectedDriveId(newDriveId)
    setSelectedItemIds(new Set())
    setBreadcrumbs([{ id: null, name: "루트" }])
  }

  const handleItemClick = (item: GDriveItem) => {
    if (item.mimeType === FOLDER_MIME) {
      setBreadcrumbs((prev) => [...prev, { id: item.id, name: item.name }])
      setSelectedItemIds(new Set())
    } else {
      setSelectedItemIds((prev) => {
        const next = new Set(prev)
        if (next.has(item.id)) next.delete(item.id)
        else next.add(item.id)
        return next
      })
    }
  }

  const handleBreadcrumbClick = (index: number) => {
    setBreadcrumbs((prev) => prev.slice(0, index + 1))
    setSelectedItemIds(new Set())
  }

  const handleImportSelected = async () => {
    if (!token || selectedItemIds.size === 0) return
    setLoading(true)
    const downloadedFiles: File[] = []
    const selectedList = items.filter((i) => selectedItemIds.has(i.id))

    try {
      for (let i = 0; i < selectedList.length; i++) {
        const item = selectedList[i]
        const blob = await downloadDriveFile(token, item.id, (pct) => {
          setDownloadProgress(Math.round(((i + pct / 100) / selectedList.length) * 100))
        })
        downloadedFiles.push(new File([blob], item.name, { type: item.mimeType }))
      }
      await onImport(downloadedFiles)
      onClose()
    } catch (err: any) {
      setErrorMsg("다운로드 실패: " + err.message)
    } finally {
      setLoading(false)
      setDownloadProgress(null)
    }
  }

  if (!open) return null

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: "#1e1e1e",
          color: "#fff",
          width: "90%",
          maxWidth: 500,
          borderRadius: 12,
          padding: 20,
          display: "flex",
          flexDirection: "column",
          maxHeight: "80vh",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>Google Drive 불러오기</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#aaa", cursor: "pointer" }}>
            ✕
          </button>
        </div>

        {!token ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <p style={{ color: "#aaa", marginBottom: 20 }}>Google 계정을 연동하여 파일에 접근하세요.</p>
            <button
              onClick={handleLogin}
              style={{
                background: "#007AFF",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "10px 20px",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Google 계정 연결
            </button>
          </div>
        ) : (
          <>
            {/* 드라이브 선택 셀렉트 박스 */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: "#aaa", display: "block", marginBottom: 4 }}>
                드라이브 선택
              </label>
              <select
                value={selectedDriveId}
                onChange={handleDriveChange}
                style={{
                  width: "100%",
                  background: "#2a2a2a",
                  color: "#fff",
                  border: "1px solid #444",
                  borderRadius: 6,
                  padding: "8px 10px",
                  fontSize: 14,
                }}
              >
                {drives.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} {d.isSharedDrive ? "(공유 드라이브)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* 브레드크럼 */}
            <div
              style={{
                display: "flex",
                gap: 6,
                fontSize: 12,
                color: "#888",
                marginBottom: 12,
                overflowX: "auto",
                whiteSpace: "nowrap",
              }}
            >
              {breadcrumbs.map((b, idx) => (
                <span key={idx}>
                  <span
                    onClick={() => handleBreadcrumbClick(idx)}
                    style={{ cursor: "pointer", color: idx === breadcrumbs.length - 1 ? "#007AFF" : "#aaa" }}
                  >
                    {b.name}
                  </span>
                  {idx < breadcrumbs.length - 1 && " / "}
                </span>
              ))}
            </div>

            {/* 목록 창 */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                border: "1px solid #333",
                borderRadius: 6,
                padding: 8,
                minHeight: 200,
                background: "#141414",
              }}
            >
              {loading && <p style={{ color: "#888", textAlign: "center" }}>로딩 중...</p>}
              {!loading && items.length === 0 && (
                <p style={{ color: "#666", textAlign: "center" }}>표시할 오디오 파일 및 폴더가 없습니다.</p>
              )}
              {!loading &&
                items.map((item) => {
                  const isFolder = item.mimeType === FOLDER_MIME
                  const isSelected = selectedItemIds.has(item.id)
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleItemClick(item)}
                      style={{
                        padding: "8px 10px",
                        marginBottom: 4,
                        borderRadius: 4,
                        cursor: "pointer",
                        background: isSelected ? "rgba(0,122,255,0.2)" : "transparent",
                        border: isSelected ? "1px solid #007AFF" : "1px solid transparent",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span>{isFolder ? "📁" : "🎵"}</span>
                      <span style={{ flex: 1, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {item.name}
                      </span>
                    </div>
                  )
                })}
            </div>

            {errorMsg && <p style={{ color: "#ff4d4f", fontSize: 12, marginTop: 8 }}>{errorMsg}</p>}

            {/* 진행률 및 하단 컨트롤 */}
            <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                onClick={() => {
                  clearToken()
                  setToken(null)
                }}
                style={{ background: "none", border: "none", color: "#888", fontSize: 12, cursor: "pointer" }}
              >
                로그아웃
              </button>

              <button
                disabled={selectedItemIds.size === 0 || loading}
                onClick={handleImportSelected}
                style={{
                  background: selectedItemIds.size > 0 ? "#007AFF" : "#333",
                  color: selectedItemIds.size > 0 ? "#fff" : "#666",
                  border: "none",
                  borderRadius: 6,
                  padding: "8px 16px",
                  fontSize: 13,
                  cursor: selectedItemIds.size > 0 ? "pointer" : "default",
                }}
              >
                {downloadProgress !== null
                  ? `다운로드 중 (${downloadProgress}%)`
                  : `${selectedItemIds.size}개 가져오기`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}


// import React, { useState, useRef, useEffect, useCallback } from "react"
// import {
//   signInWithGoogle,
//   signInImplicit,
//   clearToken,
//   getStoredToken,
//   listDriveItems,
//   downloadDriveFile,
//   saveBlobToDirectory,
//   FOLDER_MIME,
//   type GDriveItem,
// } from "../../googleDrive"
// import {
//   DriveIcon,
//   DriveFileIcon,
//   DriveFolderIcon,
//   ChevronRight,
//   CheckIcon,
// } from "../common/Icons"

// const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ""

// type CloudStep = "provider" | "files" | "downloading" | "done"
// type CloudProvider = "google"
// type DriveItem = GDriveItem

// function formatBytes(bytes: string): string {
//   const n = parseInt(bytes, 10)
//   if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} MB`
//   if (n >= 1_000) return `${(n / 1_000).toFixed(0)} KB`
//   return `${n} B`
// }

// export interface CloudConnectModalProps {
//   open: boolean
//   onClose: () => void
//   onImport: (files: File[]) => void
//   realFileInputRef?: React.RefObject<HTMLInputElement | null>
// }

// export function CloudConnectModal({
//   open,
//   onClose,
//   onImport,
// }: CloudConnectModalProps) {
//   const [step, setStep] = useState<CloudStep>("provider")
//   const [, setProvider] = useState<CloudProvider | null>(null)
//   const [connecting, setConnecting] = useState(false)
//   const [connectError, setConnectError] = useState("")
//   const [driveItems, setDriveItems] = useState<DriveItem[]>([])
//   const [loadingItems, setLoadingItems] = useState(false)
//   const [loadError, setLoadError] = useState("")
//   const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
//   const [fileProgresses, setFileProgresses] = useState<Map<string, number>>(
//     new Map(),
//   )
//   const [downloadedFiles, setDownloadedFiles] = useState<Map<string, File>>(
//     new Map(),
//   )
//   const [saveDirName, setSaveDirName] = useState("")
//   const [accessToken, setAccessToken] = useState<string | null>(null)
//   const dirHandleRef = useRef<FileSystemDirectoryHandle | null>(null)
//   const [folderStack, setFolderStack] = useState<{ id: string, name: string }[]>(
//     [],
//   )

//   const currentFolderId =
//     folderStack.length > 0 ? folderStack[folderStack.length - 1].id : null

//   // Load Drive items whenever folder changes or token arrives
//   const loadItems = useCallback(
//     async (token: string, folderId: string | null) => {
//       setLoadingItems(true)
//       setLoadError("")
//       try {
//         const items = await listDriveItems(token, folderId)
//         setDriveItems(items)
//       } catch (e: any) {
//         if (e?.message === "UNAUTHORIZED") {
//           setAccessToken(null)
//           setStep("provider")
//           setConnectError("세션이 만료되었습니다. 다시 로그인해주세요.")
//         } else {
//           setLoadError("목록을 불러오지 못했습니다.")
//         }
//       } finally {
//         setLoadingItems(false)
//       }
//     },
//     [],
//   )

//   useEffect(() => {
//     if (step === "files" && accessToken) {
//       loadItems(accessToken, currentFolderId)
//     }
//   }, [step, accessToken, currentFolderId, loadItems])

//   const navigateInto = (item: DriveItem) => {
//     setFolderStack((prev) => [...prev, { id: item.id, name: item.name }])
//   }
//   const navigateTo = (index: number) => {
//     setFolderStack((prev) => prev.slice(0, index))
//   }

//   const reset = () => {
//     setStep("provider")
//     setProvider(null)
//     setConnecting(false)
//     setConnectError("")
//     setDriveItems([])
//     setLoadingItems(false)
//     setLoadError("")
//     setSelectedIds(new Set())
//     setFileProgresses(new Map())
//     setDownloadedFiles(new Map())
//     setSaveDirName("")
//     setAccessToken(null)
//     dirHandleRef.current = null
//     setFolderStack([])
//   }

//   const handleClose = () => {
//     reset()
//     onClose()
//   }

//   const handleProviderSelect = async (p: CloudProvider) => {
//     if (!GOOGLE_CLIENT_ID) {
//       setConnectError("VITE_GOOGLE_CLIENT_ID 환경 변수가 설정되지 않았습니다.")
//       return
//     }
//     // Reuse existing session token if valid
//     const cached = getStoredToken()
//     if (cached) {
//       setProvider(p)
//       setAccessToken(cached)
//       setStep("files")
//       return
//     }
//     setProvider(p)
//     setConnecting(true)
//     setConnectError("")
//     try {
//       let token: string
//       try {
//         token = await signInWithGoogle(GOOGLE_CLIENT_ID)
//       } catch {
//         token = await signInImplicit(GOOGLE_CLIENT_ID)
//       }
//       setAccessToken(token)
//       setConnecting(false)
//       setStep("files")
//     } catch (e: any) {
//       setConnecting(false)
//       if (e?.message === "AbortError") {
//         setProvider(null)
//         return
//       }
//       setConnectError(e?.message ?? "Google 로그인에 실패했습니다.")
//     }
//   }

//   const toggleFile = (id: string) => {
//     setSelectedIds((prev) => {
//       const next = new Set(prev)
//       next.has(id) ? next.delete(id) : next.add(id)
//       return next
//     })
//   }

//   const downloadOneFile = async (
//     token: string,
//     item: DriveItem,
//   ): Promise<File> => {
//     const blob = await downloadDriveFile(token, item.id, (pct) => {
//       setFileProgresses((prev) => new Map(prev).set(item.id, pct))
//     })
//     const file = await saveBlobToDirectory(
//       blob,
//       item.name,
//       dirHandleRef.current,
//     )
//     return file
//   }

//   const handlePickAndDownload = async () => {
//     if (selectedIds.size === 0 || !accessToken) return
//     let dirName = "다운로드 폴더"
//     try {
//       if ("showDirectoryPicker" in window) {
//         const handle = await (window as any).showDirectoryPicker({
//           mode: "readwrite",
//         })
//         dirHandleRef.current = handle
//         dirName = handle.name
//       }
//     } catch (e: any) {
//       if (e?.name === "AbortError") return
//     }
//     setSaveDirName(dirName)
//     const selected = driveItems.filter((f) => selectedIds.has(f.id))
//     const initial = new Map(selected.map((f) => [f.id, 0]))
//     setFileProgresses(initial)
//     setStep("downloading")

//     const results = new Map<string, File>()
//     const BATCH = 4
//     for (let i = 0; i < selected.length; i += BATCH) {
//       const batch = selected.slice(i, i + BATCH)
//       await Promise.all(
//         batch.map(async (item) => {
//           try {
//             const file = await downloadOneFile(accessToken, item)
//             results.set(item.id, file)
//           } catch {
//             setFileProgresses((prev) => new Map(prev).set(item.id, -1))
//           }
//         }),
//       )
//     }

//     setDownloadedFiles(results)
//     setStep("done")
//     setTimeout(() => {
//       const files = Array.from(results.values())
//       if (files.length > 0) onImport(files)
//       handleClose()
//     }, 1200)
//   }

//   const handleSignOut = () => {
//     clearToken()
//     setAccessToken(null)
//     setStep("provider")
//     setProvider(null)
//     setDriveItems([])
//     setFolderStack([])
//     setSelectedIds(new Set())
//   }

//   const visibleItems = driveItems
//   const audioItems = visibleItems.filter((i) => i.mimeType !== FOLDER_MIME)
//   const allSelected =
//     audioItems.length > 0 && audioItems.every((i) => selectedIds.has(i.id))

//   if (!open) return null

//   return (
//     <div className={`cloud-modal${open ? " open" : ""}`}>
//       {/* Header */}
//       <div
//         style={{
//           display: "flex",
//           alignItems: "center",
//           justifyContent: "space-between",
//           padding: "16px 16px 12px",
//           borderBottom: "1px solid #2c2c2e",
//           flexShrink: 0,
//         }}
//       >
//         <button
//           onClick={handleClose}
//           style={{
//             background: "none",
//             border: "none",
//             color: "#007AFF",
//             fontSize: 16,
//             cursor: "pointer",
//             padding: "4px 0",
//           }}
//         >
//           취소
//         </button>
//         <span style={{ fontWeight: 600, fontSize: 17, color: "#fff" }}>
//           {step === "provider"
//             ? "연결하기"
//             : step === "files"
//               ? "Google Drive"
//               : step === "downloading"
//                 ? "다운로드 중"
//                 : "완료"}
//         </span>
//         {step === "files" ? (
//           <button
//             onClick={handlePickAndDownload}
//             disabled={selectedIds.size === 0}
//             style={{
//               background: "none",
//               border: "none",
//               color: selectedIds.size ? "#007AFF" : "#3a3a3c",
//               fontSize: 16,
//               cursor: selectedIds.size ? "pointer" : "default",
//               fontWeight: 600,
//             }}
//           >
//             다음
//           </button>
//         ) : (
//           <div style={{ width: 48 }} />
//         )}
//       </div>

//       <div style={{ flex: 1, overflowY: "auto" }}>
//         {/* Provider selection */}
//         {step === "provider" && !connecting && (
//           <div style={{ padding: 20 }}>
//             <p
//               style={{
//                 color: "#636366",
//                 fontSize: 13,
//                 marginBottom: 24,
//                 lineHeight: 1.6,
//               }}
//             >
//               연결할 클라우드 드라이브를 선택하세요.
//             </p>
//             {connectError && (
//               <div
//                 style={{
//                   background: "#2a1010",
//                   border: "1px solid #5a2020",
//                   borderRadius: 10,
//                   padding: "10px 14px",
//                   fontSize: 12,
//                   color: "#ff6b6b",
//                   marginBottom: 16,
//                   lineHeight: 1.5,
//                 }}
//               >
//                 {connectError}
//               </div>
//             )}
//             <div
//               className="sheet-row"
//               style={{
//                 background: "#2c2c2e",
//                 borderRadius: 12,
//                 marginBottom: 10,
//                 padding: "14px 16px",
//               }}
//               onClick={() => handleProviderSelect("google")}
//             >
//               <div
//                 style={{
//                   width: 44,
//                   height: 44,
//                   borderRadius: 12,
//                   background: "#1c1c1e",
//                   display: "flex",
//                   alignItems: "center",
//                   justifyContent: "center",
//                   flexShrink: 0,
//                 }}
//               >
//                 <DriveIcon />
//               </div>
//               <div style={{ flex: 1 }}>
//                 <div style={{ color: "#fff", fontWeight: 600, fontSize: 15 }}>
//                   Google Drive
//                 </div>
//                 <div style={{ color: "#636366", fontSize: 12, marginTop: 2 }}>
//                   Google 계정으로 연결
//                 </div>
//               </div>
//               <ChevronRight />
//             </div>
//           </div>
//         )}

//         {/* OAuth connecting spinner */}
//         {connecting && (
//           <div
//             style={{
//               display: "flex",
//               flexDirection: "column",
//               alignItems: "center",
//               justifyContent: "center",
//               height: 300,
//               gap: 16,
//             }}
//           >
//             <svg
//               width="44"
//               height="44"
//               viewBox="0 0 44 44"
//               style={{ animation: "spin 0.9s linear infinite" }}
//             >
//               <circle
//                 cx="22"
//                 cy="22"
//                 r="18"
//                 fill="none"
//                 stroke="#2a2a2a"
//                 strokeWidth="3.5"
//               />
//               <circle
//                 cx="22"
//                 cy="22"
//                 r="18"
//                 fill="none"
//                 stroke="#007AFF"
//                 strokeWidth="3.5"
//                 strokeLinecap="round"
//                 strokeDasharray="28 85"
//               />
//             </svg>
//             <span
//               style={{
//                 fontFamily: "var(--font-mono)",
//                 fontSize: 12,
//                 color: "#636366",
//                 letterSpacing: "0.06em",
//               }}
//             >
//               Google 로그인 중...
//             </span>
//             <span
//               style={{
//                 fontSize: 11,
//                 color: "#48484a",
//                 maxWidth: 220,
//                 textAlign: "center",
//                 lineHeight: 1.5,
//               }}
//             >
//               팝업 창에서 Google 계정으로 로그인하세요
//             </span>
//           </div>
//         )}

//         {/* File browser */}
//         {step === "files" && (
//           <div>
//             {/* Breadcrumb + sign-out */}
//             <div
//               style={{
//                 padding: "10px 20px 8px",
//                 display: "flex",
//                 alignItems: "center",
//                 gap: 4,
//                 flexWrap: "wrap",
//               }}
//             >
//               <button
//                 onClick={() => navigateTo(0)}
//                 style={{
//                   background: "none",
//                   border: "none",
//                   padding: 0,
//                   cursor: "pointer",
//                   display: "flex",
//                   alignItems: "center",
//                   gap: 4,
//                 }}
//               >
//                 <svg
//                   width="13"
//                   height="13"
//                   viewBox="0 0 24 24"
//                   fill="none"
//                   stroke={folderStack.length === 0 ? "#e0e0e0" : "#636366"}
//                   strokeWidth="2"
//                   strokeLinecap="round"
//                 >
//                   <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
//                   <polyline points="9 22 9 12 15 12 15 22" />
//                 </svg>
//                 <span
//                   style={{
//                     fontFamily: "var(--font-mono)",
//                     fontSize: 11,
//                     color: folderStack.length === 0 ? "#e0e0e0" : "#636366",
//                     letterSpacing: "0.04em",
//                   }}
//                 >
//                   내 드라이브
//                 </span>
//               </button>
//               {folderStack.map((seg, idx) => (
//                 <span
//                   key={seg.id}
//                   style={{ display: "flex", alignItems: "center", gap: 4 }}
//                 >
//                   <svg
//                     width="6"
//                     height="10"
//                     viewBox="0 0 6 10"
//                     fill="none"
//                     stroke="#444"
//                     strokeWidth="1.5"
//                     strokeLinecap="round"
//                   >
//                     <polyline points="1,1 5,5 1,9" />
//                   </svg>
//                   <button
//                     onClick={() => navigateTo(idx + 1)}
//                     style={{
//                       background: "none",
//                       border: "none",
//                       padding: 0,
//                       cursor: "pointer",
//                       fontFamily: "var(--font-mono)",
//                       fontSize: 11,
//                       color:
//                         idx === folderStack.length - 1 ? "#e0e0e0" : "#636366",
//                       letterSpacing: "0.04em",
//                     }}
//                   >
//                     {seg.name}
//                   </button>
//                 </span>
//               ))}
//               <button
//                 onClick={handleSignOut}
//                 title="로그아웃"
//                 style={{
//                   marginLeft: "auto",
//                   background: "none",
//                   border: "none",
//                   padding: 0,
//                   cursor: "pointer",
//                   display: "flex",
//                   alignItems: "center",
//                 }}
//               >
//                 <svg
//                   width="14"
//                   height="14"
//                   viewBox="0 0 24 24"
//                   fill="none"
//                   stroke="#48484a"
//                   strokeWidth="2"
//                   strokeLinecap="round"
//                 >
//                   <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
//                   <polyline points="16 17 21 12 16 7" />
//                   <line x1="21" y1="12" x2="9" y2="12" />
//                 </svg>
//               </button>
//             </div>

//             {/* Toolbar */}
//             <div
//               style={{
//                 padding: "4px 20px 8px",
//                 display: "flex",
//                 justifyContent: "space-between",
//                 alignItems: "center",
//                 borderBottom: "1px solid #2c2c2e",
//               }}
//             >
//               <span
//                 style={{
//                   fontFamily: "var(--font-mono)",
//                   fontSize: 11,
//                   color: "#48484a",
//                   letterSpacing: "0.04em",
//                 }}
//               >
//                 {loadingItems
//                   ? "불러오는 중..."
//                   : `${audioItems.length}개 파일 · ${
//                       selectedIds.size > 0
//                         ? `${selectedIds.size}개 선택됨`
//                         : "선택 안됨"
//                     }`}
//               </span>
//               {audioItems.length > 0 && (
//                 <button
//                   onClick={() => {
//                     if (allSelected) setSelectedIds(new Set())
//                     else setSelectedIds(new Set(audioItems.map((i) => i.id)))
//                   }}
//                   style={{
//                     background: "none",
//                     border: "none",
//                     color: "#007AFF",
//                     fontSize: 13,
//                     cursor: "pointer",
//                   }}
//                 >
//                   {allSelected ? "전체 해제" : "전체 선택"}
//                 </button>
//               )}
//             </div>

//             {/* Loading spinner */}
//             {loadingItems && (
//               <div
//                 style={{
//                   display: "flex",
//                   justifyContent: "center",
//                   padding: 40,
//                 }}
//               >
//                 <svg
//                   width="32"
//                   height="32"
//                   viewBox="0 0 44 44"
//                   style={{ animation: "spin 0.9s linear infinite" }}
//                 >
//                   <circle
//                     cx="22"
//                     cy="22"
//                     r="18"
//                     fill="none"
//                     stroke="#2a2a2a"
//                     strokeWidth="3.5"
//                   />
//                   <circle
//                     cx="22"
//                     cy="22"
//                     r="18"
//                     fill="none"
//                     stroke="#007AFF"
//                     strokeWidth="3.5"
//                     strokeLinecap="round"
//                     strokeDasharray="28 85"
//                   />
//                 </svg>
//               </div>
//             )}

//             {/* Error */}
//             {loadError && !loadingItems && (
//               <div style={{ padding: "20px", textAlign: "center" }}>
//                 <div
//                   style={{ color: "#ff6b6b", fontSize: 13, marginBottom: 12 }}
//                 >
//                   {loadError}
//                 </div>
//                 <button
//                   onClick={() =>
//                     accessToken && loadItems(accessToken, currentFolderId)
//                   }
//                   style={{
//                     background: "#2c2c2e",
//                     border: "none",
//                     borderRadius: 8,
//                     padding: "8px 16px",
//                     color: "#007AFF",
//                     cursor: "pointer",
//                     fontSize: 13,
//                   }}
//                 >
//                   다시 시도
//                 </button>
//               </div>
//             )}

//             {/* Empty state */}
//             {!loadingItems && !loadError && visibleItems.length === 0 && (
//               <div
//                 style={{
//                   padding: "40px 20px",
//                   textAlign: "center",
//                   color: "#48484a",
//                   fontSize: 13,
//                 }}
//               >
//                 이 폴더는 비어 있습니다.
//               </div>
//             )}

//             {/* File/folder rows */}
//             {!loadingItems &&
//               visibleItems.map((item) => {
//                 const isFolder = item.mimeType === FOLDER_MIME
//                 const selected = selectedIds.has(item.id)
//                 const date = new Date(item.modifiedTime).toLocaleDateString(
//                   "ko-KR",
//                   {
//                     month: "short",
//                     day: "numeric",
//                   },
//                 )

//                 if (isFolder) {
//                   return (
//                     <div
//                       key={item.id}
//                       style={{
//                         display: "flex",
//                         alignItems: "center",
//                         gap: 14,
//                         padding: "11px 20px",
//                         borderBottom: "1px solid #1c1c1e",
//                         cursor: "pointer",
//                         background: "transparent",
//                         transition: "background 0.1s",
//                       }}
//                       onClick={() => navigateInto(item)}
//                     >
//                       <DriveFolderIcon />
//                       <div style={{ flex: 1, minWidth: 0 }}>
//                         <div
//                           style={{
//                             color: "#e0e0e0",
//                             fontSize: 14,
//                             fontWeight: 500,
//                             overflow: "hidden",
//                             textOverflow: "ellipsis",
//                             whiteSpace: "nowrap",
//                           }}
//                         >
//                           {item.name}
//                         </div>
//                         <div
//                           style={{
//                             color: "#48484a",
//                             fontSize: 11,
//                             marginTop: 2,
//                           }}
//                         >
//                           폴더 · {date}
//                         </div>
//                       </div>
//                       <svg
//                         width="8"
//                         height="13"
//                         viewBox="0 0 8 13"
//                         fill="none"
//                         stroke="#48484a"
//                         strokeWidth="2"
//                         strokeLinecap="round"
//                       >
//                         <polyline points="1,1 7,6.5 1,12" />
//                       </svg>
//                     </div>
//                   )
//                 }

//                 return (
//                   <div
//                     key={item.id}
//                     onClick={() => toggleFile(item.id)}
//                     style={{
//                       display: "flex",
//                       alignItems: "center",
//                       gap: 14,
//                       padding: "11px 20px",
//                       borderBottom: "1px solid #1c1c1e",
//                       cursor: "pointer",
//                       background: selected
//                         ? "rgba(0,122,255,0.08)"
//                         : "transparent",
//                       transition: "background 0.1s",
//                     }}
//                   >
//                     <DriveFileIcon mimeType={item.mimeType} />
//                     <div style={{ flex: 1, minWidth: 0 }}>
//                       <div
//                         style={{
//                           color: "#fff",
//                           fontSize: 14,
//                           fontWeight: 500,
//                           overflow: "hidden",
//                           textOverflow: "ellipsis",
//                           whiteSpace: "nowrap",
//                         }}
//                       >
//                         {item.name}
//                       </div>
//                       <div
//                         style={{
//                           color: "#48484a",
//                           fontSize: 11,
//                           marginTop: 3,
//                           display: "flex",
//                           gap: 6,
//                         }}
//                       >
//                         <span>{item.size ? formatBytes(item.size) : "—"}</span>
//                         <span style={{ color: "#333" }}>·</span>
//                         <span>{date}</span>
//                       </div>
//                     </div>
//                     <div
//                       style={{
//                         width: 22,
//                         height: 22,
//                         borderRadius: "50%",
//                         flexShrink: 0,
//                         border: `2px solid ${selected ? "#007AFF" : "#3a3a3c"}`,
//                         background: selected ? "#007AFF" : "transparent",
//                         display: "flex",
//                         alignItems: "center",
//                         justifyContent: "center",
//                         transition: "all 0.15s",
//                       }}
//                     >
//                       {selected && <CheckIcon size={11} />}
//                     </div>
//                   </div>
//                 )
//               })}
//           </div>
//         )}

//         {/* Per-file download progress */}
//         {step === "downloading" && (
//           <div style={{ padding: "16px 20px" }}>
//             <div
//               style={{
//                 display: "flex",
//                 alignItems: "center",
//                 gap: 10,
//                 marginBottom: 16,
//               }}
//             >
//               <svg
//                 width="16"
//                 height="16"
//                 viewBox="0 0 44 44"
//                 style={{
//                   animation: "spin 0.9s linear infinite",
//                   flexShrink: 0,
//                 }}
//               >
//                 <circle
//                   cx="22"
//                   cy="22"
//                   r="18"
//                   fill="none"
//                   stroke="#2a2a2a"
//                   strokeWidth="4"
//                 />
//                 <circle
//                   cx="22"
//                   cy="22"
//                   r="18"
//                   fill="none"
//                   stroke="#007AFF"
//                   strokeWidth="4"
//                   strokeLinecap="round"
//                   strokeDasharray="28 85"
//                 />
//               </svg>
//               <span style={{ color: "#fff", fontWeight: 600, fontSize: 15 }}>
//                 다운로드 중
//               </span>
//               <span
//                 style={{
//                   fontFamily: "var(--font-mono)",
//                   fontSize: 11,
//                   color: "#636366",
//                   marginLeft: "auto",
//                 }}
//               >
//                 {
//                   Array.from(fileProgresses.values()).filter((p) => p >= 100)
//                     .length
//                 }{" "}
//                 / {fileProgresses.size} 완료
//               </span>
//             </div>
//             {saveDirName && (
//               <div
//                 style={{
//                   fontFamily: "var(--font-mono)",
//                   fontSize: 11,
//                   color: "#48484a",
//                   marginBottom: 14,
//                   display: "flex",
//                   alignItems: "center",
//                   gap: 6,
//                 }}
//               >
//                 <svg
//                   width="12"
//                   height="12"
//                   viewBox="0 0 24 22"
//                   fill="none"
//                   stroke="#48484a"
//                   strokeWidth="1.5"
//                 >
//                   <path d="M2 5a2 2 0 0 1 2-2h4l2.5 3H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5z" />
//                 </svg>
//                 {saveDirName}
//               </div>
//             )}
//             <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
//               {driveItems
//                 .filter((f) => fileProgresses.has(f.id))
//                 .map((file) => {
//                   const pct = fileProgresses.get(file.id) ?? 0
//                   const failed = pct === -1
//                   const done = pct >= 100
//                   return (
//                     <div key={file.id}>
//                       <div
//                         style={{
//                           display: "flex",
//                           justifyContent: "space-between",
//                           alignItems: "center",
//                           marginBottom: 5,
//                         }}
//                       >
//                         <div
//                           style={{
//                             display: "flex",
//                             alignItems: "center",
//                             gap: 8,
//                             minWidth: 0,
//                           }}
//                         >
//                           {done ? (
//                             <svg
//                               width="14"
//                               height="14"
//                               viewBox="0 0 24 24"
//                               fill="none"
//                               stroke="#22c55e"
//                               strokeWidth="2.5"
//                               strokeLinecap="round"
//                               style={{ flexShrink: 0 }}
//                             >
//                               <polyline points="20 6 9 17 4 12" />
//                             </svg>
//                           ) : failed ? (
//                             <svg
//                               width="14"
//                               height="14"
//                               viewBox="0 0 24 24"
//                               fill="none"
//                               stroke="#ef4444"
//                               strokeWidth="2"
//                               strokeLinecap="round"
//                               style={{ flexShrink: 0 }}
//                             >
//                               <line x1="18" y1="6" x2="6" y2="18" />
//                               <line x1="6" y1="6" x2="18" y2="18" />
//                             </svg>
//                           ) : (
//                             <svg
//                               width="14"
//                               height="14"
//                               viewBox="0 0 24 24"
//                               fill="none"
//                               stroke="#007AFF"
//                               strokeWidth="2"
//                               strokeLinecap="round"
//                               style={{ flexShrink: 0 }}
//                             >
//                               <path d="M12 2v10M12 12l-3-3m3 3l3-3" />
//                               <path d="M2 17l.621 2.485A2 2 0 0 0 4.561 21h14.878a2 2 0 0 0 1.94-1.515L22 17" />
//                             </svg>
//                           )}
//                           <span
//                             style={{
//                               fontSize: 13,
//                               color: done
//                                 ? "#8e8e93"
//                                 : failed
//                                   ? "#ef4444"
//                                   : "#fff",
//                               overflow: "hidden",
//                               textOverflow: "ellipsis",
//                               whiteSpace: "nowrap",
//                             }}
//                           >
//                             {file.name}
//                           </span>
//                         </div>
//                         <span
//                           style={{
//                             fontFamily: "var(--font-mono)",
//                             fontSize: 11,
//                             color: done
//                               ? "#22c55e"
//                               : failed
//                                 ? "#ef4444"
//                                 : "#636366",
//                             flexShrink: 0,
//                             marginLeft: 8,
//                           }}
//                         >
//                           {done
//                             ? "완료"
//                             : failed
//                               ? "오류"
//                               : `${Math.round(pct)}%`}
//                         </span>
//                       </div>
//                       <div
//                         style={{
//                           background: "#2c2c2e",
//                           borderRadius: 3,
//                           height: 4,
//                           overflow: "hidden",
//                         }}
//                       >
//                         <div
//                           style={{
//                             height: "100%",
//                             borderRadius: 3,
//                             background: done
//                               ? "#22c55e"
//                               : failed
//                                 ? "#ef4444"
//                                 : "#007AFF",
//                             width: `${failed ? 100 : pct}%`,
//                             transition: "width 0.07s linear",
//                           }}
//                         />
//                       </div>
//                     </div>
//                   )
//                 })}
//             </div>
//           </div>
//         )}

//         {/* Done */}
//         {step === "done" && (
//           <div
//             style={{
//               display: "flex",
//               flexDirection: "column",
//               alignItems: "center",
//               justifyContent: "center",
//               padding: 40,
//               gap: 16,
//             }}
//           >
//             <div
//               style={{
//                 width: 64,
//                 height: 64,
//                 borderRadius: "50%",
//                 background: "#1a3a1a",
//                 border: "2px solid #22c55e",
//                 display: "flex",
//                 alignItems: "center",
//                 justifyContent: "center",
//               }}
//             >
//               <svg
//                 width="28"
//                 height="28"
//                 viewBox="0 0 24 24"
//                 fill="none"
//                 stroke="#22c55e"
//                 strokeWidth="2.5"
//                 strokeLinecap="round"
//               >
//                 <polyline points="20 6 9 17 4 12" />
//               </svg>
//             </div>
//             <div style={{ textAlign: "center" }}>
//               <div style={{ color: "#fff", fontWeight: 600, fontSize: 17 }}>
//                 다운로드 완료
//               </div>
//               <div style={{ color: "#636366", fontSize: 13, marginTop: 6 }}>
//                 {downloadedFiles.size}개 파일을 불러옵니다...
//               </div>
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   )
// }

// export default CloudConnectModal
