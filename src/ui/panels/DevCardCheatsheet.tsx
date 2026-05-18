import { useEffect, useRef } from 'react';
import type { DevCardType, GameState } from '@/game/types';
import { devDeckTotalsFor } from '@/game/createGame';

interface CardInfo {
  type: DevCardType;
  icon: string;
  label: string;
  effect: string;
}

const CARDS: CardInfo[] = [
  {
    type: 'knight',
    icon: '⚔️',
    label: 'Knight',
    effect: 'Move the robber and steal 1 card. Largest army at 3+.',
  },
  {
    type: 'roadBuilding',
    icon: '🛣️',
    label: 'Road Building',
    effect: 'Build 2 roads for free.',
  },
  {
    type: 'yearOfPlenty',
    icon: '🌾',
    label: 'Year of Plenty',
    effect: 'Take any 2 resources from the bank.',
  },
  {
    type: 'monopoly',
    icon: '🃏',
    label: 'Monopoly',
    effect: 'Name a resource; all opponents give you all of theirs.',
  },
  {
    type: 'victoryPoint',
    icon: '🏆',
    label: 'Victory Point',
    effect: 'Worth 1 VP. Revealed automatically on a winning turn.',
  },
];

interface Props {
  game: GameState;
  onClose: () => void;
}

export function DevCardCheatsheet({ game, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // Count what's still in the deck (face-down). This is the public info
  // every player has access to: the deck composition is fixed and the
  // remaining cards are whatever hasn't been bought yet. We deliberately
  // do NOT inspect player hands — the count in any opponent's hand is
  // hidden info (in particular, hidden VP cards would leak otherwise).
  const remaining: Record<DevCardType, number> = {
    knight: 0,
    roadBuilding: 0,
    yearOfPlenty: 0,
    monopoly: 0,
    victoryPoint: 0,
  };
  for (const c of game.devCardDeck) remaining[c]++;
  const totals = devDeckTotalsFor(game.players.length);
  const deckTotal = game.devCardDeck.length;
  const grandTotal = (Object.values(totals) as number[]).reduce((a, b) => a + b, 0);

  return (
    <div className="cost-cheatsheet is-devcards" ref={ref} role="dialog" aria-label="Dev cards">
      <div className="cost-cheatsheet-title">
        Dev cards{' '}
        <span className="dev-cheatsheet-deck">
          ({deckTotal}/{grandTotal} left in deck)
        </span>
      </div>
      <ul className="cost-cheatsheet-list">
        {CARDS.map(({ type, icon, label, effect }) => (
          <li key={type} className="cost-cheatsheet-row dev-cheatsheet-row">
            <span className="cost-cheatsheet-build dev-cheatsheet-card">
              <span aria-hidden>{icon}</span> {label}
            </span>
            <span
              className="dev-cheatsheet-count"
              title={`${remaining[type]} of ${totals[type]} still in the face-down deck`}
            >
              {remaining[type]}/{totals[type]}
            </span>
            <span className="dev-cheatsheet-effect">{effect}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
