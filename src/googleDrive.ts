// Google OAuth 2.0 + Drive API v3 integration
// Requires: Google Cloud Console project with OAuth 2.0 Web client credentials
// Scopes: https://www.googleapis.com/auth/drive.readonly

// Google OAuth 2.0 + Drive API v3 integration
// Requires: Google Cloud Console project with OAuth 2.0 Web client credentials
// Scopes: https://www.googleapis.com/auth/drive.readonly

const AUDIO_MIME_TYPES = [
  "audio/wav",
  "audio/mpeg",
  "audio/aiff",
  "audio/x-aiff",
  "audio/flac",
  "audio/ogg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
] as const

export type AudioMimeType = (typeof AUDIO_MIME_TYPES)[number]
export const FOLDER_MIME = "application/vnd.google-apps.folder"

export interface GDriveItem {
  id: string
  name: string
  mimeType: string
  size?: string
  modifiedTime: string
  parents?: string[]
}

export interface GDriveInfo {
  id: string // "user" (내 드라이브) 또는 Shared Drive ID
  name: string
  isSharedDrive: boolean
}

// ---------------------------------------------------------------------------
// OAuth 2.0 — Authorization Code with PKCE via popup window
// ---------------------------------------------------------------------------

function generateCodeVerifier(): string {
  const array = new Uint8Array(64)
  crypto.getRandomValues(array)
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const digest = await crypto.subtle.digest("SHA-256", data)
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

let _accessToken: string | null = null
let _tokenExpiry: number = 0

export function getStoredToken(): string | null {
  if (_accessToken && Date.now() < _tokenExpiry) return _accessToken
  const stored = sessionStorage.getItem("gd_token")
  const expiry = parseInt(sessionStorage.getItem("gd_expiry") ?? "0", 10)
  if (stored && Date.now() < expiry) {
    _accessToken = stored
    _tokenExpiry = expiry
    return stored
  }
  return null
}

function storeToken(token: string, expiresInSeconds: number) {
  _accessToken = token
  _tokenExpiry = Date.now() + expiresInSeconds * 1000 - 60_000 // 1 min buffer
  sessionStorage.setItem("gd_token", token)
  sessionStorage.setItem("gd_expiry", String(_tokenExpiry))
}

export function clearToken() {
  _accessToken = null
  _tokenExpiry = 0
  sessionStorage.removeItem("gd_token")
  sessionStorage.removeItem("gd_expiry")
}

// Opens OAuth popup, waits for redirect back with authorization code, exchanges for token.
// Uses PKCE so no client_secret is needed in the browser.
export async function signInWithGoogle(clientId: string): Promise<string> {
  const existing = getStoredToken()
  if (existing) return existing

  const verifier = generateCodeVerifier()
  const challenge = await generateCodeChallenge(verifier)

  const redirectUri = `${window.location.origin}/oauth/callback`
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/drive.readonly",
    code_challenge: challenge,
    code_challenge_method: "S256",
    access_type: "offline",
    prompt: "consent",
  })

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`

  return new Promise((resolve, reject) => {
    const popup = window.open(authUrl, "google_oauth", "width=520,height=640,left=200,top=100")
    if (!popup) {
      reject(new Error("팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요."))
      return
    }

    let isCompleted = false
    let pollClosed: ReturnType<typeof setInterval> | null = null
    const bc = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("google_oauth") : null

    const cleanup = () => {
      isCompleted = true
      if (pollClosed) {
        clearInterval(pollClosed)
        pollClosed = null
      }
      window.removeEventListener("message", handler)
      window.removeEventListener("storage", storageHandler)
      if (bc) {
        bc.removeEventListener("message", bcHandler)
        bc.close()
      }
    }

    const processCode = async (code: string, error?: string) => {
      if (isCompleted) return
      cleanup()
      if (popup && !popup.closed) {
        try {
          popup.close()
        } catch {
          /* ignore */
        }
      }
      if (error) {
        reject(new Error(error))
        return
      }
      try {
        const token = await exchangeCodeForToken(clientId, code, verifier, redirectUri)
        resolve(token)
      } catch (e) {
        reject(e)
      }
    }

    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (event.data?.type !== "GOOGLE_OAUTH_CODE") return
      processCode(event.data.code, event.data.error)
    }

    const bcHandler = (event: MessageEvent) => {
      if (event.data?.type !== "GOOGLE_OAUTH_CODE") return
      processCode(event.data.code, event.data.error)
    }
    if (bc) bc.addEventListener("message", bcHandler)

    const storageHandler = (e: StorageEvent) => {
      if (e.key === "google_oauth_result" && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue)
          if (parsed.data?.type === "GOOGLE_OAUTH_CODE") {
            localStorage.removeItem("google_oauth_result")
            processCode(parsed.data.code, parsed.data.error)
          }
        } catch {
          /* ignore */
        }
      }
    }

    window.addEventListener("message", handler)
    window.addEventListener("storage", storageHandler)

    pollClosed = setInterval(() => {
      if (popup.closed) {
        setTimeout(() => {
          if (!isCompleted) {
            cleanup()
            reject(new Error("AbortError"))
          }
        }, 500)
      }
    }, 500)
  })
}

async function exchangeCodeForToken(
  clientId: string,
  code: string,
  verifier: string,
  redirectUri: string,
): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      code,
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error_description ?? "Token exchange failed")
  }
  const json = await res.json()
  storeToken(json.access_token, json.expires_in ?? 3600)
  return json.access_token
}

// Implicit flow fallback — no PKCE, works without callback page
export async function signInImplicit(clientId: string): Promise<string> {
  const existing = getStoredToken()
  if (existing) return existing

  const redirectUri = `${window.location.origin}/oauth/callback`
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "token",
    scope: "https://www.googleapis.com/auth/drive.readonly",
    prompt: "consent",
  })

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`

  return new Promise((resolve, reject) => {
    const popup = window.open(authUrl, "google_oauth", "width=520,height=640,left=200,top=100")
    if (!popup) {
      reject(new Error("팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요."))
      return
    }

    let isCompleted = false
    let pollClosed: ReturnType<typeof setInterval> | null = null
    const bc = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("google_oauth") : null

    const cleanup = () => {
      isCompleted = true
      if (pollClosed) {
        clearInterval(pollClosed)
        pollClosed = null
      }
      window.removeEventListener("message", handler)
      window.removeEventListener("storage", storageHandler)
      if (bc) {
        bc.removeEventListener("message", bcHandler)
        bc.close()
      }
    }

    const processToken = (accessToken: string, expiresIn?: string | number, error?: string) => {
      if (isCompleted) return
      cleanup()
      if (popup && !popup.closed) {
        try {
          popup.close()
        } catch {
          /* ignore */
        }
      }
      if (error) {
        reject(new Error(error))
        return
      }
      storeToken(accessToken, parseInt(String(expiresIn ?? "3600"), 10))
      resolve(accessToken)
    }

    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (event.data?.type !== "GOOGLE_OAUTH_TOKEN") return
      processToken(event.data.access_token, event.data.expires_in, event.data.error)
    }

    const bcHandler = (event: MessageEvent) => {
      if (event.data?.type !== "GOOGLE_OAUTH_TOKEN") return
      processToken(event.data.access_token, event.data.expires_in, event.data.error)
    }
    if (bc) bc.addEventListener("message", bcHandler)

    const storageHandler = (e: StorageEvent) => {
      if (e.key === "google_oauth_result" && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue)
          if (parsed.data?.type === "GOOGLE_OAUTH_TOKEN") {
            localStorage.removeItem("google_oauth_result")
            processToken(parsed.data.access_token, parsed.data.expires_in, parsed.data.error)
          }
        } catch {
          /* ignore */
        }
      }
    }

    window.addEventListener("message", handler)
    window.addEventListener("storage", storageHandler)

    pollClosed = setInterval(() => {
      if (popup.closed) {
        setTimeout(() => {
          if (!isCompleted) {
            cleanup()
            reject(new Error("AbortError"))
          }
        }, 500)
      }
    }, 500)
  })
}

// ---------------------------------------------------------------------------
// Drive API v3 — drives listing (내 드라이브 + 공용 드라이브)
// ---------------------------------------------------------------------------

const DRIVE_LIST_URL = "https://www.googleapis.com/drive/v3/drives"

export async function listDrives(token: string): Promise<GDriveInfo[]> {
  const params = new URLSearchParams({
    pageSize: "100",
    fields: "nextPageToken,drives(id,name)",
  })

  const res = await fetch(`${DRIVE_LIST_URL}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (res.status === 401) {
    clearToken()
    throw new Error("UNAUTHORIZED")
  }
  if (!res.ok) throw new Error(`Drive API error: ${res.status}`)

  const json = await res.json()
  const sharedDrives: GDriveInfo[] = (json.drives ?? []).map((d: any) => ({
    id: d.id,
    name: d.name,
    isSharedDrive: true,
  }))

  return [{ id: "user", name: "내 드라이브", isSharedDrive: false }, ...sharedDrives]
}

// ---------------------------------------------------------------------------
// Drive API v3 — file listing
// ---------------------------------------------------------------------------

const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files"
const AUDIO_Q = AUDIO_MIME_TYPES.map((m) => `mimeType='${m}'`).join(" or ")
const FIELDS = "nextPageToken,files(id,name,mimeType,size,modifiedTime,parents)"

export async function listDriveItems(
  token: string,
  folderId: string | null,
  driveId: string = "user"
): Promise<GDriveItem[]> {
  // 공유 드라이브 선택 시 folderId가 전달되지 않았다면 해당 공유 드라이브의 root(driveId)를 사용
  const parentId = folderId ?? (driveId !== "user" ? driveId : "root")
  const folderQ = `'${parentId}' in parents and trashed=false and (mimeType='${FOLDER_MIME}' or (${AUDIO_Q}))`

  const params = new URLSearchParams({
    q: folderQ,
    fields: FIELDS,
    orderBy: "folder,name",
    pageSize: "200",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  })

  if (driveId !== "user") {
    params.append("corpora", "drive")
    params.append("driveId", driveId)
  } else {
    params.append("corpora", "user")
  }

  const res = await fetch(`${DRIVE_FILES_URL}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (res.status === 401) {
    clearToken()
    throw new Error("UNAUTHORIZED")
  }
  if (!res.ok) throw new Error(`Drive API error: ${res.status}`)

  const json = await res.json()
  return (json.files ?? []).map((f: any) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    size: f.size,
    modifiedTime: f.modifiedTime,
    parents: f.parents,
  }))
}

// ---------------------------------------------------------------------------
// Drive API v3 — file download with progress
// ---------------------------------------------------------------------------

export async function downloadDriveFile(
  token: string,
  fileId: string,
  onProgress: (pct: number) => void,
): Promise<Blob> {
  const url = `${DRIVE_FILES_URL}/${fileId}?alt=media&supportsAllDrives=true`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) throw new Error(`Download failed: ${res.status}`)

  const contentLength = res.headers.get("Content-Length")
  const total = contentLength ? parseInt(contentLength, 10) : 0

  if (!res.body) {
    onProgress(100)
    return res.blob()
  }

  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    received += value.length
    if (total > 0) onProgress(Math.min((received / total) * 100, 99))
  }

  onProgress(100)
  const all = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) {
    all.set(chunk, offset)
    offset += chunk.length
  }
  return new Blob([all])
}

// ---------------------------------------------------------------------------
// Save blob to FileSystem Access API (picked directory) or <a> download
// ---------------------------------------------------------------------------

export async function saveBlobToDirectory(
  blob: Blob,
  filename: string,
  dirHandle: FileSystemDirectoryHandle | null,
): Promise<File> {
  if (dirHandle) {
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(blob)
    await writable.close()
    return fileHandle.getFile()
  }
  return new File([blob], filename, { type: blob.type })
}
// const AUDIO_MIME_TYPES = [
//   "audio/wav",
//   "audio/mpeg",
//   "audio/aiff",
//   "audio/x-aiff",
//   "audio/flac",
//   "audio/ogg",
//   "audio/mp4",
//   "audio/x-m4a",
//   "audio/aac",
// ] as const

// export type AudioMimeType = (typeof AUDIO_MIME_TYPES)[number]
// export const FOLDER_MIME = "application/vnd.google-apps.folder"

// export interface GDriveItem {
//   id: string
//   name: string
//   mimeType: string
//   size?: string
//   modifiedTime: string
//   parents?: string[]
// }

// // ---------------------------------------------------------------------------
// // OAuth 2.0 — Authorization Code with PKCE via popup window
// // ---------------------------------------------------------------------------

// function generateCodeVerifier(): string {
//   const array = new Uint8Array(64)
//   crypto.getRandomValues(array)
//   return btoa(String.fromCharCode(...array))
//     .replace(/\+/g, "-")
//     .replace(/\//g, "_")
//     .replace(/=+$/, "")
// }

// async function generateCodeChallenge(verifier: string): Promise<string> {
//   const encoder = new TextEncoder()
//   const data = encoder.encode(verifier)
//   const digest = await crypto.subtle.digest("SHA-256", data)
//   return btoa(String.fromCharCode(...new Uint8Array(digest)))
//     .replace(/\+/g, "-")
//     .replace(/\//g, "_")
//     .replace(/=+$/, "")
// }

// let _accessToken: string | null = null
// let _tokenExpiry: number = 0

// export function getStoredToken(): string | null {
//   if (_accessToken && Date.now() < _tokenExpiry) return _accessToken
//   const stored = sessionStorage.getItem("gd_token")
//   const expiry = parseInt(sessionStorage.getItem("gd_expiry") ?? "0", 10)
//   if (stored && Date.now() < expiry) {
//     _accessToken = stored
//     _tokenExpiry = expiry
//     return stored
//   }
//   return null
// }

// function storeToken(token: string, expiresInSeconds: number) {
//   _accessToken = token
//   _tokenExpiry = Date.now() + expiresInSeconds * 1000 - 60_000 // 1 min buffer
//   sessionStorage.setItem("gd_token", token)
//   sessionStorage.setItem("gd_expiry", String(_tokenExpiry))
// }

// export function clearToken() {
//   _accessToken = null
//   _tokenExpiry = 0
//   sessionStorage.removeItem("gd_token")
//   sessionStorage.removeItem("gd_expiry")
// }

// // Opens OAuth popup, waits for redirect back with authorization code, exchanges for token.
// // Uses PKCE so no client_secret is needed in the browser.
// export async function signInWithGoogle(clientId: string): Promise<string> {
//   const existing = getStoredToken()
//   if (existing) return existing

//   const verifier = generateCodeVerifier()
//   const challenge = await generateCodeChallenge(verifier)

//   const redirectUri = `${window.location.origin}/oauth/callback`
//   const params = new URLSearchParams({
//     client_id: clientId,
//     redirect_uri: redirectUri,
//     response_type: "code",
//     scope: "https://www.googleapis.com/auth/drive.readonly",
//     code_challenge: challenge,
//     code_challenge_method: "S256",
//     access_type: "offline",
//     prompt: "consent",
//   })

//   const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`

//   return new Promise((resolve, reject) => {
//     const popup = window.open(authUrl, "google_oauth", "width=520,height=640,left=200,top=100")
//     if (!popup) {
//       reject(new Error("팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요."))
//       return
//     }

//     let isCompleted = false;
//     let pollClosed: ReturnType<typeof setInterval> | null = null;
//     const bc = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("google_oauth") : null;

//     const cleanup = () => {
//       isCompleted = true;
//       if (pollClosed) {
//         clearInterval(pollClosed);
//         pollClosed = null;
//       }
//       window.removeEventListener("message", handler);
//       window.removeEventListener("storage", storageHandler);
//       if (bc) {
//         bc.removeEventListener("message", bcHandler);
//         bc.close();
//       }
//     };

//     const processCode = async (code: string, error?: string) => {
//       if (isCompleted) return;
//       cleanup();
//       if (popup && !popup.closed) {
//         try {
//           popup.close();
//         } catch {
//           /* ignore */
//         }
//       }
//       if (error) {
//         reject(new Error(error));
//         return;
//       }
//       try {
//         const token = await exchangeCodeForToken(clientId, code, verifier, redirectUri);
//         resolve(token);
//       } catch (e) {
//         reject(e);
//       }
//     };

//     const handler = (event: MessageEvent) => {
//       if (event.origin !== window.location.origin) return;
//       if (event.data?.type !== "GOOGLE_OAUTH_CODE") return;
//       processCode(event.data.code, event.data.error);
//     };

//     const bcHandler = (event: MessageEvent) => {
//       if (event.data?.type !== "GOOGLE_OAUTH_CODE") return;
//       processCode(event.data.code, event.data.error);
//     };
//     if (bc) bc.addEventListener("message", bcHandler);

//     const storageHandler = (e: StorageEvent) => {
//       if (e.key === "google_oauth_result" && e.newValue) {
//         try {
//           const parsed = JSON.parse(e.newValue);
//           if (parsed.data?.type === "GOOGLE_OAUTH_CODE") {
//             localStorage.removeItem("google_oauth_result");
//             processCode(parsed.data.code, parsed.data.error);
//           }
//         } catch {
//           /* ignore */
//         }
//       }
//     };

//     window.addEventListener("message", handler);
//     window.addEventListener("storage", storageHandler);

//     pollClosed = setInterval(() => {
//       if (popup.closed) {
//         setTimeout(() => {
//           if (!isCompleted) {
//             cleanup();
//             reject(new Error("AbortError"));
//           }
//         }, 500);
//       }
//     }, 500);
//   });
// }

// async function exchangeCodeForToken(
//   clientId: string,
//   code: string,
//   verifier: string,
//   redirectUri: string,
// ): Promise<string> {
//   const res = await fetch("https://oauth2.googleapis.com/token", {
//     method: "POST",
//     headers: { "Content-Type": "application/x-www-form-urlencoded" },
//     body: new URLSearchParams({
//       client_id: clientId,
//       code,
//       code_verifier: verifier,
//       grant_type: "authorization_code",
//       redirect_uri: redirectUri,
//     }),
//   });
//   if (!res.ok) {
//     const err = await res.json().catch(() => ({}));
//     throw new Error(err.error_description ?? "Token exchange failed");
//   }
//   const json = await res.json();
//   storeToken(json.access_token, json.expires_in ?? 3600);
//   return json.access_token;
// }

// // Implicit flow fallback — no PKCE, works without callback page
// // Returns token directly from popup URL hash (token is short-lived, no refresh)
// export async function signInImplicit(clientId: string): Promise<string> {
//   const existing = getStoredToken();
//   if (existing) return existing;

//   const redirectUri = `${window.location.origin}/oauth/callback`;
//   const params = new URLSearchParams({
//     client_id: clientId,
//     redirect_uri: redirectUri,
//     response_type: "token",
//     scope: "https://www.googleapis.com/auth/drive.readonly",
//     prompt: "consent",
//   });

//   const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

//   return new Promise((resolve, reject) => {
//     const popup = window.open(authUrl, "google_oauth", "width=520,height=640,left=200,top=100");
//     if (!popup) {
//       reject(new Error("팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요."));
//       return;
//     }

//     let isCompleted = false;
//     let pollClosed: ReturnType<typeof setInterval> | null = null;
//     const bc = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("google_oauth") : null;

//     const cleanup = () => {
//       isCompleted = true;
//       if (pollClosed) {
//         clearInterval(pollClosed);
//         pollClosed = null;
//       }
//       window.removeEventListener("message", handler);
//       window.removeEventListener("storage", storageHandler);
//       if (bc) {
//         bc.removeEventListener("message", bcHandler);
//         bc.close();
//       }
//     };

//     const processToken = (accessToken: string, expiresIn?: string | number, error?: string) => {
//       if (isCompleted) return;
//       cleanup();
//       if (popup && !popup.closed) {
//         try {
//           popup.close();
//         } catch {
//           /* ignore */
//         }
//       }
//       if (error) {
//         reject(new Error(error));
//         return;
//       }
//       storeToken(accessToken, parseInt(String(expiresIn ?? "3600"), 10));
//       resolve(accessToken);
//     };

//     const handler = (event: MessageEvent) => {
//       if (event.origin !== window.location.origin) return;
//       if (event.data?.type !== "GOOGLE_OAUTH_TOKEN") return;
//       processToken(event.data.access_token, event.data.expires_in, event.data.error);
//     };

//     const bcHandler = (event: MessageEvent) => {
//       if (event.data?.type !== "GOOGLE_OAUTH_TOKEN") return;
//       processToken(event.data.access_token, event.data.expires_in, event.data.error);
//     };
//     if (bc) bc.addEventListener("message", bcHandler);

//     const storageHandler = (e: StorageEvent) => {
//       if (e.key === "google_oauth_result" && e.newValue) {
//         try {
//           const parsed = JSON.parse(e.newValue);
//           if (parsed.data?.type === "GOOGLE_OAUTH_TOKEN") {
//             localStorage.removeItem("google_oauth_result");
//             processToken(parsed.data.access_token, parsed.data.expires_in, parsed.data.error);
//           }
//         } catch {
//           /* ignore */
//         }
//       }
//     };

//     window.addEventListener("message", handler);
//     window.addEventListener("storage", storageHandler);

//     pollClosed = setInterval(() => {
//       if (popup.closed) {
//         setTimeout(() => {
//           if (!isCompleted) {
//             cleanup();
//             reject(new Error("AbortError"));
//           }
//         }, 500);
//       }
//     }, 500);
//   });
// }

// // ---------------------------------------------------------------------------
// // Drive API v3 — file listing
// // ---------------------------------------------------------------------------

// const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files"
// const AUDIO_Q = AUDIO_MIME_TYPES.map((m) => `mimeType='${m}'`).join(" or ")
// const FIELDS = "nextPageToken,files(id,name,mimeType,size,modifiedTime,parents)"

// export async function listDriveItems(
//   token: string,
//   folderId: string | null,
// ): Promise<GDriveItem[]> {
//   const parentId = folderId ?? "root"
//   // List folders + audio files inside the current folder
//   const folderQ = `'${parentId}' in parents and trashed=false and (mimeType='${FOLDER_MIME}' or (${AUDIO_Q}))`

//   const params = new URLSearchParams({
//     q: folderQ,
//     fields: FIELDS,
//     orderBy: "folder,name",
//     pageSize: "200",
//   })

//   const res = await fetch(`${DRIVE_FILES_URL}?${params}`, {
//     headers: { Authorization: `Bearer ${token}` },
//   })

//   if (res.status === 401) {
//     clearToken()
//     throw new Error("UNAUTHORIZED")
//   }
//   if (!res.ok) throw new Error(`Drive API error: ${res.status}`)

//   const json = await res.json()
//   return (json.files ?? []).map((f: any) => ({
//     id: f.id,
//     name: f.name,
//     mimeType: f.mimeType,
//     size: f.size,
//     modifiedTime: f.modifiedTime,
//     parents: f.parents,
//   }))
// }

// // ---------------------------------------------------------------------------
// // Drive API v3 — file download with progress
// // ---------------------------------------------------------------------------

// export async function downloadDriveFile(
//   token: string,
//   fileId: string,
//   onProgress: (pct: number) => void,
// ): Promise<Blob> {
//   const res = await fetch(`${DRIVE_FILES_URL}/${fileId}?alt=media`, {
//     headers: { Authorization: `Bearer ${token}` },
//   })

//   if (!res.ok) throw new Error(`Download failed: ${res.status}`)

//   const contentLength = res.headers.get("Content-Length")
//   const total = contentLength ? parseInt(contentLength, 10) : 0

//   if (!res.body) {
//     onProgress(100)
//     return res.blob()
//   }

//   const reader = res.body.getReader()
//   const chunks: Uint8Array[] = []
//   let received = 0

//   while (true) {
//     const { done, value } = await reader.read()
//     if (done) break
//     chunks.push(value)
//     received += value.length
//     if (total > 0) onProgress(Math.min((received / total) * 100, 99))
//   }

//   onProgress(100)
//   const all = new Uint8Array(received)
//   let offset = 0
//   for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.length }
//   return new Blob([all])
// }

// // ---------------------------------------------------------------------------
// // Save blob to FileSystem Access API (picked directory) or <a> download
// // ---------------------------------------------------------------------------

// export async function saveBlobToDirectory(
//   blob: Blob,
//   filename: string,
//   dirHandle: FileSystemDirectoryHandle | null,
// ): Promise<File> {
//   if (dirHandle) {
//     const fileHandle = await dirHandle.getFileHandle(filename, { create: true })
//     const writable = await fileHandle.createWritable()
//     await writable.write(blob)
//     await writable.close()
//     return fileHandle.getFile()
//   }
//   // Fallback: return as File object for direct AudioContext decoding
//   return new File([blob], filename, { type: blob.type })
// }
