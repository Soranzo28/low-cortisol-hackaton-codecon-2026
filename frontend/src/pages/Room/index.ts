import { useRoomController } from './RoomController'
import { RoomView } from './RoomView'

export default function RoomPage() {
  const controller = useRoomController()
  return <RoomView {...controller} />
}
