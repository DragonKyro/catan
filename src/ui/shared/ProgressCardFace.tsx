import type { ImprovementTrack, ProgressCardKind } from '@/game/types';
import { PROGRESS_CARD_LABEL } from '@/game/modules/citiesAndKnights/progress/catalogue';
import './ProgressCardFace.css';

// The emblem on each progress deck's card back (2025 cards, p.3): science a
// pair of dividers, trade a balance scale, politics a handshake.
export function TrackEmblem({ track, size = '1.2em' }: { track: ImprovementTrack; size?: string }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} aria-hidden focusable="false" style={{ verticalAlign: '-0.2em' }}>
      <g fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        {track === 'science' && (
          <>
            <circle cx={10} cy={4} r={1.6} />
            <path d="M9.2,5.4 L5,17 M10.8,5.4 L15,17 M6.6,12.6 Q10,14 13.4,12.6" />
          </>
        )}
        {track === 'trade' && (
          <>
            <path d="M10,3 L10,16 M6.5,17 L13.5,17 M3.5,6 L16.5,6" />
            <path d="M3.5,6 L1.5,11 Q3.5,13 5.5,11 Z M16.5,6 L14.5,11 Q16.5,13 18.5,11 Z" />
          </>
        )}
        {track === 'politics' && (
          <>
            <path d="M1.5,8 L5,6 L9,8.5 L12,6.5 L18.5,8" />
            <path d="M5,6 L3,12 L7.5,15.5 Q9,16.5 10.5,15.3 L15.5,11.5 L17,12.5 M9,8.5 L13.5,12" />
          </>
        )}
      </g>
    </svg>
  );
}

interface Props {
  card: ProgressCardKind;
  deck: ImprovementTrack;
  // Show a "playable" lift on hover and react to clicks.
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  size?: 'sm' | 'md';
  // A face-up Victory Point card (Printing / Constitution).
  vp?: boolean;
}

// A progress card as a mini playing card in its deck's colour, for the hand
// and the progress-card dialog.
export function ProgressCardFace({ card, deck, onClick, disabled, title, size = 'md', vp }: Props) {
  const clickable = !!onClick && !disabled;
  return (
    <button
      type="button"
      className={`pcard pcard-${deck} pcard-${size}${clickable ? ' pcard-clickable' : ''}${disabled ? ' pcard-disabled' : ''}${vp ? ' pcard-vp' : ''}`}
      onClick={clickable ? onClick : undefined}
      disabled={!onClick || disabled}
      title={title ?? PROGRESS_CARD_LABEL[card]}
    >
      <span className="pcard-emblem">
        <TrackEmblem track={deck} />
      </span>
      <span className="pcard-name">{PROGRESS_CARD_LABEL[card].replace(' (VP)', '')}</span>
      {vp && <span className="pcard-vpbadge">1 VP</span>}
    </button>
  );
}

// Face-down card back (opponents' hands, deck counts).
export function ProgressCardBack({ deck, count }: { deck: ImprovementTrack; count?: number }) {
  return (
    <span className={`pcard pcard-${deck} pcard-back pcard-sm`} title={`${deck} progress cards`}>
      <span className="pcard-emblem">
        <TrackEmblem track={deck} size="1.4em" />
      </span>
      {count !== undefined && <span className="pcard-count">{count}</span>}
    </span>
  );
}
