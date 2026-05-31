import { useRef, useState } from 'react'

interface SpotlightCardProps {
  children: React.ReactNode
  className?: string
  spotlightColor?: string
}

export default function SpotlightCard({
  children,
  className = '',
  spotlightColor = 'rgba(99, 102, 241, 0.4)', // Aumentei de 0.15 para 0.4
}: SpotlightCardProps) {
  const divRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [opacity, setOpacity] = useState(0)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current) return
    const rect = divRef.current.getBoundingClientRect()
    setPosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
  }

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setOpacity(1)}
      onMouseLeave={() => setOpacity(0)}
      className={`relative overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/80 p-8 transition-colors hover:border-neutral-500 ${className}`}
      style={{ paddingBottom: '20px', paddingLeft: '12px', paddingRight: '12px', }}
    >
      {/* O Holofote Turbinado */}
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300"
        style={{
          opacity,
          // Diminuí o círculo para 300px para a luz ficar mais "dura" e visível
          background: `radial-gradient(300px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 60%)`,
        }}
      />

      <div className="relative z-10">{children}</div>
    </div>
  )
}