import { useQueue } from '@/hooks/useQueue'
import { useEffect } from 'react'

const SERVER = import.meta.env.VITE_SERVER_URL
const WS_PROTO = window.location.protocol === 'https:' ? 'wss' : 'ws'

export default function Home() {
  const { status, join, leave } = useQueue({
    serverUrl: `${WS_PROTO}://${SERVER}/queue`,
    onMatched(roomId) {
      window.location.href = `/room/${roomId}`
    },
  })

  useEffect(() => () => leave(), [leave])

  const isQueuing = status === 'connecting' || status === 'waiting'

  return (
    <div className="relative min-h-screen bg-neutral-950 text-neutral-50 flex flex-col items-center justify-center font-sans selection:bg-indigo-500/30">
      
      {/* Subtle Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Content Wrapper */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-sm px-6">
        
        {/* Brand/Title */}
        <div className="flex flex-col items-center mb-12">
          <div className="inline-flex items-center justify-center px-3 py-1 mb-6 rounded-full bg-neutral-900 border border-neutral-800 shadow-sm">
            <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />
            <span className="text-xs font-medium text-neutral-400 tracking-wide uppercase">Multiplayer Online</span>
          </div>

          <h1 className="text-7xl font-semibold tracking-tighter text-white mb-2">
            6/7
          </h1>
          <p className="text-neutral-400 text-lg tracking-tight font-medium">
            Low Cortisol
          </p>
        </div>

        {/* Actions */}
        <div className="w-full flex flex-col gap-3">
          {!isQueuing && status !== 'matched' && (
            <>
              {/* Primary Action - High Contrast */}
              <button
                onClick={join}
                className="w-full h-14 rounded-2xl bg-white text-black font-semibold text-lg tracking-tight transition-transform active:scale-[0.98] active:bg-neutral-200 flex items-center justify-center gap-2 shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)]"
              >
                Encontrar Partida
              </button>

              {/* Secondary Actions - Ghost outline */}
              <a
                href="#"
                className="w-full h-14 rounded-2xl bg-neutral-900/50 border border-neutral-800 text-neutral-300 font-medium tracking-tight transition-colors hover:bg-neutral-800 hover:text-white flex items-center justify-center"
              >
                Jogar Local
              </a>

              <a
                href="#"
                className="w-full h-14 rounded-2xl bg-neutral-900/50 border border-neutral-800 text-neutral-300 font-medium tracking-tight transition-colors hover:bg-neutral-800 hover:text-white flex items-center justify-center"
              >
                Sobre
              </a>
            </>
          )}

          {/* Queuing State */}
          {isQueuing && (
            <div className="w-full flex flex-col items-center justify-center py-8 px-4 bg-neutral-900/50 border border-neutral-800 rounded-3xl">
              <div className="w-8 h-8 border-2 border-neutral-700 border-t-white rounded-full animate-spin mb-4" />
              <p className="text-neutral-300 font-medium mb-6">
                {status === 'connecting' ? 'Conectando ao servidor...' : 'Aguardando oponente...'}
              </p>
              <button
                onClick={leave}
                className="px-6 py-2 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
            </div>
          )}

          {/* Error State */}
          {status === 'error' && (
            <div className="w-full p-4 mt-2 rounded-2xl bg-red-950/30 border border-red-900/50 text-red-400 text-center text-sm font-medium">
              Não foi possível conectar.
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
