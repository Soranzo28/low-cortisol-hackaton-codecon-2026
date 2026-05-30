import type React from 'react'

interface OpponentPanelProps {
  remoteVideoRef: React.RefObject<HTMLVideoElement>
  opponentCount: number
  latencyMs: number | null
  isMobile: boolean
}

export function OpponentPanel({ remoteVideoRef, opponentCount, latencyMs, isMobile }: OpponentPanelProps) {
  const panelStyle: React.CSSProperties = isMobile
    ? {
        position: 'absolute',
        top: '60vh',
        left: 0,
        width: '100%',
        height: '40vh',
        zIndex: 6,
        overflow: 'hidden',
        borderTop: '2px solid rgba(255,255,255,0.15)',
      }
    : {
        position: 'absolute',
        top: 0,
        right: 0,
        width: '50%',
        height: '100vh',
        zIndex: 6,
        overflow: 'hidden',
        borderLeft: '3px solid rgba(255,255,255,0.15)',
      }

  const lColor = latencyColor(latencyMs)

  return (
    <div style={panelStyle}>
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
        }}
      />

      {/* Top-left: Adversário (0000) */}
      <div style={playerNameStyle}>
        <span style={{ color: 'white', fontSize: '0.8rem', fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>
          Adversário
        </span>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', marginLeft: '0.3rem', fontFamily: "'Inter', sans-serif" }}>
          (0000)
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
