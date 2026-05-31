import { useRef, useState, useEffect } from 'react'
import type React from 'react'

interface OpponentPanelProps {
  remoteVideoRef: React.RefObject<HTMLVideoElement>
  opponentCount: number
  latencyMs: number | null
  isReconnecting?: boolean
}

export function OpponentPanel({ remoteVideoRef, opponentCount, latencyMs, isReconnecting = false }: OpponentPanelProps) {
  const lColor = latencyColor(latencyMs)
  const prevCountRef = useRef(opponentCount)
  const [animKey, setAnimKey] = useState(0)

  useEffect(() => {
    if (opponentCount > prevCountRef.current) {
      setAnimKey(k => k + 1)
    }
    prevCountRef.current = opponentCount
  }, [opponentCount])

  return (
    <div className="relative w-full aspect-square overflow-hidden rounded-3xl bg-neutral-900/60 border border-neutral-800 shadow-2xl backdrop-blur-sm">
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
        <div style={{ position: 'absolute', inset: 0, zIndex: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
          <div style={{ width: 36, height: 36, border: '3px solid rgba(255,255,255,0.2)', borderTop: '3px solid rgba(255,255,255,0.85)', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
          <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.9rem', fontWeight: 600, fontFamily: "'Inter', sans-serif", letterSpacing: '0.04em' }}>
            Reconectando…
          </span>
        </div>
      )}

      {/* Top-left: aura score + latency */}
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
            +{opponentCount} 💀
          </span>
        </div>
        <div style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', borderRadius: '0.5rem', padding: '0.25rem 0.55rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
          <WifiIcon color={lColor} />
          <span style={{ color: lColor, fontSize: '0.75rem', fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>
            {latencyMs !== null ? `${latencyMs}ms` : '—'}
          </span>
        </div>
      </div>
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
      <path d="M5 12.55a11 11 0 0 1 14.08 0" />
      <path d="M1.42 9a16 16 0 0 1 21.16 0" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <line x1="12" y1="20" x2="12.01" y2="20" />
    </svg>
  )
}
