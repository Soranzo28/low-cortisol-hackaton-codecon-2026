import { useHomeController } from './controller'
import { HomeView } from './view'

export default function Home() {
  const controller = useHomeController()
  return <HomeView {...controller} />
}
