import { useEffect, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useLogStore } from '@/store/logStore';
import './GameClock.css';

// Live wall-clock since the game started. Anchored over the board (above
// the dice display) so a quick glance shows how long this session has
// been running — handy mid-game and matches what GameOver reports at the
// end. Freezes once the game ends so the final time stays visible without
// drifting upward forever.
export function GameClock() {
  const startTime = useLogStore((s) => s.startTime);
  const lastActionT = useLogStore((s) => s.lastActionT);
  const isGameOver = useGameStore(
    (s) => s.game?.phase === 'gameOver' || !!s.game?.winner,
  );
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    // No live tick once the game is over — freeze at the winning action's
    // timestamp. Reuses lastActionT so the displayed time matches what
    // GameOverDialog reports.
    if (isGameOver) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [isGameOver]);

  const endT = isGameOver ? lastActionT : now;
  const elapsed = Math.max(0, endT - startTime);
  return (
    <div
      className={`game-clock${isGameOver ? ' is-paused' : ''}`}
      title={isGameOver ? 'Final game time' : 'Time since game start'}
      aria-label={isGameOver ? 'Final game time' : 'Game time elapsed'}
    >
      ⏱ {formatElapsed(elapsed)}
    </div>
  );
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}
