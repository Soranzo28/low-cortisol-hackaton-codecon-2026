import { useEffect, useRef, useState, useCallback } from 'react'

export type QueueStatus = 'idle' | 'connecting' | 'waiting' | 'matched' | 'error'

interface UseQueueOptions {
  serverUrl?: string
  onMatched: (roomId: string, role: 'offerer' | 'answerer') => void
}

export function useQueue({
  serverUrl = `ws://${window.location.hostname}:8765/queue`,
  onMatched,
}: UseQueueOptions) {
  const [status, setStatus] = useState<QueueStatus>('idle')
  const wsRef = useRef<WebSocket | null>(null)
  const onMatchedRef = useRef(onMatched)
  onMatchedRef.current = onMatched

  const join = useCallback(() => {
    if (wsRef.current) return
    setStatus('connecting')

    const ws = new WebSocket(serverUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setStatus('waiting')
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string)
        if (msg.type === 'waiting') {
          setStatus('waiting')
        } else if (msg.type === 'matched') {
          setStatus('matched')
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
