import { useHomeController } from './HomeController'
import { HomeView } from './HomeView'

export default function Home() {
  const controller = useHomeController()
  return <HomeView {...controller} />
}
