import type { ReactNode } from 'react';
import './TradeLane.css';

// One side of a trade, told from the reader's seat: what leaves their hand
// (arrow out of the tray, give colour) or what comes into it (arrow into the
// tray, get colour). Shared by the trade window and the offer banner.
export function TradeLane({
  side,
  label,
  cards,
  empty,
}: {
  side: 'give' | 'get';
  label: string;
  cards: ReactNode[];
  empty?: string;
}) {
  return (
    <div className={`tlane tlane-${side}`}>
      <span className="tlane-head">
        <TradeArrow side={side} />
        <span>{label}</span>
      </span>
      <span className="tlane-cards">
        {cards.length > 0 ? cards : <span className="tlane-empty">{empty}</span>}
      </span>
    </div>
  );
}

export function TradeArrow({ side }: { side: 'give' | 'get' }) {
  return (
    <svg className="tlane-arrow" viewBox="0 0 20 20" width="18" height="18" aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12v5h14v-5" />
        {side === 'give' ? <path d="M10 13V2.5M6 6.5l4-4 4 4" /> : <path d="M10 2.5V13M6 9l4 4 4-4" />}
      </g>
    </svg>
  );
}
