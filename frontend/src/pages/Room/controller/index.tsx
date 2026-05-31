import { useRef, useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth, useUser } from '@clerk/clerk-react'
import absoluteCinemaGif from '@/assets/absolute_cinema.gif'
import dogPidaoGif from '@/assets/dog_pidao.gif'
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

  // ── Event state ─────────────────────────────────────────────────────────────
  const [detectionMode, setDetectionMode] = useState<'normal' | 'event'>('normal')
  const [eventPanelVisible, setEventPanelVisible] = useState(false)
  const [eventCountdown, setEventCountdown] = useState(0)
  const [localGlowActive, setLocalGlowActive] = useState(false)
  const [localGlowFading, setLocalGlowFading] = useState(false)
  const [opponentGlowActive, setOpponentGlowActive] = useState(false)
  const [opponentGlowFading, setOpponentGlowFading] = useState(false)
  const [eventWinnerName, setEventWinnerName] = useState<string | null>(null)
  const [eventBonus, setEventBonus] = useState(0)
  const [opponentEventBonus, setOpponentEventBonus] = useState(0)
  const [activeEventId, setActiveEventId] = useState<string | null>(null)
  const [trainSelectedEvent, setTrainSelectedEvent] = useState<string | null>(null)

  const activeEventIdRef = useRef<string | null>(null)
  const sendMessageRef = useRef<((msg: object) => void) | null>(null)
  const isTrainRef = useRef(false)
  // Always-fresh reset fn for train mode completion (avoids stale closure in useCallback)
  const resetTrainSelectionRef = useRef<() => void>(() => {})
  resetTrainSelectionRef.current = () => {
    setTrainSelectedEvent(null)
    setActiveEventId(null)
    setDetectionMode('normal')
  }

  const onEventComplete = useCallback(() => {
    setDetectionMode('normal')
    if (isTrainRef.current) {
      setLocalGlowActive(true); setLocalGlowFading(false)
      setTimeout(() => setLocalGlowFading(true), 4500)
      setTimeout(() => { setLocalGlowActive(false); setLocalGlowFading(false) }, 5000)
      resetTrainSelectionRef.current()
      return
    }
    const eventId = activeEventIdRef.current
    if (!eventId) return
    sendMessageRef.current?.({ type: 'event_complete', event_id: eventId })
    activeEventIdRef.current = null
  }, [])

  // ── Gesture detector (mode-aware) ────────────────────────────────────────────
  const isTrain = new URLSearchParams(window.location.search).get('mode') === 'train'
  isTrainRef.current = isTrain
  const { count, status: gestureStatus } = useGestureDetector(videoRef, canvasRef, isTrain, detectionMode, activeEventId, onEventComplete)

  const selectTrainEvent = useCallback((eventId: string) => {
    if (trainSelectedEvent === eventId) {
      // deselect
      setTrainSelectedEvent(null)
      setActiveEventId(null)
      setDetectionMode('normal')
    } else {
      setTrainSelectedEvent(eventId)
      setActiveEventId(eventId)
      setDetectionMode('event')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainSelectedEvent])

  const countRef = useRef(0)
  countRef.current = count
  const baseCountRef = useRef(0)
  const gameStartedRef = useRef(false)

  const roomWsUrl = isTrain ? '' : `${WS_PROTO}://${SERVER}/room/${roomId}`
  const {
    status: mpStatus, opponentCount, countdown, remaining, gameOver,
    latencyMs, opponentReconnecting,
    activeEvent, eventWinner, eventExpired, sendMessage,
  } = useMultiplayer({
    roomWsUrl,
    localCount: gameStartedRef.current ? Math.max(0, count - baseCountRef.current) : 0,
    localVideoRef: videoRef,
    remoteVideoRef,
    getToken,
  })

  // Keep sendMessageRef fresh
  sendMessageRef.current = sendMessage

  // ── Event: activate ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeEvent) return
    activeEventIdRef.current = activeEvent.eventId
    setActiveEventId(activeEvent.eventId)
    setDetectionMode('event')
    setEventPanelVisible(true)
    setEventCountdown(activeEvent.duration)
  }, [activeEvent])

  // Countdown tick
  useEffect(() => {
    if (!eventPanelVisible || eventCountdown <= 0) return
    const t = setTimeout(() => setEventCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [eventPanelVisible, eventCountdown])

  // ── Event: winner ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!eventWinner) return
    setDetectionMode('normal')

    const isMe = eventWinner.winnerId === user?.id
    const name = isMe ? myNick : matchCtx.oppNick
    setEventWinnerName(name)
    setEventPanelVisible(true)  // ensure panel is open to show winner
    if (isMe) setEventBonus(eventWinner.bonus)
    else setOpponentEventBonus(eventWinner.bonus)

    // Show winner for 3s then slide out and clear event id (prevents stale gif on next event)
    const tHide = setTimeout(() => {
      setEventPanelVisible(false)
      setEventWinnerName(null)
      setActiveEventId(null)
    }, 3000)

    if (isMe) {
      setLocalGlowActive(true); setLocalGlowFading(false)
      const t1 = setTimeout(() => setLocalGlowFading(true), 4500)
      const t2 = setTimeout(() => { setLocalGlowActive(false); setLocalGlowFading(false) }, 5000)
      return () => { clearTimeout(tHide); clearTimeout(t1); clearTimeout(t2) }
    } else {
      setOpponentGlowActive(true); setOpponentGlowFading(false)
      const t1 = setTimeout(() => setOpponentGlowFading(true), 4500)
      const t2 = setTimeout(() => { setOpponentGlowActive(false); setOpponentGlowFading(false) }, 5000)
      return () => { clearTimeout(tHide); clearTimeout(t1); clearTimeout(t2) }
    }
  }, [eventWinner, user?.id, myNick, matchCtx.oppNick])

  // ── Event: expired ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!eventExpired) return
    setDetectionMode('normal')
    setEventPanelVisible(false)
    setActiveEventId(null)
  }, [eventExpired])

  // ── Game start/end tracking ──────────────────────────────────────────────────
  useEffect(() => {
    if ((remaining !== null || isTrain) && !gameStartedRef.current) {
      gameStartedRef.current = true
      baseCountRef.current = countRef.current
    }
    if (!isTrain && remaining === null && gameOver === null) {
      gameStartedRef.current = false
    }
  }, [remaining, gameOver, isTrain])

  const gameCount = (gameStartedRef.current ? Math.max(0, count - baseCountRef.current) : 0) + eventBonus

  const EVENT_LABELS: Record<string, { title: string; instruction: string; gif: string }> = {
    absolute_cinema: {
      title: 'Absolute Cinema!',
      instruction: 'Mostre as duas palmas abertas pra câmera por 1 segundo!',
      gif: absoluteCinemaGif,
    },
    nerd_up: {
      title: 'Nerd Up!',
      instruction: 'Levante só o dedo indicador de uma das mãos por 1 segundo!',
      gif: dogPidaoGif,
    },
  }
  const eventLabel = EVENT_LABELS[activeEventId ?? ''] ?? EVENT_LABELS['absolute_cinema']
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
    gameCount, gestureStatus, mpStatus,
    opponentCount: opponentCount + opponentEventBonus,
    countdown, remaining, gameOver, latencyMs, opponentReconnecting, navigate,
    isTrain, user, myNick,
    // Event system
    eventPanelVisible,
    eventCountdown,
    eventWinnerName,
    eventTitle: eventLabel.title,
    eventInstruction: eventLabel.instruction,
    eventGif: activeEventId ? eventLabel.gif : null,
    localGlowActive,
    localGlowFading,
    opponentGlowActive,
    opponentGlowFading,
    trainSelectedEvent,
    selectTrainEvent,
  }
}
