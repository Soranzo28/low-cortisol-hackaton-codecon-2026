import type React from 'react'

interface OpponentPanelProps {
  remoteVideoRef: React.RefObject<HTMLVideoElement>
  opponentCount: number
  latencyMs: number | null
  isMobile: boolean
  oppNick?: string
  oppRankingScore?: number
  isReconnecting?: boolean
}

export function OpponentPanel({ remoteVideoRef, opponentCount, latencyMs, isMobile, oppNick = 'Adversário', oppRankingScore = 0, isReconnecting = false }: OpponentPanelProps) {
  const lColor = latencyColor(latencyMs)

  return (
    <div className="relative w-full flex-1 overflow-hidden rounded-3xl bg-neutral-900/60 border border-neutral-800 shadow-2xl backdrop-blur-sm">
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
          transform: 'scaleX(-1)',
          filter: isReconnecting ? 'blur(12px) brightness(0.5)' : 'none',
          transition: 'filter 0.4s ease',
        }}
      />

      {isReconnecting && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 12,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
        }}>
          <div style={{
            width: 36, height: 36,
            border: '3px solid rgba(255,255,255,0.2)',
            borderTop: '3px solid rgba(255,255,255,0.85)',
            borderRadius: '50%',
            animation: 'spin 0.9s linear infinite',
          }} />
          <span style={{
            color: 'rgba(255,255,255,0.9)',
            fontSize: '0.9rem',
            fontWeight: 600,
            fontFamily: "'Inter', sans-serif",
            letterSpacing: '0.04em',
          }}>
            Reconectando…
          </span>
        </div>
      )}

      {/* Top-left: nick (score) */}
      <div style={playerNameStyle}>
        <span style={{ color: 'white', fontSize: '0.8rem', fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>
          {oppNick}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', marginLeft: '0.3rem', fontFamily: "'Inter', sans-serif" }}>
          ({String(oppRankingScore).padStart(4, '0')})
        </span>
      </div>

      {/* Top-right: latency */}
      <div style={latencyBadgeStyle}>
        <WifiIcon color={lColor} />
        <span style={{ color: lColor, fontSize: '0.75rem', fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>
          {latencyMs !== null ? `${latencyMs}ms` : '—'}
        </span>
      </div>

      {/* Bottom-center: +X Aura */}
      <div style={scoreLabelStyle}>
        <span style={scoreTextStyle}>
          +{opponentCount}{' '}
          <span style={{ fontSize: '0.45em', fontWeight: 700, opacity: 0.7 }}>Aura</span>
        </span>
      </div>
    </div>
  )
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const playerNameStyle: React.CSSProperties = {
  position: 'absolute',
  top: '0.75rem',
  left: '0.75rem',
  zIndex: 11,
  display: 'flex',
  alignItems: 'center',
  background: 'rgba(0,0,0,0.5)',
  backdropFilter: 'blur(6px)',
  borderRadius: '9999px',
  padding: '0.25rem 0.75rem',
}

const latencyBadgeStyle: React.CSSProperties = {
  position: 'absolute',
  top: '0.75rem',
  right: '0.75rem',
  zIndex: 11,
  display: 'flex',
  alignItems: 'center',
  gap: '0.3rem',
  background: 'rgba(0,0,0,0.5)',
  backdropFilter: 'blur(6px)',
  borderRadius: '9999px',
  padding: '0.25rem 0.65rem',
}

const scoreLabelStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '2rem',
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 11,
  pointerEvents: 'none',
  textAlign: 'center',
  whiteSpace: 'nowrap',
}

const scoreTextStyle: React.CSSProperties = {
  fontSize: 'clamp(2.5rem, 8vw, 6rem)',
  color: 'white',
  textShadow: '0 4px 32px rgba(0,0,0,0.9), 0 2px 8px rgba(0,0,0,0.8)',
  fontWeight: 900,
  lineHeight: 1,
  fontFamily: "'Inter', sans-serif",
  userSelect: 'none',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function latencyColor(ms: number | null): string {
  if (ms === null) return 'rgba(255,255,255,0.4)'
  if (ms < 80) return '#22c55e'
  if (ms <= 200) return '#f59e0b'
  return '#ef4444'
}

function WifiIcon({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.55a11 11 0 0 1 14.08 0" />
      <path d="M1.42 9a16 16 0 0 1 21.16 0" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <line x1="12" y1="20" x2="12.01" y2="20" />
    </svg>
  )
}
