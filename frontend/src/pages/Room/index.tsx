import { useRoomController } from './controller'
import { RoomView } from './view'

export default function RoomPage() {
  const controller = useRoomController()
  return <RoomView {...controller} />
}
