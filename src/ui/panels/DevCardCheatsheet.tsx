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

  // Per-type counts shown here must NOT leak hidden info. Inspecting
  // game.devCardDeck directly would reveal which cards are still in the
  // deck vs. bought-and-held face-down — in particular, "5/6 VP left"
  // would tell every player exactly how many hidden VP cards their
  // opponents are sitting on. Instead we display the upper bound on cards
  // still hidden (in deck + in any face-down hand) using only public
  // information: starting totals minus what's been publicly revealed.
  // Currently the only revealed dev-card type is knights (via Largest
  // Army tracking); everyone else stays at their starting total.
  const totals = devDeckTotalsFor(game.players.length);
  const totalKnightsPlayed = game.players.reduce(
    (sum, p) => sum + p.devCards.playedKnights,
    0,
  );
  const facedown: Record<DevCardType, number> = {
    knight: Math.max(0, totals.knight - totalKnightsPlayed),
    roadBuilding: totals.roadBuilding,
    yearOfPlenty: totals.yearOfPlenty,
    monopoly: totals.monopoly,
    victoryPoint: totals.victoryPoint,
  };
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
              title={
                type === 'knight'
                  ? `${facedown.knight} of ${totals.knight} not yet played (deck + hands)`
                  : `${facedown[type]} of ${totals[type]} still face-down (deck + hands)`
              }
            >
              {facedown[type]}/{totals[type]}
            </span>
            <span className="dev-cheatsheet-effect">{effect}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
