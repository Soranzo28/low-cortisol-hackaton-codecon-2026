

interface ShinyTextProps {
  text: string;
  disabled?: boolean;
  speed?: number;
  className?: string;
}

export default function ShinyText({ text, disabled = false, speed = 3, className = '' }: ShinyTextProps) {
  const animationDuration = `${speed}s`;

  return (
    <div
      className={`inline-block ${disabled ? '' : 'animate-shine'} bg-[linear-gradient(110deg,#34d399,45%,#ffffff,55%,#34d399)] bg-[length:200%_100%] bg-clip-text text-transparent ${className}`}
      style={{ animationDuration }}
    >
      {text}
    </div>
  );
}
