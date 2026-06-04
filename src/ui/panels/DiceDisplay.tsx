import { useGameStore } from '@/store/gameStore';
import { CITIES_AND_KNIGHTS_EXPANSION_ID } from '@/game/modules/citiesAndKnights/constants';
import type { EventDieFace } from '@/game/types';
import './DiceDisplay.css';

const PIPS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [[-0.25, -0.25], [0.25, 0.25]],
  3: [[-0.3, -0.3], [0, 0], [0.3, 0.3]],
  4: [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]],
  5: [[-0.3, -0.3], [0.3, -0.3], [0, 0], [-0.3, 0.3], [0.3, 0.3]],
  6: [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0], [0.3, 0], [-0.3, 0.3], [0.3, 0.3]],
};

// Colors for the two production dice. In base Catan the dice are visually
// identical; in Cities & Knights the red die alone determines whether a
// progress card draws this turn, so the two need to be distinguishable.
const DIE_COLORS: Record<'red' | 'yellow', { fill: string; pip: string }> = {
  red:    { fill: '#c0533c', pip: '#fff' },
  yellow: { fill: '#f0c449', pip: '#1a1a1a' },
};

function Die({ value, color }: { value: number; color: 'red' | 'yellow' }) {
  const { fill, pip } = DIE_COLORS[color];
  return (
    <svg
      viewBox="-0.5 -0.5 1 1"
      className={`die die-${color}`}
      width={36}
      height={36}
      aria-label={`${color} die: ${value}`}
    >
      <rect
        x={-0.46}
        y={-0.46}
        width={0.92}
        height={0.92}
        rx={0.12}
        fill={fill}
        stroke="#1a1a1a"
        strokeWidth={0.04}
      />
      {(PIPS[value] ?? []).map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={0.08} fill={pip} />
      ))}
    </svg>
  );
}

const EVENT_FACE_EMOJI: Record<EventDieFace, string> = {
  barbarian: '🚢',
  science: '📚',
  trade: '⚖️',
  politics: '🤝',
};

const EVENT_FACE_LABEL: Record<EventDieFace, string> = {
  barbarian: 'Barbarian ship advances',
  science: 'Science (draw if you have a Science improvement on red die value)',
  trade: 'Trade (draw if you have a Trade improvement on red die value)',
  politics: 'Politics (draw if you have a Politics improvement on red die value)',
};

function EventDie({ face }: { face: EventDieFace }) {
  return (
    <span
      className={`event-die event-die-${face}`}
      title={EVENT_FACE_LABEL[face]}
      aria-label={EVENT_FACE_LABEL[face]}
    >
      <span aria-hidden>{EVENT_FACE_EMOJI[face]}</span>
    </span>
  );
}

export function DiceDisplay() {
  const lastRoll = useGameStore((s) => s.game?.lastRoll);
  const lastEvent = useGameStore((s) => s.game?.lastEventDie);
  const hasCK = useGameStore(
    (s) => s.game?.settings.expansions.includes(CITIES_AND_KNIGHTS_EXPANSION_ID) ?? false,
  );
  if (!lastRoll) return null;
  return (
    <div className="dice">
      <Die value={lastRoll.dice[0]} color="red" />
      <Die value={lastRoll.dice[1]} color="yellow" />
      <span className="dice-total">{lastRoll.total}</span>
      {hasCK && lastEvent && <EventDie face={lastEvent} />}
    </div>
  );
}
