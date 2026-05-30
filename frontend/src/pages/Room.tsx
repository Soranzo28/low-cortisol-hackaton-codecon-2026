import { useRef, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGestureDetector } from '@/hooks/useGestureDetector'
import { useMultiplayer, GameOverData } from '@/hooks/useMultiplayer'
import { Counter } from '@/components/Counter'
import { StatusBadge } from '@/components/StatusBadge'
import { OpponentPanel } from '@/components/OpponentPanel'

const SERVER = import.meta.env.VITE_SERVER_URL
const WS_PROTO = window.location.protocol === 'https:' ? 'wss' : 'ws'

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)

  const roomWsUrl = `${WS_PROTO}://${SERVER}/room/${roomId}`

  const { count, status: gestureStatus } = useGestureDetector(videoRef, canvasRef)

  // ── Base count tracking: capture count at game_start so score begins at 0 ──
  const countRef = useRef(0)
  countRef.current = count

  const baseCountRef = useRef(0)
  const gameStartedRef = useRef(false)

  const { status: mpStatus, opponentCount, countdown, remaining, gameOver } = useMultiplayer({
    roomWsUrl,
    localCount: gameStartedRef.current ? Math.max(0, count - baseCountRef.current) : 0,
    localVideoRef: videoRef,
    remoteVideoRef,
  })

  useEffect(() => {
    if (remaining !== null && !gameStartedRef.current) {
      gameStartedRef.current = true
      baseCountRef.current = countRef.current
    }
    if (remaining === null && gameOver === null) {
      gameStartedRef.current = false
    }
  }, [remaining, gameOver])

  const gameCount = gameStartedRef.current ? Math.max(0, count - baseCountRef.current) : 0

  const isMatched = mpStatus === 'matched'

  // If room rejected us (full or not found), go home
  useEffect(() => {
    if (mpStatus === 'error') {
      navigate('/', { replace: true })
    }
  }, [mpStatus, navigate])

  // Camera readiness — show spinner until video stream is playing
  const [cameraReady, setCameraReady] = useState(false)
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const onReady = () => {
      if (video.readyState >= 2) setCameraReady(true)
    }

    if (video.readyState >= 2) {
      setCameraReady(true)
      return
    }

    video.addEventListener('loadeddata', onReady)
    return () => video.removeEventListener('loadeddata', onReady)
  }, [])

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100vh',
        overflow: 'hidden',
        background: '#000',
      }}
    >
      {/* ── Local video container (left half when matched, full when waiting) ── */}
      <div
        style={{
          position: 'relative',
          width: isMatched ? '50%' : '100%',
          height: '100vh',
          overflow: 'hidden',
          transition: 'width 0.3s ease',
        }}
      >
        {/* Camera loading spinner */}
        {!cameraReady && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 10,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1rem',
              background: '#111',
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                border: '4px solid rgba(99,102,241,0.25)',
                borderTop: '4px solid #818cf8',
                borderRadius: '50%',
                animation: 'spin 0.9s linear infinite',
              }}
            />
            <span
              style={{
                color: 'rgba(255,255,255,0.7)',
                fontSize: '0.9rem',
                fontWeight: 600,
                fontFamily: "'Inter', sans-serif",
              }}
            >
              Carregando câmera…
            </span>
          </div>
        )}

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />

        {/* ── Skeleton overlay ───────────────────────────────────────────────── */}
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 5,
          }}
        />
      </div>

      {/* ── Local counter ────────────────────────────────────────────────────── */}
      <Counter count={gameCount} side={isMatched ? 'left' : 'center'} />

      {/* ── Opponent panel ───────────────────────────────────────────────────── */}
      {isMatched && (
        <OpponentPanel
          remoteVideoRef={remoteVideoRef}
          opponentCount={opponentCount}
        />
      )}

      {/* ── Status badge (bottom center) ─────────────────────────────────────── */}
      {!isMatched && <StatusBadge status={gestureStatus} />}

      {/* ── Game timer ────────────────────────────────────────────────────────── */}
      {remaining !== null && gameOver === null && (
        <TimerBadge remaining={remaining} />
      )}

      {/* ── Pre-game countdown overlay ────────────────────────────────────────── */}
      {countdown !== null && (
        <CountdownOverlay value={countdown} />
      )}

      {/* ── Waiting overlay (before match is found in room) ──────────────────── */}
      {(mpStatus === 'connecting' || mpStatus === 'waiting_peer') && (
        <WaitingOverlay status={mpStatus} />
      )}

      {/* ── Game over overlay ─────────────────────────────────────────────────── */}
      {gameOver !== null && (
        <GameOverOverlay data={gameOver} onGoHome={() => navigate('/')} />
      )}

      {/* ── Disconnected banner (only if game didn't finish normally) ────────── */}
      {mpStatus === 'disconnected' && gameOver === null && (
        <DisconnectedBanner onGoHome={() => navigate('/')} />
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TimerBadge({ remaining }: { remaining: number }) {
  const isDanger = remaining <= 5
  const isWarning = remaining <= 10
  const color = isDanger ? '#ef4444' : isWarning ? '#f59e0b' : 'rgba(255,255,255,0.9)'
  return (
    <div
      style={{
        position: 'absolute',
        top: '1rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 20,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        borderRadius: '9999px',
        padding: '0.35rem 1.1rem',
        border: `1px solid ${color}55`,
        transition: 'border-color 0.3s',
      }}
    >
      <span
        style={{
          color,
          fontFamily: "'Inter', sans-serif",
          fontWeight: 700,
          fontSize: '1.4rem',
          fontVariantNumeric: 'tabular-nums',
          transition: 'color 0.3s',
        }}
      >
        {remaining}s
      </span>
    </div>
  )
}

function CountdownOverlay({ value }: { value: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <p
        style={{
          color: 'rgba(255,255,255,0.55)',
          fontSize: '1rem',
          fontWeight: 600,
          fontFamily: "'Inter', sans-serif",
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        Prepare-se!
      </p>
      <span
        key={value}
        style={{
          fontSize: '9rem',
          fontWeight: 800,
          color: 'white',
          fontFamily: "'Inter', sans-serif",
          lineHeight: 1,
          animation: 'pulse-scale 0.75s ease-out',
        }}
      >
        {value}
      </span>
    </div>
  )
}

function GameOverOverlay({ data, onGoHome }: { data: GameOverData; onGoHome: () => void }) {
  const isWin = data.winner === 'you'
  const isDraw = data.winner === 'draw'
  const title = isWin ? 'VITÓRIA' : isDraw ? 'EMPATE' : 'DERROTA'
  const titleColor = isWin ? '#22c55e' : isDraw ? '#f59e0b' : '#ef4444'

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '2rem',
        background: 'rgba(0,0,0,0.88)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <h1
        style={{
          fontSize: '4.5rem',
          fontWeight: 800,
          color: titleColor,
          fontFamily: "'Inter', sans-serif",
          margin: 0,
          letterSpacing: '-0.02em',
        }}
      >
        {title}
      </h1>

      <div style={{ display: 'flex', gap: '3.5rem', alignItems: 'center' }}>
        <ScoreBox label="Você" score={data.yourScore} highlight={isWin} />
        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '2rem', fontWeight: 300 }}>×</span>
        <ScoreBox label="Adversário" score={data.opponentScore} highlight={data.winner === 'opponent'} />
      </div>

      <button
        onClick={onGoHome}
        style={{
          marginTop: '0.5rem',
          background: 'white',
          color: 'black',
          border: 'none',
          borderRadius: '9999px',
          padding: '0.8rem 2.8rem',
          fontSize: '1rem',
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: "'Inter', sans-serif",
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
      >
        Voltar ao lobby
      </button>
    </div>
  )
}

function ScoreBox({ label, score, highlight }: { label: string; score: number; highlight: boolean }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <p
        style={{
          color: 'rgba(255,255,255,0.45)',
          fontSize: '0.75rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginBottom: '0.3rem',
          fontFamily: "'Inter', sans-serif",
        }}
      >
        {label}
      </p>
      <p
        style={{
          color: highlight ? 'white' : 'rgba(255,255,255,0.6)',
          fontSize: '4rem',
          fontWeight: 800,
          lineHeight: 1,
          fontFamily: "'Inter', sans-serif",
        }}
      >
        {score}
      </p>
    </div>
  )
}

function WaitingOverlay({ status }: { status: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 30,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1.25rem',
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          border: '4px solid rgba(99,102,241,0.25)',
          borderTop: '4px solid #818cf8',
          borderRadius: '50%',
          animation: 'spin 0.9s linear infinite',
        }}
      />
      <p
        style={{
          color: 'rgba(255,255,255,0.85)',
          fontSize: '1.1rem',
          fontWeight: 600,
          fontFamily: "'Inter', sans-serif",
        }}
      >
        {status === 'connecting' ? 'Conectando à sala…' : 'Aguardando adversário entrar…'}
      </p>
    </div>
  )
}

function DisconnectedBanner({ onGoHome }: { onGoHome: () => void }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        padding: '1rem 2rem',
        background: 'rgba(239,68,68,0.85)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <span style={{ color: 'white', fontWeight: 600 }}>
        ⚠️ Adversário desconectou.
      </span>
      <button
        onClick={onGoHome}
        style={{
          background: 'rgba(255,255,255,0.2)',
          color: 'white',
          border: '1px solid rgba(255,255,255,0.4)',
          borderRadius: '9999px',
          padding: '0.4rem 1.2rem',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '0.9rem',
        }}
      >
        Voltar ao início
      </button>
    </div>
  )
}
