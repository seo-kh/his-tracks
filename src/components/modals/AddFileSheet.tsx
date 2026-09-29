import React from "react"
import { GlobeIcon, FileFolderIcon, ChevronRight } from "../common/Icons"

export interface AddFileSheetProps {
  open: boolean
  onClose: () => void
  onPickFiles: () => void
  onConnect: () => void
}

export function AddFileSheet({
  open,
  onClose,
  onPickFiles,
  onConnect,
}: AddFileSheetProps) {
  return (
    <>
      <div
        className={`sheet-overlay${open ? " open" : ""}`}
        onClick={onClose}
      />
      <div className={`add-file-sheet${open ? " open" : ""}`}>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "10px 0 4px",
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
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 16px 16px",
          }}
        >
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "#3a3a3c",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <line x1="1" y1="1" x2="13" y2="13" />
              <line x1="13" y1="1" x2="1" y2="13" />
            </svg>
          </button>
          <span style={{ fontWeight: 600, fontSize: 16, color: "#fff" }}>
            파일 추가하기
          </span>
          <div style={{ width: 32 }} />
        </div>
        <div
          style={{
            padding: "0 20px 8px",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "#636366",
            letterSpacing: "0.06em",
          }}
        >
          위치
        </div>
        <div
          style={{
            background: "#2c2c2e",
            borderRadius: 12,
            margin: "0 16px 16px",
          }}
        >
          <div
            className="sheet-row"
            onClick={() => {
              onClose()
              setTimeout(onPickFiles, 300)
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "#1c3a5e",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <FileFolderIcon />
            </div>
            <span
              style={{ flex: 1, fontSize: 16, color: "#fff", fontWeight: 500 }}
            >
              파일 가져오기
            </span>
            <ChevronRight />
          </div>
          <div
            className="sheet-row"
            onClick={() => {
              onClose()
              setTimeout(onConnect, 300)
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "#0a2a3a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <GlobeIcon />
            </div>
            <span
              style={{ flex: 1, fontSize: 16, color: "#fff", fontWeight: 500 }}
            >
              연결하기
            </span>
            <ChevronRight />
          </div>
        </div>
        <div
          style={{
            padding: "0 20px 20px",
            fontSize: 12,
            color: "#636366",
            lineHeight: 1.6,
          }}
        >
          <p style={{ margin: "0 0 6px" }}>
            • <b style={{ color: "#8e8e93" }}>파일 가져오기:</b> 기기에 저장된
            음원 파일을 직접 불러옵니다.
          </p>
          <p style={{ margin: 0 }}>
            • <b style={{ color: "#8e8e93" }}>연결하기:</b> 클라우드
            드라이브에서 파일을 선택하고 다운로드합니다.
          </p>
        </div>
      </div>
    </>
  )
}

export default AddFileSheet
