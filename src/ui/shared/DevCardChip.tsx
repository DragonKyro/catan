import type { DevCardType } from '@/game/types';
import './DevCardChip.css';

export const DEV_ICON: Record<DevCardType, string> = {
  knight: '⚔️',
  roadBuilding: '🛣️',
  yearOfPlenty: '🎁',
  monopoly: '🏛️',
  victoryPoint: '🏆',
};

export const DEV_LABEL: Record<DevCardType, string> = {
  knight: 'Knight',
  roadBuilding: 'Road Building',
  yearOfPlenty: 'Year of Plenty',
  monopoly: 'Monopoly',
  victoryPoint: 'Victory Point',
};

interface Props {
  card: DevCardType;
  faceDown?: boolean;
  count?: number;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}

export function DevCardChip({ card, faceDown, count, onClick, disabled, title }: Props) {
  const cls = `dchip${faceDown ? ' dchip-back' : ''}${onClick && !disabled ? ' dchip-clickable' : ''}${disabled ? ' dchip-disabled' : ''}`;
  const content = faceDown ? (
    <span className="dchip-icon" aria-hidden>?</span>
  ) : (
    <>
      <span className="dchip-icon" aria-hidden>{DEV_ICON[card]}</span>
      <span className="dchip-label">{DEV_LABEL[card]}</span>
    </>
  );
  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick} disabled={disabled} title={title}>
        {content}
        {count !== undefined && count > 1 && <span className="dchip-count">×{count}</span>}
      </button>
    );
  }
  return (
    <span className={cls} title={title}>
      {content}
      {count !== undefined && count > 1 && <span className="dchip-count">×{count}</span>}
    </span>
  );
}
