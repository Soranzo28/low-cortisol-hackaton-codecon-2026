import type { DetectionStatus } from '@/hooks/useGestureDetector'

const labels: Record<DetectionStatus, string> = {
  loading: 'pose carregando...',
  ready: 'câmera pronta',
  detecting: 'detectando...',
}

interface StatusBadgeProps {
  status: DetectionStatus
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: '1.5rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        backgroundColor: 'rgba(0,0,0,0.55)',
        color: 'white',
        padding: '0.4rem 1.2rem',
        borderRadius: '9999px',
        fontSize: '0.875rem',
        backdropFilter: 'blur(6px)',
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {labels[status]}
    </div>
  )
}
