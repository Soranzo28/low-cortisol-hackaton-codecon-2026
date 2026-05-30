interface CounterProps {
  count: number
  side?: 'center' | 'left' | 'right'
}

export function Counter({ count, side = 'center' }: CounterProps) {
  const posStyle: React.CSSProperties =
    side === 'left'
      ? { left: 0, right: '50%', justifyContent: 'center' }
      : side === 'right'
        ? { left: '50%', right: 0, justifyContent: 'center' }
        : { left: 0, right: 0, justifyContent: 'center' }

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        pointerEvents: 'none',
        zIndex: 10,
        ...posStyle,
      }}
    >
      <span
        style={{
          fontSize: 'clamp(6rem, 20vw, 14rem)',
          color: 'white',
          textShadow:
            '0 4px 32px rgba(0,0,0,0.9), 0 2px 8px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,1)',
          fontWeight: 900,
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
          userSelect: 'none',
        }}
      >
        {count}
      </span>
    </div>
  )
}
