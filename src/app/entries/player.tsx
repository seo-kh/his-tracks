import React from "react"
import ReactDOM from "react-dom/client"
import App from "../App"
import "../../styles/index.css"

const playlistId = new URLSearchParams(window.location.search).get("playlistId")

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App initialPlaylistId={playlistId} />
  </React.StrictMode>,
)
