import React from 'react'
import { StatusBadge } from '@/components/StatusBadge'
import { OpponentPanel } from '@/components/OpponentPanel'
import { ROUTES } from '@/routes'
import type { useRoomController } from '../controller'
import type { GameOverData } from '../types'

type RoomViewProps = ReturnType<typeof useRoomController>

export function RoomView(props: RoomViewProps) {
  const {
    videoRef, canvasRef, remoteVideoRef,
    isMobile, isMatched, cameraReady,
    matchCtx, gameCount, gestureStatus,
    mpStatus, opponentCount, countdown,
    remaining, gameOver, latencyMs, opponentReconnecting, navigate,
    isTrain,
  } = props

  return (
    <div className="relative min-h-screen w-full flex flex-col p-4 md:p-8 overflow-hidden bg-[#09090b] text-neutral-200 font-sans">
      {/* Background Blobs */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-900/20 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-900/10 blur-[120px] rounded-full mix-blend-screen" />
      </div>

      {/* Header / Timer */}
      <div className="w-full h-12 md:h-16 shrink-0 relative z-20 flex justify-between items-start">
        <div className="flex-1">
          {isTrain && (
            <button onClick={() => navigate(ROUTES.HOME)} className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-full text-sm font-semibold transition-colors">
              ← Voltar
            </button>
          )}
        </div>
        <div className="flex-1 flex justify-center">
          {remaining !== null && gameOver === null && !isTrain && (
            <TimerBadge remaining={remaining} />
          )}
          {isTrain && (
            <div style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', borderRadius: '9999px', padding: '0.35rem 1.25rem', border: `1px solid rgba(255,255,255,0.2)` }}>
              <span style={{ color: 'white', fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: '1.1rem' }}>Treinamento Livre</span>
            </div>
          )}
        </div>
        <div className="flex-1" />
      </div>

      {/* Main Content Area */}
      <div className={`relative z-10 w-full flex-1 max-w-6xl mx-auto flex ${isMatched ? (isMobile ? 'flex-col' : 'flex-row') : 'justify-center items-center'} gap-4 md:gap-8`}>
        {/* Local Camera */}
        <div className={`relative overflow-hidden rounded-3xl bg-neutral-900/60 border border-neutral-800 shadow-2xl backdrop-blur-sm ${isMatched || isTrain ? 'w-full flex-1 min-h-[300px]' : 'w-full max-w-3xl aspect-[4/3] min-h-[400px]'}`}>
          {!cameraReady && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-neutral-900/80">
              <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
              <span className="text-white/70 font-semibold text-sm">Carregando câmera…</span>
            </div>
          )}
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover block" />
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-[5]" />
          {(isMatched || isTrain) && <PlayerInfoOverlay name={isTrain ? "Treino" : "Você"} rankingPoints={matchCtx.myScore} score={gameCount} latencyMs={latencyMs} />}
        </div>

        {/* Opponent Camera */}
        {isMatched && (
          <OpponentPanel remoteVideoRef={remoteVideoRef} opponentCount={opponentCount} latencyMs={latencyMs} isMobile={isMobile} oppNick={matchCtx.oppNick} oppRankingScore={matchCtx.oppScore} isReconnecting={opponentReconnecting} />
        )}
      </div>

      {/* Overlays */}
      {countdown !== null && <CountdownOverlay value={countdown} />}
      {!isMatched && <StatusBadge status={gestureStatus} isMobile={isMobile} />}
      {(mpStatus === 'connecting' || mpStatus === 'waiting_peer') && <WaitingOverlay status={mpStatus} />}
      {gameOver !== null && <GameOverOverlay data={gameOver} onGoHome={() => navigate(ROUTES.HOME)} />}
      {opponentReconnecting && <ReconnectingBanner timeout={15} />}
      {mpStatus === 'disconnected' && gameOver === null && !opponentReconnecting && <DisconnectedBanner onGoHome={() => navigate(ROUTES.HOME)} />}
    </div>
  )
}

function latencyColor(ms: number | null): string {
  if (ms === null) return 'rgba(255,255,255,0.4)'
  if (ms < 80) return '#22c55e'
  if (ms <= 200) return '#f59e0b'
  return '#ef4444'
}

function WifiIcon({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.55a11 11 0 0 1 14.08 0" /><path d="M1.42 9a16 16 0 0 1 21.16 0" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" /><line x1="12" y1="20" x2="12.01" y2="20" />
    </svg>
  )
}

function PlayerInfoOverlay({ name, rankingPoints, score, latencyMs }: { name: string; rankingPoints: number; score: number; latencyMs: number | null }) {
  const lColor = latencyColor(latencyMs)
  return (
    <>
      <div style={{ position: 'absolute', top: '0.75rem', left: '0.75rem', zIndex: 11, display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', borderRadius: '9999px', padding: '0.25rem 0.75rem' }}>
        <span style={{ color: 'white', fontSize: '0.8rem', fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>{name}</span>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', marginLeft: '0.3rem', fontFamily: "'Inter', sans-serif" }}>({String(rankingPoints).padStart(4, '0')})</span>
      </div>
      <div style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', zIndex: 11, display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', borderRadius: '9999px', padding: '0.25rem 0.65rem' }}>
        <WifiIcon color={lColor} />
        <span style={{ color: lColor, fontSize: '0.75rem', fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>{latencyMs !== null ? `${latencyMs}ms` : '—'}</span>
      </div>
      <div style={{ position: 'absolute', bottom: '2rem', left: '50%', transform: 'translateX(-50%)', zIndex: 11, pointerEvents: 'none', textAlign: 'center', whiteSpace: 'nowrap' }}>
        <span style={{ fontSize: 'clamp(2.5rem, 8vw, 6rem)', color: 'white', textShadow: '0 4px 32px rgba(0,0,0,0.9), 0 2px 8px rgba(0,0,0,0.8)', fontWeight: 900, lineHeight: 1, fontFamily: "'Inter', sans-serif", userSelect: 'none' }}>
          +{score} <span style={{ fontSize: '0.45em', fontWeight: 700, opacity: 0.7 }}>Aura</span>
        </span>
      </div>
    </>
  )
}

function TimerBadge({ remaining }: { remaining: number }) {
  const isDanger = remaining <= 5; const isWarning = remaining <= 10
  const color = isDanger ? '#ef4444' : isWarning ? '#f59e0b' : 'rgba(255,255,255,0.9)'
  return (
    <div style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', borderRadius: '9999px', padding: '0.35rem 1.25rem', border: `1px solid ${color}55`, whiteSpace: 'nowrap', transition: 'border-color 0.3s' }}>
      <span style={{ color, fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: '1.1rem', fontVariantNumeric: 'tabular-nums', transition: 'color 0.3s' }}>Tempo Restante: {remaining}s</span>
    </div>
  )
}

function CountdownOverlay({ value }: { value: number }) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' }}>
      <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '1rem', fontWeight: 600, fontFamily: "'Inter', sans-serif", letterSpacing: '0.08em', textTransform: 'uppercase' }}>Prepare-se!</p>
      <span key={value} style={{ fontSize: '9rem', fontWeight: 800, color: 'white', fontFamily: "'Inter', sans-serif", lineHeight: 1, animation: 'pulse-scale 0.75s ease-out' }}>{value}</span>
    </div>
  )
}

function GameOverOverlay({ data, onGoHome }: { data: GameOverData; onGoHome: () => void }) {
  const isWin = data.winner === 'you'; const isDraw = data.winner === 'draw'
  const title = isWin ? 'VITÓRIA' : isDraw ? 'EMPATE' : 'DERROTA'
  const titleColor = isWin ? '#22c55e' : isDraw ? '#f59e0b' : '#ef4444'
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem', background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)' }}>
      <h1 style={{ fontSize: '4.5rem', fontWeight: 800, color: titleColor, fontFamily: "'Inter', sans-serif", margin: 0, letterSpacing: '-0.02em' }}>{title}</h1>
      <div style={{ display: 'flex', gap: '3.5rem', alignItems: 'center' }}>
        <ScoreBox label="Você" score={data.yourScore} highlight={isWin} />
        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '2rem', fontWeight: 300 }}>×</span>
        <ScoreBox label="Adversário" score={data.opponentScore} highlight={data.winner === 'opponent'} />
      </div>
      <button onClick={onGoHome} style={{ marginTop: '0.5rem', background: 'white', color: 'black', border: 'none', borderRadius: '9999px', padding: '0.8rem 2.8rem', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')} onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}>Voltar ao lobby</button>
    </div>
  )
}

function ScoreBox({ label, score, highlight }: { label: string; score: number; highlight: boolean }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.3rem', fontFamily: "'Inter', sans-serif" }}>{label}</p>
      <p style={{ color: highlight ? 'white' : 'rgba(255,255,255,0.6)', fontSize: '4rem', fontWeight: 800, lineHeight: 1, fontFamily: "'Inter', sans-serif" }}>{score}</p>
    </div>
  )
}

function WaitingOverlay({ status }: { status: string }) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 30, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.25rem', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
      <div style={{ width: 48, height: 48, border: '4px solid rgba(99,102,241,0.25)', borderTop: '4px solid #818cf8', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
      <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '1.1rem', fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>
        {status === 'connecting' ? 'Conectando à sala…' : 'Aguardando adversário entrar…'}
      </p>
    </div>
  )
}

function DisconnectedBanner({ onGoHome }: { onGoHome: () => void }) {
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 40, padding: '1rem 2rem', background: 'rgba(239,68,68,0.85)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: "'Inter', sans-serif" }}>
      <span style={{ color: 'white', fontWeight: 600 }}>⚠️ Adversário desconectou.</span>
      <button onClick={onGoHome} style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '9999px', padding: '0.4rem 1.2rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>Voltar ao início</button>
    </div>
  )
}
