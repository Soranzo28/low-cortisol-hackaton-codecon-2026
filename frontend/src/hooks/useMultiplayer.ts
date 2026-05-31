import { useEffect, useRef, useState, useCallback } from 'react'

export type MultiplayerStatus =
  | 'idle'
  | 'connecting'
  | 'waiting_peer'
  | 'matched'
  | 'disconnected'
  | 'error'

export interface GameOverData {
  yourScore: number
  opponentScore: number
  winner: 'you' | 'opponent' | 'draw'
}

export interface ActiveEventData {
  eventId: string
  duration: number
}

export interface EventWinnerData {
  winnerId: string
  bonus: number
}

interface UseMultiplayerOptions {
  /** Full WS URL of the room, e.g. wss://192.168.3.10:8765/room/<id> */
  roomWsUrl: string
  localCount: number
  localVideoRef: React.RefObject<HTMLVideoElement | null>
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>
  getToken: () => Promise<string | null>
}

interface UseMultiplayerReturn {
  status: MultiplayerStatus
  opponentCount: number
  countdown: number | null
  remaining: number | null
  gameOver: GameOverData | null
  latencyMs: number | null
  opponentReconnecting: boolean
  activeEvent: ActiveEventData | null
  eventWinner: EventWinnerData | null
  eventExpired: boolean
  sendMessage: (msg: object) => void
}

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

export function useMultiplayer({
  roomWsUrl,
  localCount,
  localVideoRef,
  remoteVideoRef,
  getToken,
}: UseMultiplayerOptions): UseMultiplayerReturn {
  const [status, setStatus] = useState<MultiplayerStatus>('idle')
  const [opponentCount, setOpponentCount] = useState(0)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [gameOver, setGameOver] = useState<GameOverData | null>(null)
  const [latencyMs, setLatencyMs] = useState<number | null>(null)
  const [opponentReconnecting, setOpponentReconnecting] = useState(false)
  const [activeEvent, setActiveEvent] = useState<ActiveEventData | null>(null)
  const [eventWinner, setEventWinner] = useState<EventWinnerData | null>(null)
  const [eventExpired, setEventExpired] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const lastSentCountRef = useRef(-1)
  const mountedRef = useRef(true)

  // ── send helper ────────────────────────────────────────────────────────────
  const send = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    }
  }, [])

  // ── WebRTC ─────────────────────────────────────────────────────────────────
  const createPC = useCallback(
    (stream: MediaStream) => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
      pcRef.current = pc

      stream.getTracks().forEach((t) => pc.addTrack(t, stream))

      pc.onicecandidate = (e) => {
        if (e.candidate) send({ type: 'ice', candidate: e.candidate })
      }

      pc.ontrack = (e) => {
        if (remoteVideoRef.current && e.streams[0]) {
          remoteVideoRef.current.srcObject = e.streams[0]
        }
      }

      return pc
    },
    [send, remoteVideoRef],
  )

  // ── main effect: connect to room ───────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true
    let stream: MediaStream | null = null

    async function start() {
      setStatus('connecting')

      // 1. grab camera
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        })
        localStreamRef.current = stream
        if (localVideoRef.current) localVideoRef.current.srcObject = stream
      } catch {
        if (mountedRef.current) setStatus('error')
        return
      }

      if (!roomWsUrl) {
        if (mountedRef.current) setStatus('idle')
        return
      }

      // 2. fetch token before opening WS so onopen stays synchronous
      const token = await getToken()

      // 3. open WS to room
      const ws = new WebSocket(roomWsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        // Always send identify — server ignores it if room is 'waiting',
        // uses it to verify identity if room is 'in_progress'
        if (token) ws.send(JSON.stringify({ type: 'identify', clerk_token: token }))
        if (mountedRef.current) setStatus('waiting_peer')
      }

      ws.onmessage = async (event) => {
        if (!mountedRef.current) return
        let msg: Record<string, unknown>
        try { msg = JSON.parse(event.data as string) } catch { return }

        const type = msg.type as string

        switch (type) {
          case 'start_offer': {
            setStatus('matched')
            const pc = createPC(stream!)
            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)
            send({ type: 'offer', sdp: offer })
            break
          }

          case 'offer': {
            setStatus('matched')
            const pc = createPC(stream!)
            await pc.setRemoteDescription(
              new RTCSessionDescription(msg.sdp as RTCSessionDescriptionInit),
            )
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            send({ type: 'answer', sdp: answer })
            break
          }

          case 'answer': {
            await pcRef.current?.setRemoteDescription(
              new RTCSessionDescription(msg.sdp as RTCSessionDescriptionInit),
            )
            break
          }

          case 'ice': {
            try {
              await pcRef.current?.addIceCandidate(
                new RTCIceCandidate(msg.candidate as RTCIceCandidateInit),
              )
            } catch { /* ignore stale candidates */ }
            break
          }

          case 'sync':
            // Reconnected to an in-progress match — jump to current state
            setCountdown(null)
            setRemaining(msg.remaining as number)
            setStatus('matched')
            break

          case 'countdown':
            setCountdown(msg.value as number)
            break

          case 'game_start':
            setCountdown(null)
            setRemaining(msg.remaining as number ?? 42)
            break

          case 'tick':
            setRemaining(msg.remaining as number)
            break

          case 'game_over':
            setGameOver({
              yourScore: msg.your_score as number,
              opponentScore: msg.opponent_score as number,
              winner: msg.winner as 'you' | 'opponent' | 'draw',
            })
            setRemaining(null)
            break

          case 'opponent_count':
            setOpponentCount(msg.value as number)
            break

          case 'opponent_reset':
            setOpponentCount(0)
            break

          case 'opponent_reconnecting':
            setOpponentReconnecting(true)
            break

          case 'opponent_reconnected':
            setOpponentReconnecting(false)
            break

          case 'opponent_left':
            setOpponentReconnecting(false)
            setStatus('disconnected')
            setOpponentCount(0)
            break

          case 'event_start':
            setActiveEvent({ eventId: msg.event_id as string, duration: msg.duration as number })
            break

          case 'event_winner':
            setEventWinner({ winnerId: msg.winner_id as string, bonus: msg.bonus as number })
            setActiveEvent(null)
            break

          case 'event_expired':
            setEventExpired(true)
            setActiveEvent(null)
            break
        }
      }

      ws.onerror = () => { if (mountedRef.current) setStatus('error') }
      ws.onclose = () => {
        if (mountedRef.current) {
          setStatus((s) => s === 'matched' ? 'disconnected' : s)
        }
      }
    }

    start()

    return () => {
      mountedRef.current = false
      wsRef.current?.close()
      wsRef.current = null
      pcRef.current?.close()
      pcRef.current = null
      stream?.getTracks().forEach((t) => t.stop())
      localStreamRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomWsUrl])

  // ── RTT latency polling via WebRTC stats ──────────────────────────────────
  useEffect(() => {
    if (status !== 'matched') return
    const poll = async () => {
      if (!pcRef.current) return
      try {
        const stats = await pcRef.current.getStats()
        stats.forEach((report: any) => {
          if (report.type === 'candidate-pair' && report.state === 'succeeded' && report.currentRoundTripTime != null) {
            setLatencyMs(Math.round(report.currentRoundTripTime * 1000))
          }
        })
      } catch { /* ignore */ }
    }
    poll()
    const id = setInterval(poll, 2000)
    return () => clearInterval(id)
  }, [status])

  // ── relay count only while game is active ──────────────────────────────────
  useEffect(() => {
    if (status !== 'matched') return
    if (remaining === null || gameOver !== null) return
    if (localCount === lastSentCountRef.current) return
    lastSentCountRef.current = localCount
    send({ type: 'count', value: localCount })
  }, [localCount, status, remaining, gameOver, send])

  return { status, opponentCount, countdown, remaining, gameOver, latencyMs, opponentReconnecting,
           activeEvent, eventWinner, eventExpired, sendMessage: send }
}
