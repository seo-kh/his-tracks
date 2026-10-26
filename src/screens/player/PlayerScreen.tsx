import PlayerWorkspace from "./components/PlayerWorkspace"
import type { Playlist, Track } from "../../shared/types"

export interface PlayerScreenProps {
  playlist: Playlist
  initialTracks: Track[]
  onBack: (tracks: Track[]) => void
}

export default function PlayerScreen(props: PlayerScreenProps) {
  return <PlayerWorkspace {...props} />
}
