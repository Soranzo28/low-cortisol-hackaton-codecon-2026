import { useState, useEffect, useRef } from 'react'
import { StatusBadge } from '@/components/StatusBadge'
import { OpponentPanel } from '@/components/OpponentPanel'
import { ROUTES } from '@/routes'
import defaultIconUrl from '@/assets/default_icon.svg'
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

  const [eventVisible, setEventVisible] = useState(false)
  const [glowActive, setGlowActive] = useState(false)
  const [glowFading, setGlowFading] = useState(false)
  const eventFiredRef = useRef(false)

  useEffect(() => {
    if (isMatched && !eventFiredRef.current) {
      eventFiredRef.current = true
      const t = setTimeout(() => {
        setEventVisible(true)
        setTimeout(() => setEventVisible(false), 8000)
      }, 10000)
      return () => clearTimeout(t)
    }
  }, [isMatched])

  const handleChallengeCompleted = () => {
    setEventVisible(false)
    setGlowActive(true)
    setGlowFading(false)
    setTimeout(() => setGlowFading(true), 4500)
    setTimeout(() => { setGlowActive(false); setGlowFading(false) }, 5000)
  }

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
            <div style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', borderRadius: '9999px', padding: '0.35rem 1.25rem', border: '1px solid rgba(255,255,255,0.2)' }}>
              <span style={{ color: 'white', fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: '1.1rem' }}>Treinamento Livre</span>
            </div>
          )}
        </div>
        <div className="flex-1" />
      </div>

      {/* Main Content Area */}
      <div className={`relative z-10 w-full flex-1 max-w-7xl mx-auto flex ${isMatched && !isMobile ? 'flex-row items-center' : 'flex-col items-center'} justify-center gap-6 md:gap-12`}>

        {/* Local player column */}
        <div className={`flex flex-col items-center ${isMatched && !isMobile ? 'flex-1 max-w-[600px]' : 'w-full max-w-[600px]'}`}>
          {/* Camera panel */}
          <div
            className="relative overflow-hidden rounded-3xl bg-neutral-900/60 border border-neutral-800 shadow-2xl backdrop-blur-sm aspect-square w-full"
          >
            {/* Glow border overlay */}
            {glowActive && (
              <div style={{
                position: 'absolute', inset: 0, borderRadius: 'inherit', zIndex: 20, pointerEvents: 'none',
                border: '2px solid #00ff88',
                animation: glowFading ? 'none' : 'glow-pulse 1.2s ease-in-out infinite',
                opacity: glowFading ? 0 : 1,
                transition: 'opacity 0.5s ease',
              }} />
            )}

            {!cameraReady && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-neutral-900/80">
                <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                <span className="text-white/70 font-semibold text-sm">Carregando câmera…</span>
              </div>
            )}
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover block" />
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-[5]" />
            {(isMatched || isTrain) && <PlayerInfoOverlay score={gameCount} latencyMs={latencyMs} />}
          </div>

          {/* Below-panel: avatar + name (total score) */}
          {(isMatched || isTrain) && (
            <PlayerBelowInfo name={isTrain ? 'Treino' : 'Você'} rankingScore={matchCtx.myScore} />
          )}
        </div>

        {/* Opponent column */}
        {isMatched && (
          <div className="flex flex-col items-center flex-1 max-w-[600px]">
            {/* Camera + event overlay wrapper */}
            <div className="relative w-full aspect-square">
              <OpponentPanel
                remoteVideoRef={remoteVideoRef}
                opponentCount={opponentCount}
                latencyMs={latencyMs}
                isReconnecting={opponentReconnecting}
              />
              <EventPanel
                visible={eventVisible}
                text="Desafio: faça 5 movimentos seguidos sem parar!"
                onComplete={handleChallengeCompleted}
              />
            </div>

            {/* Below-panel: avatar + name (total score) */}
            <PlayerBelowInfo name={matchCtx.oppNick} rankingScore={matchCtx.oppScore} />
          </div>
        )}
      </div>

      {/* Overlays */}
      {countdown !== null && <CountdownOverlay value={countdown} />}
      {!isMatched && <StatusBadge status={gestureStatus} isMobile={isMobile} />}
      {(mpStatus === 'connecting' || mpStatus === 'waiting_peer') && <WaitingOverlay status={mpStatus} />}
      {gameOver !== null && <GameOverOverlay data={gameOver} onGoHome={() => navigate(ROUTES.HOME)} />}
      {mpStatus === 'disconnected' && gameOver === null && !opponentReconnecting && <DisconnectedBanner onGoHome={() => navigate(ROUTES.HOME)} />}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

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

function PlayerInfoOverlay({ score, latencyMs }: { score: number; latencyMs: number | null }) {
  const lColor = latencyColor(latencyMs)
  return (
    <div style={{ position: 'absolute', top: '0.75rem', left: '0.75rem', zIndex: 11, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
      <div style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', borderRadius: '0.5rem', padding: '0.3rem 0.65rem', display: 'inline-flex', alignItems: 'center' }}>
        <span style={{ color: '#00ff88', fontSize: '1.15rem', fontWeight: 800, fontFamily: "'Inter', sans-serif", textShadow: '0 0 12px rgba(0,255,136,0.55)' }}>
          +{score} 💀
        </span>
      </div>
      <div style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', borderRadius: '0.5rem', padding: '0.25rem 0.55rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
        <WifiIcon color={lColor} />
        <span style={{ color: lColor, fontSize: '0.75rem', fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>
          {latencyMs !== null ? `${latencyMs}ms` : '—'}
        </span>
      </div>
    </div>
  )
}

function PlayerBelowInfo({ name, rankingScore }: { name: string; rankingScore: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', marginTop: '0.75rem' }}>
      <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(255,255,255,0.22)', flexShrink: 0 }}>
        <img src={defaultIconUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <span style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600, fontFamily: "'Inter', sans-serif", fontSize: '0.85rem', letterSpacing: '0.06em' }}>
        {name.toUpperCase()} ({String(rankingScore).padStart(3, '0')})
      </span>
    </div>
  )
}

function EventPanel({ visible, text, onComplete }: { visible: boolean; text: string; onComplete: () => void }) {
  return (
    <div style={{
      position: 'absolute',
      top: '18%',
      right: 0,
      bottom: '18%',
      width: '74%',
      zIndex: 20,
      transform: visible ? 'translateX(0)' : 'translateX(110%)',
      transition: 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
      background: 'rgba(10,10,20,0.88)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRight: 'none',
      borderRadius: '1rem 0 0 1rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.25rem 1.5rem',
      gap: '1rem',
      pointerEvents: visible ? 'auto' : 'none',
    }}>
      <span style={{ color: '#f59e0b', fontSize: '0.7rem', fontWeight: 700, fontFamily: "'Inter', sans-serif", letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        ⚡ Evento
      </span>
      <p style={{ color: 'white', fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: '0.9rem', textAlign: 'center', lineHeight: 1.4, margin: 0 }}>
        {text}
      </p>
      <button
        onClick={onComplete}
        style={{
          background: 'linear-gradient(135deg, #00ff88, #00cc6a)',
          color: '#000',
          border: 'none',
          borderRadius: '9999px',
          padding: '0.5rem 1.25rem',
          fontSize: '0.8rem',
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: "'Inter', sans-serif",
          letterSpacing: '0.04em',
          marginTop: '0.25rem',
        }}
      >
        Cumpri o desafio ✓
      </button>
    </div>
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
