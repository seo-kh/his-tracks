import React from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { PlaylistProvider } from "./context/PlaylistContext"
import PlaylistScreen from "./screens/PlaylistScreen"
import PlayerScreen from "./screens/PlayerScreen"

import OAuthCallbackScreen from "./screens/OAuthCallbackScreen"

export default function App() {
  return (
    <PlaylistProvider>
      <BrowserRouter>
        <Routes>
          {/* OAuth 팝업 콜백 처리 경로 */}
          <Route path="/oauth/callback" element={<OAuthCallbackScreen />} />
          <Route path="/oauth/callback.html" element={<OAuthCallbackScreen />} />

          {/* 재생 목록 화면 (루트 경로) */}
          <Route path="/" element={<PlaylistScreen />} />

          {/* 특정 재생목록 플레이어 화면 */}
          <Route path="/player/:playlistId" element={<PlayerScreen />} />

          {/* CloudConnectModal 진입 URL 경로 */}
          <Route
            path="/player/:playlistId/connect"
            element={<PlayerScreen />}
          />

          {/* 기타 정의되지 않은 경로는 홈으로 리다이렉트 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </PlaylistProvider>
  )
}
