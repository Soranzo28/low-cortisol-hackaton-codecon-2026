import { useQueue } from '@/hooks/useQueue'
import { useEffect, useState, useRef } from 'react'
import { useUser, useClerk, useAuth } from '@clerk/clerk-react'

const SERVER = import.meta.env.VITE_SERVER_URL ?? `${window.location.hostname}:8765`
const WS_PROTO = window.location.protocol === 'https:' ? 'wss' : 'ws'
const HTTP_PROTO = window.location.protocol === 'https:' ? 'https' : 'http'
const HTTP_BASE = `${HTTP_PROTO}://${SERVER}`

function suggestNick(name: string | null | undefined): string {
  if (!name) return ''
  return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 20)
}

interface MeData {
  clerk_user_id: string
  nick: string | null
  total_score?: number
  wins?: number
  matches_played?: number
}

export default function Home() {
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
        if (!data.nick) {
          setNickInput(suggestNick(user?.firstName))
          setShowNickModal(true)
        }
      })
      .catch(() => {})
      .finally(() => setMeLoading(false))
  }, [isLoaded, isSignedIn]) // eslint-disable-line react-hooks/exhaustive-deps

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
      setShowNickModal(false)
      setNickInput('')
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
      window.location.href = `/room/${roomId}`
    },
  })

  useEffect(() => () => leave(), [leave])

  const isQueuing = status === 'connecting' || status === 'waiting'
  const canPlay = !!isSignedIn && !!meData?.nick

  // Show full-screen spinner while Clerk or /me loads
  if (!isLoaded || meLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-neutral-700 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-neutral-950 text-neutral-50 flex flex-col items-center justify-center font-sans selection:bg-indigo-500/30">

      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* User header (top-right) */}
      {isSignedIn && meData?.nick && (
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          {user?.imageUrl && (
            <img
              src={user.imageUrl}
              className="w-8 h-8 rounded-full border border-neutral-700 object-cover"
              alt="avatar"
            />
          )}
          <span className="text-sm text-neutral-300 font-medium">{meData.nick}</span>
          <button
            onClick={() => { setNickInput(meData.nick ?? ''); setShowNickModal(true) }}
            className="text-neutral-600 hover:text-neutral-400 transition-colors text-sm"
            title="Editar nick"
          >
            ✎
          </button>
          <button
            onClick={() => signOut()}
            className="text-neutral-600 hover:text-neutral-400 transition-colors text-xs underline underline-offset-2"
          >
            sair
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-sm px-6">

        {/* Brand */}
        <div className="flex flex-col items-center mb-12">
          <div className="inline-flex items-center justify-center px-3 py-1 mb-6 rounded-full bg-neutral-900 border border-neutral-800 shadow-sm">
            <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />
            <span className="text-xs font-medium text-neutral-400 tracking-wide uppercase">Multiplayer Online</span>
          </div>
          <h1 className="text-7xl font-semibold tracking-tighter text-white mb-2">6/7</h1>
          <p className="text-neutral-400 text-lg tracking-tight font-medium">Low Cortisol</p>
        </div>

        {/* Actions */}
        <div className="w-full flex flex-col gap-3">
          {!isQueuing && status !== 'matched' && (
            <>
              <p className="text-xs text-neutral-500 text-center px-1 -mb-1">
                Este jogo usa sua câmera para detectar gestos. Permita o acesso quando solicitado.
              </p>

              {/* Primary action: changes based on auth state */}
              {canPlay ? (
                <button
                  onClick={join}
                  className="w-full h-16 md:h-14 rounded-2xl bg-white text-black font-semibold text-lg tracking-tight transition-transform active:scale-[0.98] active:bg-neutral-200 flex items-center justify-center gap-2 shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)]"
                >
                  Encontrar Partida
                </button>
              ) : isSignedIn && !meData?.nick ? (
                <button
                  onClick={() => { setNickInput(suggestNick(user?.firstName)); setShowNickModal(true) }}
                  className="w-full h-16 md:h-14 rounded-2xl bg-white text-black font-semibold text-lg tracking-tight transition-transform active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  Escolher apelido
                </button>
              ) : (
                <button
                  onClick={() => openSignIn()}
                  className="w-full h-16 md:h-14 rounded-2xl bg-white text-black font-semibold text-lg tracking-tight transition-transform active:scale-[0.98] active:bg-neutral-200 flex items-center justify-center gap-2 shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)]"
                >
                  Entrar com Google
                </button>
              )}

              <a href="#" className="w-full h-16 md:h-14 rounded-2xl bg-neutral-900/50 border border-neutral-800 text-neutral-300 font-medium tracking-tight transition-colors hover:bg-neutral-800 hover:text-white flex items-center justify-center">
                Jogar Local
              </a>
              <a href="#" className="w-full h-16 md:h-14 rounded-2xl bg-neutral-900/50 border border-neutral-800 text-neutral-300 font-medium tracking-tight transition-colors hover:bg-neutral-800 hover:text-white flex items-center justify-center">
                Sobre
              </a>
            </>
          )}

          {/* Queuing state */}
          {isQueuing && (
            <div className="w-full flex flex-col items-center justify-center py-8 px-4 bg-neutral-900/50 border border-neutral-800 rounded-3xl">
              <div className="w-8 h-8 border-2 border-neutral-700 border-t-white rounded-full animate-spin mb-4" />
              <p className="text-neutral-300 font-medium mb-6">
                {status === 'connecting' ? 'Conectando ao servidor...' : 'Aguardando oponente...'}
              </p>
              <button onClick={leave} className="px-6 py-2 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm font-medium transition-colors">
                Cancelar
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="w-full p-4 mt-2 rounded-2xl bg-red-950/30 border border-red-900/50 text-red-400 text-center text-sm font-medium">
              Não foi possível conectar. Verifique se você está autenticado e tem um apelido definido.
            </div>
          )}
        </div>
      </div>

      {/* Nick modal */}
      {showNickModal && (
        <NickModal
          inputRef={inputRef}
          value={nickInput}
          onChange={(v) => { setNickInput(v); setNickError('') }}
          error={nickError}
          saving={nickSaving}
          onSave={handleSaveNick}
          onCancel={meData?.nick ? () => { setNickInput(''); setNickError(''); setShowNickModal(false) } : undefined}
        />
      )}
    </div>
  )
}

// ── NickModal ─────────────────────────────────────────────────────────────────

interface NickModalProps {
  inputRef: { current: HTMLInputElement | null }
  value: string
  onChange: (v: string) => void
  error: string
  saving: boolean
  onSave: () => void
  onCancel?: () => void
}

function NickModal({ inputRef, value, onChange, error, saving, onSave, onCancel }: NickModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-6">
      <div className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-3xl p-8 flex flex-col gap-6 shadow-2xl">

        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold text-white tracking-tight">Escolha seu apelido</h2>
          <p className="text-sm text-neutral-500">Será exibido no ranking e nas partidas.</p>
        </div>

        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="text"
            value={value}
            maxLength={20}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !saving && onSave()}
            placeholder="seu_nick"
            className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder-neutral-600 text-base focus:outline-none focus:border-neutral-500 transition-colors"
          />
          {error && <p className="text-xs text-red-400 px-1">{error}</p>}
          <p className="text-xs text-neutral-600 px-1">{value.length}/20 · apenas letras, números e _</p>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={onSave}
            disabled={saving}
            className="w-full h-12 rounded-2xl bg-white text-black font-semibold tracking-tight transition-transform active:scale-[0.98] active:bg-neutral-200 disabled:opacity-50"
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
          {onCancel && (
            <button
              onClick={onCancel}
              disabled={saving}
              className="w-full h-12 rounded-2xl bg-transparent border border-neutral-800 text-neutral-400 font-medium tracking-tight hover:bg-neutral-800 hover:text-white transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
          )}
        </div>

      </div>
    </div>
  )
}
