import CloudConnectModal from "./components/CloudConnectModal"
import type * as React from "react"

export interface CloudConnectScreenProps {
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

export default function CloudConnectScreen(props: CloudConnectScreenProps) {
  return <CloudConnectModal {...props} />
}
