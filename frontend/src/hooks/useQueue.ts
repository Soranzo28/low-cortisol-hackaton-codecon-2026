import { useEffect, useRef, useState, useCallback } from 'react'

export type QueueStatus = 'idle' | 'connecting' | 'waiting' | 'matched' | 'error'

interface UseQueueOptions {
  serverUrl?: string
  getToken: () => Promise<string | null>
  onMatched: (roomId: string, role: 'offerer' | 'answerer') => void
  onRoomCreated?: (code: string) => void
}

export function useQueue({
  serverUrl = `ws://${import.meta.env.VITE_SERVER_URL}/queue`,
  getToken,
  onMatched,
  onRoomCreated,
}: UseQueueOptions) {
  const [status, setStatus] = useState<QueueStatus>('idle')
  const wsRef = useRef<WebSocket | null>(null)
  
  const onMatchedRef = useRef(onMatched)
  onMatchedRef.current = onMatched
  
  const getTokenRef = useRef(getToken)
  getTokenRef.current = getToken
  
  const onRoomCreatedRef = useRef(onRoomCreated)
  onRoomCreatedRef.current = onRoomCreated

  const join = useCallback(async (action?: 'create' | 'join', code?: string) => {
    if (wsRef.current) return
    setStatus('connecting')

    const token = await getTokenRef.current()
    if (!token) {
      setStatus('error')
      return
    }

    const ws = new WebSocket(serverUrl)
    wsRef.current = ws

    ws.onopen = () => {
      if (serverUrl.endsWith('/queue_private')) {
        ws.send(JSON.stringify({ type: action, code, clerk_token: token }))
      } else {
        ws.send(JSON.stringify({ type: 'identify', clerk_token: token }))
      }
      setStatus('waiting')
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string)
        if (msg.type === 'waiting') {
          setStatus('waiting')
        } else if (msg.type === 'room_created') {
          setStatus('waiting')
          onRoomCreatedRef.current?.(msg.code as string)
        } else if (msg.type === 'matched') {
          setStatus('matched')
          sessionStorage.setItem('match_context', JSON.stringify({
            myScore: msg.your_score ?? 0,
            oppScore: msg.opp_score ?? 0,
            oppNick: msg.opp_nick ?? 'Adversário',
            oppImageUrl: msg.opp_image_url ?? null,
          }))
          onMatchedRef.current(msg.roomId as string, msg.role as 'offerer' | 'answerer')
        }
      } catch {
        // ignore parse errors
      }
    }

    ws.onerror = () => {
      setStatus('error')
    }

    ws.onclose = () => {
      wsRef.current = null
      setStatus((s) => (s === 'matched' ? s : 'idle'))
    }
  }, [serverUrl])

  const leave = useCallback(() => {
    wsRef.current?.close()
    wsRef.current = null
    setStatus('idle')
  }, [])

  useEffect(() => () => { wsRef.current?.close() }, [])

  return { status, join, leave }
}
