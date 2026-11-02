import PlaylistView from "./components/PlaylistView"
import type { Playlist, SortOrder } from "../../shared/types"

export interface PlaylistScreenProps {
  playlists: Playlist[]
  onOpen: (id: string) => void
  onCreate: (name: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onSort: (order: SortOrder) => void
  sortOrder: SortOrder
}

export default function PlaylistScreen(props: PlaylistScreenProps) {
  return <PlaylistView {...props} />
}
