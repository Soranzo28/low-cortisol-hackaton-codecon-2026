import { useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGestureDetector } from '@/hooks/useGestureDetector'
import { useMultiplayer } from '@/hooks/useMultiplayer'
import { Counter } from '@/components/Counter'
import { StatusBadge } from '@/components/StatusBadge'
import { OpponentPanel } from '@/components/OpponentPanel'

const SERVER = import.meta.env.VITE_SERVER_URL
const WS_PROTO = window.location.protocol === 'https:' ? 'wss' : 'ws'

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()

  // Role no longer needed — server determines who is offerer by connection order

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)

  const roomWsUrl = `${WS_PROTO}://${SERVER}/room/${roomId}`

  const { count, status: gestureStatus } = useGestureDetector(videoRef, canvasRef)

  const { status: mpStatus, opponentCount } = useMultiplayer({
    roomWsUrl,
    localCount: count,
    localVideoRef: videoRef,
    remoteVideoRef,
  })

  const isMatched = mpStatus === 'matched'

  // If room rejected us (full or not found), go home
  useEffect(() => {
    if (mpStatus === 'error') {
      navigate('/', { replace: true })
    }
  }, [mpStatus, navigate])

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
      {/* ── Local video (left half when matched, full when waiting) ─────────── */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: isMatched ? '50%' : '100%',
          height: '100vh',
          objectFit: 'cover',
          display: 'block',
          transition: 'width 0.3s ease',
        }}
      />

      {/* ── Skeleton overlay (constrained to left half when matched) ─────────── */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: isMatched ? '50%' : '100%',
          height: '100vh',
          pointerEvents: 'none',
          zIndex: 5,
          transition: 'width 0.3s ease',
        }}
      />

      {/* ── Local counter ────────────────────────────────────────────────────── */}
      <Counter count={count} side={isMatched ? 'left' : 'center'} />

      {/* ── Opponent panel ───────────────────────────────────────────────────── */}
      {isMatched && (
        <OpponentPanel
          remoteVideoRef={remoteVideoRef}
          opponentCount={opponentCount}
        />
      )}

      {/* ── Status badge (bottom center) ─────────────────────────────────────── */}
      {!isMatched && <StatusBadge status={gestureStatus} />}

      {/* ── Waiting overlay (before match is found in room) ──────────────────── */}
      {(mpStatus === 'connecting' || mpStatus === 'waiting_peer') && (
        <WaitingOverlay status={mpStatus} />
      )}

      {/* ── Disconnected banner ───────────────────────────────────────────────── */}
      {mpStatus === 'disconnected' && (
        <DisconnectedBanner onGoHome={() => navigate('/')} />
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

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
