import type { ImprovementTrack, ProgressCardKind } from '@/game/types';
import { PROGRESS_CARD_LABEL } from '@/game/modules/citiesAndKnights/progress/catalogue';
import { TRACK_EMOJI } from '@/game/modules/citiesAndKnights/constants';
import './ProgressCardChip.css';

interface Props {
  card: ProgressCardKind;
  deck: ImprovementTrack;
  count?: number;
  disabled?: boolean;
  onClick?: () => void;
  title?: string;
}

export function ProgressCardChip({
  card,
  deck,
  count,
  disabled,
  onClick,
  title,
}: Props) {
  const label = PROGRESS_CARD_LABEL[card];
  const cls = `pchip pchip-${deck}${disabled ? ' pchip-disabled' : ''}${onClick && !disabled ? ' pchip-clickable' : ''}`;
  return (
    <span
      className={cls}
      title={title ?? label}
      onClick={!disabled && onClick ? onClick : undefined}
      role={onClick ? 'button' : undefined}
    >
      <span className="pchip-icon" aria-hidden>{TRACK_EMOJI[deck]}</span>
      <span className="pchip-label">{label}</span>
      {count !== undefined && count > 1 && (
        <span className="pchip-count">×{count}</span>
      )}
    </span>
  );
}
