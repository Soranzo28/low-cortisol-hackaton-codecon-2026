import { useEffect, useRef, useState, useCallback } from 'react'

export type MultiplayerStatus =
  | 'idle'
  | 'connecting'
  | 'waiting_peer'
  | 'matched'
  | 'disconnected'
  | 'error'

interface UseMultiplayerOptions {
  /** Full WS URL of the room, e.g. wss://192.168.3.10:8765/room/<id> */
  roomWsUrl: string
  localCount: number
  localVideoRef: React.RefObject<HTMLVideoElement | null>
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>
}

interface UseMultiplayerReturn {
  status: MultiplayerStatus
  opponentCount: number
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
}: UseMultiplayerOptions): UseMultiplayerReturn {
  const [status, setStatus] = useState<MultiplayerStatus>('idle')
  const [opponentCount, setOpponentCount] = useState(0)

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
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
        localStreamRef.current = stream
        if (localVideoRef.current) localVideoRef.current.srcObject = stream
      } catch {
        if (mountedRef.current) setStatus('error')
        return
      }

      // 2. open WS to room
      const ws = new WebSocket(roomWsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        if (mountedRef.current) setStatus('waiting_peer')
      }

      ws.onmessage = async (event) => {
        if (!mountedRef.current) return
        let msg: Record<string, unknown>
        try { msg = JSON.parse(event.data as string) } catch { return }

        const type = msg.type as string

        switch (type) {
          case 'start_offer': {
            // Server picked us as the offerer (we connected first / slot 0).
            // No role check — whoever gets this message creates the WebRTC offer.
            setStatus('matched')
            const pc = createPC(stream!)
            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)
            send({ type: 'offer', sdp: offer })
            break
          }

          case 'offer': {
            // We're the answerer (slot 1). Create answer.
            // No role check — whoever receives an offer responds with an answer.
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

          case 'opponent_count':
            setOpponentCount(msg.value as number)
            break

          case 'opponent_reset':
            setOpponentCount(0)
            break

          case 'opponent_left':
            setStatus('disconnected')
            setOpponentCount(0)
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

  // ── relay count whenever it changes ────────────────────────────────────────
  useEffect(() => {
    if (status !== 'matched') return
    if (localCount === lastSentCountRef.current) return
    lastSentCountRef.current = localCount
    send({ type: 'count', value: localCount })
  }, [localCount, status, send])

  return { status, opponentCount }
}
