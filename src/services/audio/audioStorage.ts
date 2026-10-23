export interface StoredTrackMetadata {
  id: string
  name: string
  fileName: string
  path: string
  duration: number
  muted: boolean
  soloed: boolean
  volume: number
  color: string
}

const DB_NAME = "his-tracks-audio"
const DB_VERSION = 1
const FILE_STORE = "files"
const HANDLE_STORE = "directory-handles"

function metadataKey(playlistId: string) {
  return `his-tracks:${playlistId}:tracks`
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(FILE_STORE)) db.createObjectStore(FILE_STORE)
      if (!db.objectStoreNames.contains(HANDLE_STORE)) db.createObjectStore(HANDLE_STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function runTransaction(
  storeName: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => void,
): Promise<void> {
  return openDatabase().then(
    (db) =>
      new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, mode)
        action(transaction.objectStore(storeName))
        transaction.oncomplete = () => {
          db.close()
          resolve()
        }
        transaction.onerror = () => {
          db.close()
          reject(transaction.error)
        }
      }),
  )
}

function getFromStore<T>(storeName: string, key: string): Promise<T | undefined> {
  return openDatabase().then(
    (db) =>
      new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readonly")
        const request = transaction.objectStore(storeName).get(key)
        request.onsuccess = () => resolve(request.result as T | undefined)
        request.onerror = () => reject(request.error)
        transaction.oncomplete = () => db.close()
      }),
  )
}

export function loadTrackMetadata(playlistId: string): StoredTrackMetadata[] {
  try {
    const raw = localStorage.getItem(metadataKey(playlistId))
    return raw ? (JSON.parse(raw) as StoredTrackMetadata[]) : []
  } catch {
    return []
  }
}

export function saveTrackMetadata(playlistId: string, tracks: StoredTrackMetadata[]) {
  try {
    localStorage.setItem(metadataKey(playlistId), JSON.stringify(tracks))
  } catch {
    // Current-session playback remains available when persistent storage is full.
  }
}

export async function persistAudioFiles(
  playlistId: string,
  files: File[],
  directoryHandle: FileSystemDirectoryHandle | null,
) {
  await runTransaction(FILE_STORE, "readwrite", (store) => {
    files.forEach((file) => store.put(file, `${playlistId}/${file.name}`))
  })

  if (directoryHandle) {
    await runTransaction(HANDLE_STORE, "readwrite", (store) => {
      store.put(directoryHandle, playlistId)
    })
  }
}

async function fileFromDirectory(
  handle: FileSystemDirectoryHandle,
  fileName: string,
): Promise<File | null> {
  try {
    const permissionHandle = handle as FileSystemDirectoryHandle & {
      queryPermission?: (options: { mode: "read" }) => Promise<PermissionState>
    }
    const permission = permissionHandle.queryPermission
      ? await permissionHandle.queryPermission({ mode: "read" })
      : "granted"
    if (permission !== "granted") return null
    return await (await handle.getFileHandle(fileName)).getFile()
  } catch {
    return null
  }
}

export async function loadPlaylistAudio(playlistId: string) {
  const metadata = loadTrackMetadata(playlistId)
  if (metadata.length === 0) return []

  let directoryHandle: FileSystemDirectoryHandle | undefined
  try {
    directoryHandle = await getFromStore<FileSystemDirectoryHandle>(HANDLE_STORE, playlistId)
  } catch {
    // A stored directory handle is an enhancement; cached files remain the fallback.
  }

  return Promise.all(
    metadata.map(async (track) => {
      let file = directoryHandle
        ? await fileFromDirectory(directoryHandle, track.fileName)
        : null
      if (!file) {
        try {
          file =
            (await getFromStore<File>(FILE_STORE, `${playlistId}/${track.fileName}`)) ??
            null
        } catch {
          file = null
        }
      }
      return file ? { metadata: track, file } : null
    }),
  ).then((items) => items.filter((item): item is NonNullable<typeof item> => item !== null))
}

export async function deletePlaylistAudio(playlistId: string) {
  const metadata = loadTrackMetadata(playlistId)
  localStorage.removeItem(metadataKey(playlistId))
  await runTransaction(FILE_STORE, "readwrite", (store) => {
    metadata.forEach((track) => store.delete(`${playlistId}/${track.fileName}`))
  }).catch(() => undefined)
  await runTransaction(HANDLE_STORE, "readwrite", (store) => {
    store.delete(playlistId)
  }).catch(() => undefined)
}

export async function deletePlaylistAudioFiles(
  playlistId: string,
  fileNames: string[],
) {
  await runTransaction(FILE_STORE, "readwrite", (store) => {
    fileNames.forEach((fileName) => store.delete(`${playlistId}/${fileName}`))
  }).catch(() => undefined)
}
