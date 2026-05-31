import { useRef, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth, useUser } from '@clerk/clerk-react'
import { useGestureDetector } from '@/hooks/useGestureDetector'
import { useMultiplayer } from '@/hooks/useMultiplayer'
import { ROUTES } from '@/routes'
import type { MatchContext } from '../types'

const SERVER = import.meta.env.VITE_SERVER_URL
const WS_PROTO = window.location.protocol === 'https:' ? 'wss' : 'ws'

function useIsMobile() {
  const [v, setV] = useState(() => window.matchMedia('(max-width: 767px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const h = (e: MediaQueryListEvent) => setV(e.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])
  return v
}

function loadMatchContext(): MatchContext {
  try {
    const raw = sessionStorage.getItem('match_context')
    if (raw) return JSON.parse(raw) as MatchContext
  } catch { /* ignore */ }
  return { myScore: 0, oppScore: 0, oppNick: 'Adversário' }
}

export function useRoomController() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const matchCtx = loadMatchContext()
  const { getToken } = useAuth()
  const { user } = useUser()
  const myNick = sessionStorage.getItem('my_nick') ?? user?.firstName ?? 'Você'

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)

  const isTrain = new URLSearchParams(window.location.search).get('mode') === 'train'
  const roomWsUrl = isTrain ? '' : `${WS_PROTO}://${SERVER}/room/${roomId}`
  const { count, status: gestureStatus } = useGestureDetector(videoRef, canvasRef, isTrain)

  const countRef = useRef(0)
  countRef.current = count
  const baseCountRef = useRef(0)
  const gameStartedRef = useRef(false)

  const { status: mpStatus, opponentCount, countdown, remaining, gameOver, latencyMs, opponentReconnecting } = useMultiplayer({
    roomWsUrl,
    localCount: gameStartedRef.current ? Math.max(0, count - baseCountRef.current) : 0,
    localVideoRef: videoRef,
    remoteVideoRef,
    getToken,
  })

  useEffect(() => {
    if ((remaining !== null || isTrain) && !gameStartedRef.current) {
      gameStartedRef.current = true
      baseCountRef.current = countRef.current
    }
    if (!isTrain && remaining === null && gameOver === null) {
      gameStartedRef.current = false
    }
  }, [remaining, gameOver, isTrain])

  const gameCount = gameStartedRef.current ? Math.max(0, count - baseCountRef.current) : 0
  const isMatched = mpStatus === 'matched'

  useEffect(() => {
    if (mpStatus === 'error') navigate(ROUTES.HOME, { replace: true })
  }, [mpStatus, navigate])

  const [cameraReady, setCameraReady] = useState(false)
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (video.readyState >= 2) { setCameraReady(true); return }
    const onReady = () => { if (video.readyState >= 2) setCameraReady(true) }
    video.addEventListener('loadeddata', onReady)
    return () => video.removeEventListener('loadeddata', onReady)
  }, [])

  return {
    videoRef, canvasRef, remoteVideoRef,
    isMobile, isMatched, cameraReady, matchCtx,
    gameCount, gestureStatus, mpStatus, opponentCount,
    countdown, remaining, gameOver, latencyMs, opponentReconnecting, navigate,
    isTrain, user, myNick,
  }
}
