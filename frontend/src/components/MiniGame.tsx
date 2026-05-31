import { useState, useEffect, useRef } from 'react';
import sprite1Fox from '@/assets/minigames/raposa/sprite1fox.png';
import sprite2Fox from '@/assets/minigames/raposa/sprite2fox.png';
import sprite1Bart from '@/assets/minigames/bartolomeu/Sprite1.png';
import sprite2Bart from '@/assets/minigames/bartolomeu/Sprite2.png';
import sprite3Bart from '@/assets/minigames/bartolomeu/Sprite3.png';

export default function MiniGame() {
  const [foxState, setFoxState] = useState<'idle' | 'warning' | 'looking'>('idle');
  const [bartFrame, setBartFrame] = useState(1);
  const [isDancing, setIsDancing] = useState(false);
  const [score, setScore] = useState(0);
  const [floatingPoints, setFloatingPoints] = useState<{id: number, time: number, text: string}[]>([]);
  const [gameOver, setGameOver] = useState(false);
  
  // Game loop refs
  const isDancingRef = useRef(isDancing);
  const foxStateRef = useRef(foxState);
  const gameOverRef = useRef(gameOver);
  const tickRef = useRef(0);

  useEffect(() => {
    isDancingRef.current = isDancing;
    foxStateRef.current = foxState;
    gameOverRef.current = gameOver;
  }, [isDancing, foxState, gameOver]);

  const lastKeyRef = useRef<string | null>(null);
  const resetTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle Keys & Animation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameOverRef.current) {
        if (e.key.toLowerCase() === 'r') {
          setGameOver(false);
          setScore(0);
          setFloatingPoints([]);
          setFoxState('idle');
          setBartFrame(1);
          setIsDancing(false);
        }
        return;
      }

      if (e.key === '6' || e.key === '7') {
        if (e.key !== lastKeyRef.current) {
          lastKeyRef.current = e.key;
          setIsDancing(true);
          setBartFrame((prev) => (prev % 3) + 1);

          if (foxStateRef.current === 'looking') {
            setGameOver(true);
            setIsDancing(false);
          } else {
            tickRef.current += 1;
            if (tickRef.current >= 2) {
              tickRef.current = 0;
              setScore((s) => s + 1);
              setFloatingPoints((prev) => {
                const now = Date.now();
                return [...prev.filter(p => now - p.time < 800), { id: Math.random(), time: now, text: '+1' }];
              });
            }
          }

          if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
          resetTimeoutRef.current = setTimeout(() => {
            setIsDancing(false);
            setBartFrame(1);
            lastKeyRef.current = null;
          }, 300);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
    };
  }, []);

  // Fox AI
  useEffect(() => {
    if (gameOver) return;

    let timeout: NodeJS.Timeout;
    
    const runFoxAI = () => {
      if (foxStateRef.current === 'idle') {
        const waitTime = Math.random() * 2000 + 1500; // 1.5s to 3.5s
        timeout = setTimeout(() => {
          setFoxState('warning');
          runFoxAI();
        }, waitTime);
      } else if (foxStateRef.current === 'warning') {
        timeout = setTimeout(() => {
          setFoxState('looking');
          runFoxAI();
        }, 600); // 0.6s warning
      } else if (foxStateRef.current === 'looking') {
        const waitTime = Math.random() * 1500 + 1000; // 1s to 2.5s
        timeout = setTimeout(() => {
          setFoxState('idle');
          runFoxAI();
        }, waitTime);
      }
    };

    runFoxAI();
    return () => clearTimeout(timeout);
  }, [gameOver]);

  const restartGame = () => {
    setGameOver(false);
    setScore(0);
    setFloatingPoints([]);
    setFoxState('idle');
    setBartFrame(1);
    setIsDancing(false);
  };

  const getFoxImage = () => {
    if (foxState === 'idle') return sprite2Fox;
    if (foxState === 'warning') return sprite1Fox;
    return sprite2Fox; // Looking state
  };

  const getBartImage = () => {
    if (bartFrame === 1) return sprite1Bart;
    if (bartFrame === 2) return sprite2Bart;
    return sprite3Bart;
  };

  return (
    <div className="w-full relative overflow-hidden bg-transparent flex flex-col items-center select-none py-6 border border-white/5 rounded-2xl">
      <style>{`
        @keyframes floatUp {
          0% { opacity: 1; transform: translate(-50%, 0) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -60px) scale(1.5); }
        }
        .animate-float-up {
          animation: floatUp 0.8s ease-out forwards;
        }
      `}</style>
      <div className="w-full h-56 flex justify-between items-end px-4 md:px-12 relative">
        {/* Fox (Left) */}
        <div className="flex flex-col items-center">
          {/* Invisible placeholder to align with the score on the right */}
          <span className="opacity-0 font-black mb-4 tracking-widest text-lg">0 aura</span>
          <div className="w-40 h-40 relative flex justify-center">
            {foxState === 'warning' && (
              <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-4xl font-bold text-red-500 animate-bounce">!</span>
            )}
            <img 
              src={getFoxImage()} 
              alt="Gabi (Panda vermelho, programadora sênior, mas feliz)" 
              className={`w-full h-full object-contain ${foxState === 'looking' ? '-scale-x-100' : ''}`}
            />
          </div>
        </div>

        {/* Bartolomeu (Right) */}
        <div className="flex flex-col items-center">
          <span className={`text-indigo-400 font-black mb-4 tracking-widest text-lg drop-shadow-md transition-all duration-100 ${isDancing && !gameOver ? 'scale-110 -translate-y-1 text-indigo-300 drop-shadow-[0_0_10px_rgba(99,102,241,0.8)]' : 'scale-100'}`}>
            {score} aura
          </span>
          <div className="w-40 h-40 relative flex justify-center">
            {floatingPoints.map(pt => (
              <span key={pt.id} className="absolute left-1/2 text-indigo-300 font-black pointer-events-none z-10 animate-float-up text-sm" style={{ top: '0px' }}>
                {pt.text}
              </span>
            ))}
            <img 
              src={getBartImage()} 
              alt="Bartolomeu" 
              className={`w-full h-full object-contain transition-all duration-75 ${gameOver ? 'filter grayscale brightness-50' : 'drop-shadow-[0_0_15px_rgba(99,102,241,0.3)]'}`}
            />
          </div>
        </div>
      </div>

      {gameOver && (
        <div className="absolute inset-0 bg-red-950/80 backdrop-blur-md flex flex-col items-center justify-center z-10 rounded-2xl">
          <h2 className="text-5xl font-black text-white mb-2 drop-shadow-[0_0_20px_rgba(220,38,38,0.8)]">PEGOU!</h2>
          <p className="text-red-200 mb-8 text-lg">A Gabi te viu fazendo 67.</p>
          <button 
            onClick={restartGame}
            className="px-8 py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(220,38,38,0.4)]"
          >
            Reiniciar (Pressione R)
          </button>
        </div>
      )}
    </div>
  );
}
