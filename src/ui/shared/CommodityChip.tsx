import type { Commodity } from '@/game/types';
import { COMMODITY_EMOJI, COMMODITY_LABEL } from '@/game/modules/citiesAndKnights/constants';
import './CommodityChip.css';

export { COMMODITY_EMOJI, COMMODITY_LABEL };

interface Props {
  commodity: Commodity;
  count?: number;
  size?: 'sm' | 'md' | 'lg';
  dimmed?: boolean;
}

export function CommodityChip({ commodity, count, size = 'md', dimmed }: Props) {
  return (
    <span
      className={`cchip cchip-${commodity} cchip-${size}${dimmed ? ' cchip-dim' : ''}`}
      title={COMMODITY_LABEL[commodity]}
    >
      <span className="cchip-icon" aria-hidden>
        {COMMODITY_EMOJI[commodity]}
      </span>
      {count !== undefined && <span className="cchip-count">{count}</span>}
    </span>
  );
}
