import { useGameStore } from '@/store/gameStore';
import { CITIES_AND_KNIGHTS_EXPANSION_ID } from '@/game/modules/citiesAndKnights/constants';
import type { EventDieFace } from '@/game/types';
import { EventCardDisplay } from './EventCardDisplay';
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

const EVENT_FACE_LABEL: Record<EventDieFace, string> = {
  barbarian: 'Event die: barbarian ship — it moves one space toward Catan',
  science: 'Event die: science — players whose science level covers the red die draw a science card',
  trade: 'Event die: trade — players whose trade level covers the red die draw a trade card',
  politics: 'Event die: politics — players whose politics level covers the red die draw a politics card',
};

const EVENT_FACE_COLOR: Record<Exclude<EventDieFace, 'barbarian'>, string> = {
  science: '#2f7d3a',
  trade: '#6f9a2a',
  politics: '#4f6ea8',
};

// The Cities & Knights event die (p.6): white, with a black barbarian ship on
// three faces and the science / trade / politics city gate icons on the rest.
function EventDie({ face }: { face: EventDieFace }) {
  return (
    <svg
      viewBox="-0.5 -0.5 1 1"
      className={`event-die event-die-${face}`}
      width={36}
      height={36}
      role="img"
      aria-label={EVENT_FACE_LABEL[face]}
    >
      <title>{EVENT_FACE_LABEL[face]}</title>
      <rect x={-0.46} y={-0.46} width={0.92} height={0.92} rx={0.12} fill="#f4f1ea" stroke="#1a1a1a" strokeWidth={0.04} />
      {face === 'barbarian' ? (
        <g fill="#1d1d1d">
          <path d="M-0.32,0.08 L0.32,0.08 L0.22,0.24 L-0.22,0.24 Z" />
          <path d="M-0.02,-0.3 L-0.02,0.06 L-0.26,0.06 Z" />
          <path d="M0.02,-0.26 L0.02,0.06 L0.24,0.06 Z" />
        </g>
      ) : (
        <g fill={EVENT_FACE_COLOR[face]} stroke="#1a1a1a" strokeWidth={0.02}>
          {/* City gate: two towers with an arch. */}
          <path d="M-0.28,0.28 L-0.28,-0.2 L-0.32,-0.2 L-0.32,-0.3 L-0.12,-0.3 L-0.12,-0.2 L-0.15,-0.2 L-0.15,0.0 Q0,-0.12 0.15,0.0 L0.15,-0.2 L0.12,-0.2 L0.12,-0.3 L0.32,-0.3 L0.32,-0.2 L0.28,-0.2 L0.28,0.28 L0.12,0.28 L0.12,0.12 Q0,0.02 -0.12,0.12 L-0.12,0.28 Z" />
        </g>
      )}
    </svg>
  );
}

export function DiceDisplay() {
  const lastRoll = useGameStore((s) => s.game?.lastRoll);
  const lastEvent = useGameStore((s) => s.game?.lastEventDie);
  const hasCK = useGameStore(
    (s) => s.game?.settings.expansions.includes(CITIES_AND_KNIGHTS_EXPANSION_ID) ?? false,
  );
  // T&B Catan Event Cards: the flipped card replaces the dice.
  const eventCards = useGameStore((s) => s.game?.eventCards);
  if (eventCards) {
    return (
      <EventCardDisplay
        card={eventCards.current}
        left={eventCards.deck.length}
        newYear={eventCards.newYear}
      />
    );
  }
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
