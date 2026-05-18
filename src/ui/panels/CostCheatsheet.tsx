import { useEffect, useRef } from 'react';
import { COSTS, RESOURCES } from '@/game/types';
import type { Resource, ResourceBank } from '@/game/types';
import { useGameStore } from '@/store/gameStore';
import { SEAFARERS_EXPANSION_ID, SHIP_COST } from '@/game/modules/seafarers/constants';
import { CITIES_AND_KNIGHTS_EXPANSION_ID } from '@/game/modules/citiesAndKnights/constants';
import { TRADERS_EXPANSION_ID } from '@/game/modules/traders/constants';
import { RESOURCE_ICON, RESOURCE_LABEL } from '@/ui/shared/ResourceChip';

interface Row {
  icon: string;
  label: string;
  cost: Partial<ResourceBank>;
}

const BASE_ROWS: Row[] = [
  { icon: '🛣', label: 'Road', cost: COSTS.road },
  { icon: '🏠', label: 'Settlement', cost: COSTS.settlement },
  { icon: '🏛', label: 'City', cost: COSTS.city },
  { icon: '🃏', label: 'Dev Card', cost: COSTS.devCard },
];

const SHIP_ROW: Row = { icon: '⛵', label: 'Ship', cost: SHIP_COST };
const CITY_WALL_ROW: Row = { icon: '🧱', label: 'City Wall', cost: COSTS.cityWall };
const BRIDGE_ROW: Row = { icon: '🌉', label: 'Bridge', cost: COSTS.bridge };

interface Props {
  onClose: () => void;
}

export function CostCheatsheet({ onClose }: Props) {
  const hasSeafarers = useGameStore((s) =>
    s.game?.settings.expansions.includes(SEAFARERS_EXPANSION_ID) ?? false,
  );
  const hasCK = useGameStore((s) =>
    s.game?.settings.expansions.includes(CITIES_AND_KNIGHTS_EXPANSION_ID) ?? false,
  );
  const hasTraders = useGameStore((s) =>
    s.game?.settings.expansions.includes(TRADERS_EXPANSION_ID) ?? false,
  );
  let rows: Row[] = BASE_ROWS;
  if (hasSeafarers) {
    rows = [BASE_ROWS[0]!, SHIP_ROW, ...BASE_ROWS.slice(1)];
  }
  if (hasTraders) {
    // Bridge slots in just after Road — both span an edge, both cost wood + brick.
    rows = [BASE_ROWS[0]!, BRIDGE_ROW, ...BASE_ROWS.slice(1)];
  }
  if (hasCK) {
    // Cities & Knights replaces dev cards with progress cards (drawn on the
    // event die — no resource cost). Strip the dev card row and add city
    // wall after city.
    rows = BASE_ROWS.filter((r) => r.label !== 'Dev Card');
    const cityIdx = rows.findIndex((r) => r.label === 'City');
    rows = [
      ...rows.slice(0, cityIdx + 1),
      CITY_WALL_ROW,
      ...rows.slice(cityIdx + 1),
    ];
  }
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
        {rows.map(({ icon, label, cost }) => (
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
