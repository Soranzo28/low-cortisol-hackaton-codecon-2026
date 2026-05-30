// LobbyOverlay is kept for reference but is no longer used in the app
// (matchmaking now happens on the Home page via useQueue)
type MultiplayerStatus = 'idle' | 'connecting' | 'waiting' | 'waiting_peer' | 'matched' | 'disconnected' | 'error'

interface LobbyOverlayProps {
  mpStatus: MultiplayerStatus
  roomId: string | null
  onConnect: () => void
  onDisconnect: () => void
}

const statusMessages: Partial<Record<MultiplayerStatus, string>> = {
  connecting: 'Conectando ao servidor...',
  waiting: 'Aguardando adversário...',
  waiting_peer: 'Aguardando adversário...',
  disconnected: 'Adversário desconectou.',
}

export function LobbyOverlay({
  mpStatus,
  roomId,
  onConnect,
  onDisconnect,
}: LobbyOverlayProps) {
  const isIdle = mpStatus === 'idle'
  const isWaiting = mpStatus === 'waiting'
  const isConnecting = mpStatus === 'connecting'
  const isDisconnected = mpStatus === 'disconnected'
  const busy = isConnecting || isWaiting

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingBottom: '5rem',
        zIndex: 20,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          pointerEvents: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem',
        }}
      >
        {/* Status message */}
        {(isWaiting || isConnecting || isDisconnected) && (
          <p
            style={{
              color: 'rgba(255,255,255,0.85)',
              fontSize: '0.95rem',
              fontWeight: 500,
              backgroundColor: 'rgba(0,0,0,0.55)',
              padding: '0.4rem 1.2rem',
              borderRadius: '9999px',
              backdropFilter: 'blur(6px)',
              margin: 0,
            }}
          >
            {statusMessages[mpStatus]}
            {isWaiting && roomId && (
              <span style={{ opacity: 0.6, fontSize: '0.8rem' }}>
                {' '}— sala <code style={{ fontFamily: 'monospace' }}>{roomId}</code>
              </span>
            )}
          </p>
        )}

        {/* Main CTA button */}
        {(isIdle || isDisconnected) && (
          <button
            id="btn-multiplayer-connect"
            onClick={onConnect}
            style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: 'white',
              border: 'none',
              borderRadius: '9999px',
              padding: '0.85rem 2.5rem',
              fontSize: '1.1rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 24px rgba(99,102,241,0.5)',
              letterSpacing: '0.04em',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.05)'
              ;(e.currentTarget as HTMLButtonElement).style.boxShadow =
                '0 6px 32px rgba(99,102,241,0.7)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'
              ;(e.currentTarget as HTMLButtonElement).style.boxShadow =
                '0 4px 24px rgba(99,102,241,0.5)'
            }}
          >
            {isDisconnected ? '🔄 Reconectar' : '⚔️ Jogar Multiplayer'}
          </button>
        )}

        {/* Cancel button while waiting */}
        {busy && (
          <button
            id="btn-multiplayer-cancel"
            onClick={onDisconnect}
            style={{
              background: 'rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.7)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '9999px',
              padding: '0.55rem 1.8rem',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
              backdropFilter: 'blur(6px)',
            }}
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  )
}
