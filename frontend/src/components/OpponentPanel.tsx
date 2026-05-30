import type React from 'react'

interface OpponentPanelProps {
  remoteVideoRef: React.RefObject<HTMLVideoElement>
  opponentCount: number
}

export function OpponentPanel({ remoteVideoRef, opponentCount }: OpponentPanelProps) {
  return (
    <>
      {/* ── Right half: opponent video ──────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '50%',
          height: '100vh',
          zIndex: 6,
          overflow: 'hidden',
          borderLeft: '3px solid rgba(255,255,255,0.15)',
        }}
      >
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
            transform: 'scaleX(-1)', // mirror for natural feel
          }}
        />

        {/* Opponent count overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          <span
            style={{
              fontSize: 'clamp(6rem, 10vw, 14rem)',
              color: 'white',
              textShadow:
                '0 4px 32px rgba(0,0,0,0.9), 0 2px 8px rgba(0,0,0,0.8)',
              fontWeight: 900,
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
              userSelect: 'none',
            }}
          >
            {opponentCount}
          </span>
        </div>

        {/* "ADVERSÁRIO" label */}
        <div
          style={{
            position: 'absolute',
            top: '1rem',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 11,
            backgroundColor: 'rgba(239,68,68,0.75)',
            color: 'white',
            padding: '0.3rem 1rem',
            borderRadius: '9999px',
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: '0.12em',
            backdropFilter: 'blur(6px)',
            userSelect: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          ADVERSÁRIO
        </div>
      </div>

      {/* ── Divider line in center ─────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '3px',
          height: '100vh',
          background:
            'linear-gradient(to bottom, transparent, rgba(255,255,255,0.5) 20%, rgba(255,255,255,0.5) 80%, transparent)',
          zIndex: 15,
          pointerEvents: 'none',
        }}
      />

      {/* ── "VOCÊ" label ───────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          top: '1rem',
          left: '25%',
          transform: 'translateX(-50%)',
          zIndex: 11,
          backgroundColor: 'rgba(34,197,94,0.75)',
          color: 'white',
          padding: '0.3rem 1rem',
          borderRadius: '9999px',
          fontSize: '0.75rem',
          fontWeight: 700,
          letterSpacing: '0.12em',
          backdropFilter: 'blur(6px)',
          userSelect: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        VOCÊ
      </div>
    </>
  )
}
