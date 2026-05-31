import { useRef, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { useGestureDetector } from '@/hooks/useGestureDetector'
import { useMultiplayer } from '@/hooks/useMultiplayer'
import type { MatchContext } from './types'

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

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)

  const roomWsUrl = `${WS_PROTO}://${SERVER}/room/${roomId}`

  const { count, status: gestureStatus } = useGestureDetector(videoRef, canvasRef)

  // ── Base count tracking ────────────────────────────────────────────────────
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
    if (remaining !== null && !gameStartedRef.current) {
      gameStartedRef.current = true
      baseCountRef.current = countRef.current
    }
    if (remaining === null && gameOver === null) {
      gameStartedRef.current = false
    }
  }, [remaining, gameOver])

  const gameCount = gameStartedRef.current ? Math.max(0, count - baseCountRef.current) : 0
  const isMatched = mpStatus === 'matched'

  useEffect(() => {
    if (mpStatus === 'error') navigate('/', { replace: true })
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
    // Refs
    videoRef,
    canvasRef,
    remoteVideoRef,

    // Layout
    isMobile,
    isMatched,
    cameraReady,

    // Match context
    matchCtx,

    // Game state
    gameCount,
    gestureStatus,
    mpStatus,
    opponentCount,
    countdown,
    remaining,
    gameOver,
    latencyMs,
    opponentReconnecting,

    // Navigation
    navigate,
  }
}
