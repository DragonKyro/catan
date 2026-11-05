import { useEffect, useRef } from 'react';
import type { GameState } from '@/game/types';
import { IMPROVEMENT_TRACKS } from '@/game/types';
import {
  PROGRESS_CARD_DESCRIPTION,
  PROGRESS_CARD_LABEL,
  PROGRESS_DECK_DEFINITIONS,
} from '@/game/modules/citiesAndKnights/progress/catalogue';
import { TRACK_LABEL } from '@/game/modules/citiesAndKnights/constants';
import { TrackEmblem } from '@/ui/shared/ProgressCardFace';

// The 🃏 popover under Cities & Knights: the three progress decks, how many
// cards each still holds, and every card with its count and effect.
export function CKCardCheatsheet({ game, onClose }: { game: GameState; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
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

  return (
    <div className="cost-cheatsheet is-devcards" ref={ref} role="dialog" aria-label="Progress cards">
      <div className="cost-cheatsheet-title">Progress cards (18 per deck)</div>
      {IMPROVEMENT_TRACKS.map((t) => (
        <div key={t}>
          <div className="cost-cheatsheet-title" style={{ marginTop: 6 }}>
            <TrackEmblem track={t} size="1em" /> {TRACK_LABEL[t]}{' '}
            <span className="dev-cheatsheet-deck">({game.progressDecks?.[t].length ?? 0} in the deck)</span>
          </div>
          <ul className="cost-cheatsheet-list">
            {PROGRESS_DECK_DEFINITIONS[t].map(({ kind, n }) => (
              <li key={kind} className="cost-cheatsheet-row dev-cheatsheet-row">
                <span className="cost-cheatsheet-build dev-cheatsheet-card">
                  {PROGRESS_CARD_LABEL[kind].replace(' (VP)', '')}
                </span>
                <span className="dev-cheatsheet-count">×{n}</span>
                <span className="dev-cheatsheet-effect">{PROGRESS_CARD_DESCRIPTION[kind]}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
