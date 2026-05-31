import { useEffect, useRef, useState } from 'react';

interface SplitTextProps {
  text: string;
  className?: string;
  delay?: number;
}

export default function SplitText({ text, className = '', delay = 50 }: SplitTextProps) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const words = text.split(' ');

  return (
    <div ref={ref} className={`inline-flex flex-wrap gap-x-3 justify-center ${className}`}>
      {words.map((word, wordIndex) => (
        <div key={wordIndex} className="inline-block pb-4 pt-1 -mb-3 pr-2 -mr-2">
          <div
            className={`transition-all duration-700 ease-out ${
              isVisible ? 'opacity-100 translate-y-0 blur-none' : 'opacity-0 translate-y-8 blur-md'
            }`}
            style={{ transitionDelay: `${wordIndex * delay}ms` }}
          >
            {word}
          </div>
        </div>
      ))}
    </div>
  );
}
