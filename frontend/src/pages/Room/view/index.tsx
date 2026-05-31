import { useRef, useState, useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
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
    isTrain, user, myNick,
    eventPanelVisible, eventCountdown, eventWinnerName, eventTitle, eventInstruction, eventGif,
    localGlowActive, localGlowFading,
    opponentGlowActive, opponentGlowFading,
    trainSelectedEvent, selectTrainEvent,
  } = props

  return (
    <div className="relative min-h-screen w-full flex flex-col p-4 md:p-8 overflow-hidden bg-[#09090b] text-neutral-200 font-sans">
      {/* Background Blobs */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-900/20 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-900/10 blur-[120px] rounded-full mix-blend-screen" />
      </div>

      {/* Back button — train mode only, absolute like About page */}
      {isTrain && (
        <button
          onClick={() => navigate(ROUTES.HOME)}
          className="absolute top-6 left-6 md:top-8 md:left-8 w-12 h-12 rounded-full bg-neutral-900/60 border border-neutral-800 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all backdrop-blur-md z-50 hover:scale-105 active:scale-95"
          title="Voltar para o Início"
        >
          <ArrowLeft size={24} />
        </button>
      )}

      {/* Header / Timer */}
      <div className="w-full h-16 md:h-20 shrink-0 relative z-20 flex justify-center items-center">
        {remaining !== null && gameOver === null && !isTrain && (
          <TimerBadge remaining={remaining} />
        )}
        {isTrain && (
          <div style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', borderRadius: '9999px', padding: '0.35rem 1.25rem', border: '1px solid rgba(255,255,255,0.2)', marginTop: '1rem' }}>
            <span style={{ color: 'white', fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: '1.1rem' }}>Treinamento Livre</span>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div
        className="relative z-10"
        style={{
          width: '100%',
          maxWidth: 1600,
          margin: '0 auto',
          flex: 1,
          display: 'flex',
          flexDirection: isMatched && !isMobile ? 'row' : 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '3rem',
        }}
      >
        {/* Local player column */}
        <div style={isMatched && !isMobile
          ? { flex: '1 1 0', minWidth: 0, maxWidth: 750, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }
          : { width: '100%', maxWidth: isTrain ? 750 : 600, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }
        }>
          {/* Camera panel + optional train event selector side by side */}
          <div style={{ display: 'flex', width: '100%', gap: '0.75rem', alignItems: 'flex-start' }}>
          <div className="relative overflow-hidden rounded-3xl bg-neutral-900/60 border border-neutral-800 shadow-2xl backdrop-blur-sm"
            style={{ flex: '1 1 0', minWidth: 0, aspectRatio: '1/1' }}>
            {localGlowActive && (
              <div style={{
                position: 'absolute', inset: 0, borderRadius: 'inherit', zIndex: 20, pointerEvents: 'none',
                border: '2px solid #00ff88',
                animation: localGlowFading ? 'none' : 'glow-pulse 1.2s ease-in-out infinite',
                opacity: localGlowFading ? 0 : 1,
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
          {/* Train event selector — right next to the camera */}
          {isTrain && (
            <TrainEventSelector selected={trainSelectedEvent} onSelect={selectTrainEvent} />
          )}
          </div>{/* end camera+selector row */}
          {(isMatched || isTrain) && (
            <PlayerBelowInfo name={isTrain ? 'Treino' : myNick} rankingScore={matchCtx.myScore} avatarUrl={user?.imageUrl ?? undefined} />
          )}
        </div>

        {/* Opponent column */}
        {isMatched && (
          <div style={{ flex: '1 1 0', minWidth: 0, maxWidth: 750, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
            {/* Wrapper: overflow-hidden clips EventPanel slide animation */}
            <div style={{ position: 'relative', width: '100%', overflow: 'hidden', borderRadius: '1.5rem' }}>
              <OpponentPanel
                remoteVideoRef={remoteVideoRef}
                opponentCount={opponentCount}
                latencyMs={latencyMs}
                isReconnecting={opponentReconnecting}
              />
              {opponentGlowActive && (
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: 'inherit', zIndex: 20, pointerEvents: 'none',
                  border: '2px solid #00ff88',
                  animation: opponentGlowFading ? 'none' : 'glow-pulse 1.2s ease-in-out infinite',
                  opacity: opponentGlowFading ? 0 : 1,
                  transition: 'opacity 0.5s ease',
                }} />
              )}
              <EventPanel visible={eventPanelVisible} countdown={eventCountdown} winnerName={eventWinnerName} title={eventTitle} instruction={eventInstruction} gif={eventGif} />
            </div>
            <PlayerBelowInfo name={matchCtx.oppNick} rankingScore={matchCtx.oppScore} avatarUrl={matchCtx.oppImageUrl ?? undefined} />
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
  const prevScoreRef = useRef(score)
  const [animKey, setAnimKey] = useState(0)

  useEffect(() => {
    if (score > prevScoreRef.current) {
      setAnimKey(k => k + 1)
    }
    prevScoreRef.current = score
  }, [score])

  return (
    <div style={{ position: 'absolute', top: '0.75rem', left: '0.75rem', zIndex: 11, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
      <div style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', borderRadius: '0.5rem', padding: '0.3rem 0.75rem', display: 'inline-flex', alignItems: 'center' }}>
        <span
          key={animKey}
          style={{
            color: 'white',
            fontSize: '2rem',
            fontWeight: 800,
            fontFamily: "'Inter', sans-serif",
            textShadow: '0 2px 16px rgba(255,255,255,0.3)',
            display: 'inline-block',
            animation: animKey > 0 ? 'sanfona 0.45s ease-out' : 'none',
          }}
        >
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

function PlayerBelowInfo({ name, rankingScore, avatarUrl }: { name: string; rankingScore: number; avatarUrl?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', marginTop: '0.75rem' }}>
      <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(255,255,255,0.22)', flexShrink: 0 }}>
        <img src={avatarUrl || defaultIconUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <span style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600, fontFamily: "'Inter', sans-serif", fontSize: '0.85rem', letterSpacing: '0.06em' }}>
        {name.toUpperCase()} ({String(rankingScore).padStart(3, '0')})
      </span>
    </div>
  )
}

const TRAIN_EVENTS = [
  { id: 'absolute_cinema', label: 'Absolute Cinema', icon: '🤲', desc: 'Duas palmas abertas por 1s' },
  { id: 'nerd_up',         label: 'Nerd Up',         icon: '☝', desc: 'Só o indicador levantado' },
  { id: 'rock_on',         label: 'Rock On',         icon: '🤘', desc: 'Indicador e mindinho levantados' },
  { id: 'thumbs_up',      label: 'Joinha',          icon: '👍', desc: 'Só o polegar levantado' },
]

function TrainEventSelector({ selected, onSelect }: { selected: string | null; onSelect: (id: string) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: 168, flexShrink: 0 }}>
      <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', paddingLeft: '0.25rem' }}>
        Testar Evento
      </span>
      {TRAIN_EVENTS.map(ev => (
        <button
          key={ev.id}
          onClick={() => onSelect(ev.id)}
          style={{
            background: selected === ev.id ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${selected === ev.id ? 'rgba(245,158,11,0.45)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: '0.75rem',
            padding: '0.65rem 0.8rem',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: '0.2rem',
            transition: 'background 0.2s, border-color 0.2s',
            width: '100%',
            textAlign: 'left',
          }}
        >
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: selected === ev.id ? '#f59e0b' : 'rgba(255,255,255,0.75)', fontFamily: "'Inter', sans-serif" }}>
            {ev.icon} {ev.label}
          </span>
          <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', fontFamily: "'Inter', sans-serif", lineHeight: 1.3 }}>
            {ev.desc}
          </span>
          {selected === ev.id && (
            <span style={{ fontSize: '0.6rem', color: '#f59e0b', fontFamily: "'Inter', sans-serif", fontWeight: 600, marginTop: '0.1rem' }}>
              ● Detectando…
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

function EventPanel({ visible, countdown, winnerName, title, instruction, gif }: { visible: boolean; countdown: number; winnerName: string | null; title: string; instruction: string; gif: string | null }) {
  return (
    <div style={{
      position: 'absolute',
      top: '12%',
      right: 0,
      bottom: '12%',
      width: '78%',
      zIndex: 20,
      transform: visible ? 'translateX(0)' : 'translateX(110%)',
      transition: 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1), background 0.4s ease, border-color 0.4s ease',
      background: winnerName ? 'rgba(0,20,10,0.94)' : 'rgba(10,10,20,0.92)',
      backdropFilter: 'blur(12px)',
      border: `1px solid ${winnerName ? 'rgba(0,255,136,0.25)' : 'rgba(255,255,255,0.1)'}`,
      borderRight: 'none',
      borderRadius: '1rem 0 0 1rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.25rem 1.5rem',
      gap: '0.85rem',
      pointerEvents: 'none',
    }}>
      {winnerName ? (
        <>
          <span style={{ fontSize: '1.8rem' }}>🏆</span>
          <p style={{ color: '#00ff88', fontFamily: "'Inter', sans-serif", fontWeight: 800, fontSize: '0.95rem', textAlign: 'center', lineHeight: 1.4, margin: 0, textShadow: '0 0 12px rgba(0,255,136,0.5)' }}>
            {winnerName} ganhou o evento!
          </p>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: '0.72rem', textAlign: 'center', margin: 0 }}>
            +15 pontos de bônus
          </p>
        </>
      ) : (
        <>
          <span style={{ color: '#f59e0b', fontSize: '0.7rem', fontWeight: 700, fontFamily: "'Inter', sans-serif", letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            ⚡ Evento
          </span>
          <p style={{ color: 'white', fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: '1rem', textAlign: 'center', lineHeight: 1.4, margin: 0 }}>
            {title}
          </p>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: '0.78rem', textAlign: 'center', lineHeight: 1.5, margin: 0 }}>
            {instruction}
          </p>
          {gif && (
            <img
              src={gif}
              alt="event"
              style={{ width: '80%', borderRadius: '0.5rem', objectFit: 'cover', flexShrink: 0 }}
            />
          )}
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: countdown <= 2 ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.15)',
            border: `2px solid ${countdown <= 2 ? '#ef4444' : '#f59e0b'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.3s, border-color 0.3s',
          }}>
            <span style={{ color: countdown <= 2 ? '#ef4444' : '#f59e0b', fontWeight: 800, fontSize: '1.1rem', fontFamily: "'Inter', sans-serif", fontVariantNumeric: 'tabular-nums' }}>
              {Math.max(0, countdown)}
            </span>
          </div>
        </>
      )}
    </div>
  )
}

function TimerBadge({ remaining }: { remaining: number }) {
  const isDanger = remaining <= 5; const isWarning = remaining <= 10
  const color = isDanger ? '#ef4444' : isWarning ? '#f59e0b' : 'rgba(255,255,255,0.9)'
  return (
    <div style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', borderRadius: '9999px', padding: '0.5rem 1.75rem', border: `1px solid ${color}55`, whiteSpace: 'nowrap', transition: 'border-color 0.3s' }}>
      <span style={{ color, fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: '1.9rem', fontVariantNumeric: 'tabular-nums', transition: 'color 0.3s' }}>Tempo Restante: {remaining}s</span>
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
