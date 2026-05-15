import { useEffect, useRef } from 'react';
import { COSTS, RESOURCES } from '@/game/types';
import type { Resource, ResourceBank } from '@/game/types';
import { RESOURCE_ICON, RESOURCE_LABEL } from '@/ui/shared/ResourceChip';

interface Row {
  icon: string;
  label: string;
  cost: Partial<ResourceBank>;
}

const ROWS: Row[] = [
  { icon: '🛣', label: 'Road', cost: COSTS.road },
  { icon: '🏠', label: 'Settlement', cost: COSTS.settlement },
  { icon: '🏛', label: 'City', cost: COSTS.city },
  { icon: '🃏', label: 'Dev Card', cost: COSTS.devCard },
];

interface Props {
  onClose: () => void;
}

export function CostCheatsheet({ onClose }: Props) {
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

  return (
    <div className="cost-cheatsheet" ref={ref} role="dialog" aria-label="Building costs">
      <div className="cost-cheatsheet-title">Building costs</div>
      <ul className="cost-cheatsheet-list">
        {ROWS.map(({ icon, label, cost }) => (
          <li key={label} className="cost-cheatsheet-row">
            <span className="cost-cheatsheet-build">
              <span aria-hidden>{icon}</span> {label}
            </span>
            <span className="cost-cheatsheet-chips">
              {RESOURCES.filter((r) => (cost[r] ?? 0) > 0).map((r: Resource) => (
                <span key={r} className="cost-cheatsheet-chip" title={RESOURCE_LABEL[r]}>
                  {cost[r]}
                  <span aria-hidden>{RESOURCE_ICON[r]}</span>
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
