import type { BarbarianCardType, GameState } from '@/game/types';
import { BARBARIAN_DECK_COUNTS } from '@/game/modules/traders/constants';

// Barbarian Attack's development cards for the dev-card cheat sheet. Every
// card is played face up, so the counts left in the deck are public.
const CARDS: Array<{ type: BarbarianCardType; icon: string; label: string; effect: string }> = [
  { type: 'capture', icon: '⛓', label: 'Capture', effect: 'Take 1 barbarian from a coastal hex as a prisoner.' },
  { type: 'knighthood', icon: '🏰', label: 'Knighthood', effect: 'Place a knight on a free castle edge.' },
  { type: 'swiftKnight', icon: '🐎', label: 'Swift Knight', effect: 'Place a knight on any edge without one.' },
  { type: 'treason', icon: '🗡', label: 'Treason', effect: 'Take 2 gold; move 2 barbarians to other unconquered coastal hexes.' },
];

export function BarbarianCardList({ game }: { game: GameState }) {
  const ba = game.barbarianAttack;
  if (!ba) return null;
  const total = Object.values(BARBARIAN_DECK_COUNTS).reduce((a, b) => a + b, 0);
  return (
    <>
      <div className="cost-cheatsheet-title">
        Dev cards{' '}
        <span className="dev-cheatsheet-deck">
          ({ba.deck.length}/{total} in deck; played at once on purchase)
        </span>
      </div>
      <ul className="cost-cheatsheet-list">
        {CARDS.map(({ type, icon, label, effect }) => {
          const n = ba.deck.filter((c) => c === type).length;
          return (
            <li key={type} className="cost-cheatsheet-row dev-cheatsheet-row">
              <span className="cost-cheatsheet-build dev-cheatsheet-card">
                <span aria-hidden>{icon}</span> {label}
              </span>
              <span className="dev-cheatsheet-count" title={`${n} of ${BARBARIAN_DECK_COUNTS[type]} still in the deck`}>
                {n}/{BARBARIAN_DECK_COUNTS[type]}
              </span>
              <span className="dev-cheatsheet-effect">{effect}</span>
            </li>
          );
        })}
      </ul>
    </>
  );
}
