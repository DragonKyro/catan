import type { Resource } from '@/game/types';
import './ResourceChip.css';

export const RESOURCE_ICON: Record<Resource, string> = {
  wood: '🌲',
  brick: '🧱',
  sheep: '🐑',
  wheat: '🌾',
  ore: '🪨',
};

export const RESOURCE_LABEL: Record<Resource, string> = {
  wood: 'Wood',
  brick: 'Brick',
  sheep: 'Sheep',
  wheat: 'Wheat',
  ore: 'Ore',
};

interface Props {
  resource: Resource;
  count?: number;
  size?: 'sm' | 'md' | 'lg';
  dimmed?: boolean;
}

export function ResourceChip({ resource, count, size = 'md', dimmed }: Props) {
  return (
    <span className={`rchip rchip-${resource} rchip-${size}${dimmed ? ' rchip-dim' : ''}`}>
      <span className="rchip-icon" aria-hidden>{RESOURCE_ICON[resource]}</span>
      {count !== undefined && <span className="rchip-count">{count}</span>}
    </span>
  );
}
