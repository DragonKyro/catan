import { useGameStore } from '@/store/gameStore';
import './DiceDisplay.css';

const PIPS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [[-0.25, -0.25], [0.25, 0.25]],
  3: [[-0.3, -0.3], [0, 0], [0.3, 0.3]],
  4: [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]],
  5: [[-0.3, -0.3], [0.3, -0.3], [0, 0], [-0.3, 0.3], [0.3, 0.3]],
  6: [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0], [0.3, 0], [-0.3, 0.3], [0.3, 0.3]],
};

function Die({ value }: { value: number }) {
  return (
    <svg viewBox="-0.5 -0.5 1 1" className="die" width={36} height={36}>
      <rect x={-0.46} y={-0.46} width={0.92} height={0.92} rx={0.12} fill="#fefefe" stroke="#1a1a1a" strokeWidth={0.04} />
      {(PIPS[value] ?? []).map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={0.08} fill="#1a1a1a" />
      ))}
    </svg>
  );
}

export function DiceDisplay() {
  const lastRoll = useGameStore((s) => s.game?.lastRoll);
  if (!lastRoll) return null;
  return (
    <div className="dice">
      <Die value={lastRoll.dice[0]} />
      <Die value={lastRoll.dice[1]} />
      <span className="dice-total">{lastRoll.total}</span>
    </div>
  );
}
