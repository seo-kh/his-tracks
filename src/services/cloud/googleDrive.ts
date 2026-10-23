// Google OAuth 2.0 + Drive API v3 integration
//
// Auth flow (server-side, production):
//   1. Redirect browser to  GET /auth/google  (Express server)
//   2. Server handles Google consent + code exchange
//   3. Server redirects back to SPA with  #access_token=...&expires_in=...
//   4. SPA reads URL hash on mount and stores token in sessionStorage
//
// Auth flow (client-side PKCE, development / fallback):
//   signInWithGoogle() / signInImplicit() open a popup and receive the token
//   directly from Google without hitting the Express server.
//
// Call initFromHash() once at app startup to pick up tokens from server flow.

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

// ---------------------------------------------------------------------------
// Server-flow token bootstrap
// ---------------------------------------------------------------------------

/**
 * Call once on app mount.
 * Reads #access_token=...&expires_in=... placed in the URL hash by the
 * Express /auth/google/callback redirect, stores the token, then clears
 * the hash so the token isn't visible in the browser history.
 *
 * Also handles #logout=1 (server logout redirect) and #auth_error=... .
 *
 * Returns the access token if one was found in the hash, otherwise null.
 */
export function initFromHash(): string | null {
  if (typeof window === "undefined") return null

  const hash = window.location.hash.slice(1)
  if (!hash) return getStoredToken()

  const params = new URLSearchParams(hash)

  // Server logout signal
  if (params.get("logout") === "1") {
    clearToken()
    history.replaceState(null, "", window.location.pathname)
    return null
  }

  // Auth error from server callback
  const authError = params.get("auth_error")
  if (authError) {
    console.error("[googleDrive] OAuth error from server:", authError)
    history.replaceState(null, "", window.location.pathname)
    return null
  }

  // Successful token from server callback
  const accessToken = params.get("access_token")
  const expiresIn = parseInt(params.get("expires_in") ?? "3600", 10)
  if (accessToken) {
    storeToken(accessToken, expiresIn)
    // Remove hash from URL bar without creating a history entry
    history.replaceState(null, "", window.location.pathname)
    return accessToken
  }

  return getStoredToken()
}

// ---------------------------------------------------------------------------
// Server-flow sign-in (redirect, not popup)
// ---------------------------------------------------------------------------

/**
 * Redirect the current tab to the Express auth endpoint.
 * The server will redirect to Google, handle the callback, and send the
 * user back to the SPA with the token in the URL hash.
 *
 * Use this in production when the Express server is running.
 * Falls back to signInWithGoogle() popup for local dev without a server.
 */
export function signInViaServer(): void {
  const returnTo = `${window.location.pathname}${window.location.search}`

  window.location.href = `/auth/google?returnTo=${encodeURIComponent(returnTo)}`
}

/**
 * Logout via server (clears server-side state if any) then clears local token.
 */
export function signOutViaServer(): void {
  clearToken()
  window.location.href = "/auth/logout"
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

    const handler = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (event.data?.type !== "GOOGLE_OAUTH_CODE") return
      window.removeEventListener("message", handler)
      popup.close()

      const { code, error } = event.data
      if (error) { reject(new Error(error)); return }

      try {
        const token = await exchangeCodeForToken(clientId, code, verifier, redirectUri)
        resolve(token)
      } catch (e) {
        reject(e)
      }
    }

    window.addEventListener("message", handler)

    // Detect popup closed without completing auth
    const pollClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(pollClosed)
        window.removeEventListener("message", handler)
        reject(new Error("AbortError"))
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
// Returns token directly from popup URL hash (token is short-lived, no refresh)
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

    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (event.data?.type !== "GOOGLE_OAUTH_TOKEN") return
      window.removeEventListener("message", handler)
      popup.close()

      const { access_token, expires_in, error } = event.data
      if (error) { reject(new Error(error)); return }
      storeToken(access_token, parseInt(expires_in ?? "3600", 10))
      resolve(access_token)
    }

    window.addEventListener("message", handler)

    const pollClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(pollClosed)
        window.removeEventListener("message", handler)
        reject(new Error("AbortError"))
      }
    }, 500)
  })
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
): Promise<GDriveItem[]> {
  const parentId = folderId ?? "root"
  // List folders + audio files inside the current folder
  const folderQ = `'${parentId}' in parents and trashed=false and (mimeType='${FOLDER_MIME}' or (${AUDIO_Q}))`

  const params = new URLSearchParams({
    q: folderQ,
    fields: FIELDS,
    orderBy: "folder,name",
    pageSize: "200",
  })

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
  const res = await fetch(`${DRIVE_FILES_URL}/${fileId}?alt=media`, {
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
  for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.length }
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
  // Fallback: return as File object for direct AudioContext decoding
  return new File([blob], filename, { type: blob.type })
}

export async function saveBlobToFileHandle(
  blob: Blob,
  fileHandle: FileSystemFileHandle,
): Promise<File> {
  const writable = await fileHandle.createWritable()
  await writable.write(blob)
  await writable.close()
  return fileHandle.getFile()
}
