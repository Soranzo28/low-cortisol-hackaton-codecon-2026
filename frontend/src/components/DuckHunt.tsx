import React, { useState, useEffect, useRef } from 'react';
import duckSpriteSheet from '@/assets/minigames/pato/SpriteSheet.png';

type DuckState = 'flying_diag' | 'flying_horiz' | 'hit' | 'falling' | 'hidden';

interface Duck {
  x: number;
  y: number;
  vx: number;
  vy: number;
  state: DuckState;
  frame: number;
  flipX: boolean;
  timer: number;
}

export default function DuckHunt() {
  const requestRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);

  const spawnDuck = (): Duck => {
    return {
      x: -100, // Starts off-screen left
      y: 100 + Math.random() * (window.innerHeight - 300),
      vx: 2 + Math.random() * 1.5,
      vy: (Math.random() > 0.5 ? 1 : -1) * (1.5 + Math.random()),
      state: 'flying_diag',
      frame: 0,
      flipX: false,
      timer: 0,
    };
  };

  const duckRef = useRef<Duck>({ ...spawnDuck(), state: 'hidden', timer: 0 });
  const [renderDuck, setRenderDuck] = useState<Duck>(duckRef.current);

  const updateDuck = (deltaTime: number) => {
    let d = { ...duckRef.current };
    d.timer += deltaTime;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const margin = 120; // Allows duck to fly slightly off-screen before bouncing

    if (d.state === 'flying_diag' || d.state === 'flying_horiz') {
      d.x += d.vx * (deltaTime / 10);
      d.y += d.vy * (deltaTime / 10);

      // Bounce horizontal
      if (d.x < -margin) {
        d.x = -margin;
        d.vx = Math.abs(d.vx);
      } else if (d.x > width + margin) {
        d.x = width + margin;
        d.vx = -Math.abs(d.vx);
      }

      // Bounce vertical
      if (d.y < -margin) {
        d.y = -margin;
        d.vy = Math.abs(d.vy);
        if (Math.random() > 0.6) {
          d.state = 'flying_horiz';
          d.vy = 0;
          d.vx = d.vx > 0 ? 3 : -3;
        }
      } else if (d.y > height + margin) {
        d.y = height + margin;
        d.vy = -Math.abs(d.vy) * (0.8 + Math.random() * 0.4);
        d.state = 'flying_diag';
      }

      // Randomly change behavior mid-flight
      if (Math.random() < 0.005) {
        if (d.state === 'flying_diag') {
          d.state = 'flying_horiz';
          d.vy = 0;
        } else {
          d.state = 'flying_diag';
          d.vy = (Math.random() > 0.5 ? 1 : -1) * (1.5 + Math.random());
        }
      }

      // Animation loop
      if (d.timer > 100) {
        d.timer = 0;
        if (d.state === 'flying_diag') {
          d.frame = d.frame >= 2 ? 0 : d.frame + 1;
        } else {
          d.frame = (d.frame >= 5 || d.frame < 3) ? 3 : d.frame + 1;
        }
      }

      d.flipX = d.vx < 0; // Duck sprite faces right initially

    } else if (d.state === 'hit') {
      d.frame = 6;
      if (d.timer > 300) {
        d.state = 'falling';
        d.timer = 0;
        d.vy = 5;
        d.vx = 0;
      }
    } else if (d.state === 'falling') {
      d.y += d.vy * (deltaTime / 10);
      
      if (d.timer > 100) {
        d.timer = 0;
        d.frame = d.frame === 7 ? 8 : 7;
      }

      if (d.y > height + 200) {
        d.state = 'hidden';
        d.timer = 0;
      }
    } else if (d.state === 'hidden') {
      // Spawn occasionally (e.g. wait 3-7 seconds)
      if (d.timer > 3000 + Math.random() * 4000) {
        d = spawnDuck();
      }
    }

    duckRef.current = d;
    setRenderDuck(d);
  };

  const gameLoop = (time: number) => {
    if (lastTimeRef.current !== 0) {
      const deltaTime = time - lastTimeRef.current;
      updateDuck(deltaTime);
    }
    lastTimeRef.current = time;
    requestRef.current = requestAnimationFrame(gameLoop);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  const handleDuckClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (duckRef.current.state === 'flying_diag' || duckRef.current.state === 'flying_horiz') {
      duckRef.current.state = 'hit';
      duckRef.current.timer = 0;
      duckRef.current.frame = 6;
      // Optional: Dispatch a global score event if needed
    }
  };

  const getBackgroundPosition = (frame: number) => {
    const percent = (frame / 8) * 100;
    return `${percent}% 0%`;
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {renderDuck.state !== 'hidden' && (
        <div 
          className="absolute w-24 h-24 pointer-events-auto cursor-crosshair active:scale-90 transition-transform drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)]"
          style={{
            left: renderDuck.x,
            top: renderDuck.y,
            backgroundImage: `url(${duckSpriteSheet})`,
            backgroundSize: "900% 100%",
            backgroundPosition: getBackgroundPosition(renderDuck.frame),
            imageRendering: "pixelated",
            transform: renderDuck.flipX ? "scaleX(-1)" : "scaleX(1)",
          }}
          onPointerDown={handleDuckClick}
        />
      )}
    </div>
  );
}
