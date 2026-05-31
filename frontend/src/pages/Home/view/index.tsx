import type { useHomeController } from '../controller'
import type { NickModalProps, RankingEntry, MeData } from '../types'
import { RefreshCw } from 'lucide-react'

type HomeViewProps = ReturnType<typeof useHomeController>

export function HomeView(props: HomeViewProps) {
  const {
    user,
    isLoaded,
    isSignedIn,
    openSignIn,
    signOut,
    meData,
    meLoading,
    showNickModal,
    nickInput,
    nickError,
    nickSaving,
    inputRef,
    handleSaveNick,
    openNickModal,
    closeNickModal,
    onNickInputChange,
    ranking,
    rankingLoading,
    fetchRanking,
    status,
    join,
    leave,
    isQueuing,
    canPlay,
  } = props

  // Show full-screen spinner while Clerk or /me loads
  if (!isLoaded || meLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-neutral-700 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-neutral-950 text-neutral-50 font-sans selection:bg-indigo-500/30">

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
            onClick={() => openNickModal(meData.nick ?? '')}
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

      {/* Two-column layout */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-24 items-start">

          {/* RIGHT COLUMN — Ranking */}
          <RankingPanel
            ranking={ranking}
            rankingLoading={rankingLoading}
            fetchRanking={fetchRanking}
            meData={meData}
          />

          {/* LEFT COLUMN — Brand + Menu / Actions */}
          <div className="w-full order-1 flex flex-col items-center lg:items-center">

            {/* Brand */}
            <div className="flex flex-col items-center mb-10">
              <div className="inline-flex items-center justify-center px-3 py-1 mb-6 rounded-full bg-neutral-900 border border-neutral-800 shadow-sm">
                <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />
                <span className="text-xs font-medium text-neutral-400 tracking-wide uppercase">Multiplayer Online</span>
              </div>
              <img src="/logo.gif" alt="Low Cortisol" className="h-32 w-auto object-contain drop-shadow-[0_0_30px_rgba(99,102,241,0.25)]" />
            </div>

            {/* Actions */}
            <div className="w-full max-w-sm flex flex-col gap-3">
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
                      onClick={() => openNickModal()}
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

        </div>
      </div>

      {/* Nick modal */}
      {showNickModal && (
        <NickModal
          inputRef={inputRef}
          value={nickInput}
          onChange={onNickInputChange}
          error={nickError}
          saving={nickSaving}
          onSave={handleSaveNick}
          onCancel={meData?.nick ? closeNickModal : undefined}
        />
      )}
    </div>
  )
}

// ── RankingPanel ──────────────────────────────────────────────────────────────

function RankingPanel({ ranking, rankingLoading, fetchRanking, meData }: {
  ranking: RankingEntry[]
  rankingLoading: boolean
  fetchRanking: () => void
  meData: MeData | null
}) {
  return (
    <div className="w-full order-2 flex flex-col items-center lg:items-center">
      <div className="w-full max-w-xl flex flex-col gap-3">
        {/* Ranking header */}
        <div className="flex items-center justify-between mb-4 px-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center shadow-sm">
              <span className="text-2xl">🏆</span>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white tracking-tight">Ranking</h2>
              <p className="text-xs text-neutral-500 uppercase tracking-wider font-medium mt-0.5">Top 10 jogadores</p>
            </div>
          </div>
          <button
            onClick={fetchRanking}
            className="text-neutral-400 hover:text-white transition-colors text-xs font-medium px-4 h-10 rounded-xl bg-neutral-900/50 border border-neutral-800 hover:bg-neutral-800 flex items-center justify-center gap-2"
            title="Atualizar ranking"
          >
            <RefreshCw size={14} className={rankingLoading ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>

        {/* Ranking table */}
        {rankingLoading ? (
          <div className="flex items-center justify-center py-12 h-16 md:h-14 bg-neutral-900/50 border border-neutral-800 rounded-2xl">
            <div className="w-6 h-6 border-2 border-neutral-700 border-t-white rounded-full animate-spin" />
          </div>
        ) : ranking.length === 0 ? (
          <div className="py-12 text-center bg-neutral-900/50 border border-neutral-800 rounded-2xl">
            <p className="text-neutral-500 text-sm">Nenhuma partida registrada ainda.</p>
            <p className="text-neutral-600 text-xs mt-1">Seja o primeiro a jogar!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Table header */}
            <div className="grid grid-cols-[2rem_1fr_6rem_4.5rem] gap-4 md:gap-5 px-6 md:px-8 text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-[-0.25rem]">
              <span>#</span>
              <span>Nome</span>
              <span className="text-right">Auras Farmadas</span>
              <span className="text-right">W / L</span>
            </div>

            {/* Ranking rows */}
            <div className="flex flex-col gap-3 overflow-y-auto overflow-x-hidden pr-2 max-h-[25rem] pb-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-neutral-800 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
              {ranking.map((entry, i) => {
                const isMe = meData?.nick === entry.nick

                return (
                  <div
                    key={entry.nick}
                    className={`
                      grid grid-cols-[2rem_1fr_6rem_4.5rem] gap-4 md:gap-5 items-center px-6 md:px-8 h-[4.25rem] min-h-[4.25rem] rounded-2xl transition-all
                      ${isMe
                        ? 'bg-neutral-800/80 border border-neutral-700 text-white shadow-lg scale-[1.02] z-10 relative'
                        : 'bg-neutral-900/50 border border-neutral-800 text-neutral-300 hover:bg-neutral-800 hover:text-white'
                      }
                    `}
                  >
                    {/* Position */}
                    <span className="text-base font-semibold text-neutral-500">
                      {i + 1}
                    </span>

                    {/* Nick */}
                    <span className={`text-sm font-medium truncate ${isMe ? 'text-white' : 'text-neutral-200'}`}>
                      {entry.nick}
                      {isMe && <span className="ml-2 text-[9px] text-neutral-400 font-semibold uppercase tracking-wider bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-700">(você)</span>}
                    </span>

                    {/* Score */}
                    <span className="text-sm text-right tabular-nums font-semibold text-white">
                      {entry.total_score.toLocaleString()}
                    </span>

                    {/* W / L */}
                    <span className="text-sm text-right tabular-nums font-semibold whitespace-nowrap">
                      <span className="text-emerald-400">{entry.wins}W</span>
                      <span className="text-neutral-600 font-normal mx-1">/</span>
                      <span className="text-red-400">{entry.matches_played - entry.wins}L</span>
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── NickModal ─────────────────────────────────────────────────────────────────

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
