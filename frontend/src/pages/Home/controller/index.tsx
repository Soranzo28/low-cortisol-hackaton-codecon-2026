import { useEffect, useState, useRef, useCallback } from 'react'
import { useUser, useClerk, useAuth } from '@clerk/clerk-react'
import { useQueue } from '@/hooks/useQueue'
import { roomPath } from '@/routes'
import type { MeData, RankingEntry } from '../types'

const SERVER = import.meta.env.VITE_SERVER_URL ?? `${window.location.hostname}:8765`
const WS_PROTO = window.location.protocol === 'https:' ? 'wss' : 'ws'
const HTTP_PROTO = window.location.protocol === 'https:' ? 'https' : 'http'
const HTTP_BASE = `${HTTP_PROTO}://${SERVER}`

function suggestNick(name: string | null | undefined): string {
  if (!name) return ''
  return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 20)
}

export function useHomeController() {
  const { user, isLoaded, isSignedIn } = useUser()
  const { openSignIn, signOut } = useClerk()
  const { getToken } = useAuth()

  const [meData, setMeData] = useState<MeData | null>(null)
  const [meLoading, setMeLoading] = useState(false)
  const [showNickModal, setShowNickModal] = useState(false)
  const [nickInput, setNickInput] = useState('')
  const [nickError, setNickError] = useState('')
  const [nickSaving, setNickSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Ranking state
  const [ranking, setRanking] = useState<RankingEntry[]>([])
  const [rankingLoading, setRankingLoading] = useState(true)

  // Focus input when modal opens
  useEffect(() => {
    if (showNickModal) {
      const t = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [showNickModal])

  // Fetch /me when signed in
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return
    setMeLoading(true)
    getToken()
      .then(async (token) => {
        if (!token) return
        const r = await fetch(`${HTTP_BASE}/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!r.ok) return
        const data: MeData = await r.json()
        setMeData(data)
        if (data.nick) sessionStorage.setItem('my_nick', data.nick)
        if (!data.nick) {
          setNickInput(suggestNick(user?.firstName))
          setShowNickModal(true)
        }
      })
      .catch(() => {})
      .finally(() => setMeLoading(false))
  }, [isLoaded, isSignedIn]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch ranking
  const fetchRanking = useCallback(async () => {
    try {
      const r = await fetch(`${HTTP_BASE}/ranking`)
      if (!r.ok) return
      const data: RankingEntry[] = await r.json()
      setRanking(data)
    } catch {
      // silently ignore
    } finally {
      setRankingLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRanking()
    const interval = setInterval(fetchRanking, 15000) // refresh every 15s
    return () => clearInterval(interval)
  }, [fetchRanking])

  async function handleSaveNick() {
    const trimmed = nickInput.trim()
    if (!/^\S{3,20}$/.test(trimmed)) {
      setNickError('3 a 20 caracteres, sem espaços')
      return
    }
    setNickSaving(true)
    setNickError('')
    try {
      const token = await getToken()
      if (!token) throw new Error('no_token')
      const r = await fetch(`${HTTP_BASE}/nick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ nick: trimmed }),
      })
      if (r.status === 409) {
        setNickError('Nick já em uso, tente outro')
        return
      }
      if (!r.ok) throw new Error('failed')
      const data: MeData = await r.json()
      setMeData(data)
      if (data.nick) sessionStorage.setItem('my_nick', data.nick)
      setShowNickModal(false)
      setNickInput('')
      fetchRanking() // refresh ranking after nick change
    } catch {
      setNickError('Erro ao salvar. Tente novamente.')
    } finally {
      setNickSaving(false)
    }
  }

  const { status, join, leave } = useQueue({
    serverUrl: `${WS_PROTO}://${SERVER}/queue`,
    getToken,
    onMatched(roomId) {
      window.location.href = roomPath(roomId)
    },
  })

  useEffect(() => () => leave(), [leave])

  const isQueuing = status === 'connecting' || status === 'waiting'
  const canPlay = !!isSignedIn && !!meData?.nick

  function openNickModal(prefill?: string) {
    setNickInput(prefill ?? suggestNick(user?.firstName))
    setShowNickModal(true)
  }

  function closeNickModal() {
    setNickInput('')
    setNickError('')
    setShowNickModal(false)
  }

  function onNickInputChange(v: string) {
    setNickInput(v)
    setNickError('')
  }

  return {
    // Auth / user
    user,
    isLoaded,
    isSignedIn,
    openSignIn,
    signOut,
    meData,
    meLoading,

    // Nick modal
    showNickModal,
    nickInput,
    nickError,
    nickSaving,
    inputRef,
    handleSaveNick,
    openNickModal,
    closeNickModal,
    onNickInputChange,

    // Ranking
    ranking,
    rankingLoading,
    fetchRanking,

    // Queue
    status,
    join,
    leave,
    isQueuing,
    canPlay,
  }
}
