import type { EventCard } from '@/game/types';
import { EVENT_CARD_INFO } from '@/game/modules/traders/variants/eventCards/deck';
import './EventCardDisplay.css';

interface Props {
  card: EventCard | null;
  // Cards left before the deck is rebuilt (New Year included).
  left: number;
  newYear?: boolean;
}

// Catan Event Cards: the flipped card, shown where the dice would be — its
// event (icon + name, the rule text on hover) and its number disc, which is
// this turn's production number. Red disc on a 6 or 8, like the tokens.
export function EventCardDisplay({ card, left, newYear }: Props) {
  if (!card) {
    return (
      <div className="evcard evcard-empty" title="Catan Event Cards: flip a card instead of rolling the dice">
        <span className="evcard-icon" aria-hidden>📜</span>
        <span className="evcard-name">Event deck</span>
        <span className="evcard-left">{left} cards</span>
      </div>
    );
  }
  const info = EVENT_CARD_INFO[card.kind];
  const hot = card.number === 6 || card.number === 8;
  return (
    <div className="evcard" title={`${info.name}: ${info.text}`}>
      <span className="evcard-icon" aria-hidden>{info.icon}</span>
      <span className="evcard-body">
        <span className="evcard-name">{info.name}</span>
        <span className="evcard-left">
          {newYear ? 'New Year — deck rebuilt · ' : ''}
          {left} left
        </span>
      </span>
      {card.number !== null && (
        <span className={`evcard-disc${hot ? ' is-hot' : ''}${card.number === 7 ? ' is-seven' : ''}`}>
          {card.number}
        </span>
      )}
    </div>
  );
}
