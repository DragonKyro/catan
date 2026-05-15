import type { Resource, ResourceBank } from '@/game/types';
import { RESOURCES } from '@/game/types';
import { ResourceChip } from './ResourceChip';
import './ResourcePicker.css';

interface Props {
  values: Partial<ResourceBank>;
  // Per-resource ceiling. If `available` is provided for a resource, the
  // picker won't allow that value to exceed it.
  available?: Partial<ResourceBank>;
  onChange: (values: Partial<ResourceBank>) => void;
}

export function ResourcePicker({ values, available, onChange }: Props) {
  const change = (r: Resource, delta: number) => {
    const cur = values[r] ?? 0;
    const next = Math.max(0, cur + delta);
    const cap = available?.[r];
    if (cap !== undefined && next > cap) return;
    onChange({ ...values, [r]: next });
  };
  return (
    <div className="rpicker">
      {RESOURCES.map((r) => {
        const cur = values[r] ?? 0;
        const cap = available?.[r];
        const atCap = cap !== undefined && cur >= cap;
        return (
          <div key={r} className="rpicker-row">
            <ResourceChip resource={r} />
            <button
              type="button"
              className="rpicker-btn"
              onClick={() => change(r, -1)}
              disabled={cur === 0}
              aria-label={`Decrease ${r}`}
            >
              −
            </button>
            <span className="rpicker-value">{cur}</span>
            <button
              type="button"
              className="rpicker-btn"
              onClick={() => change(r, 1)}
              disabled={atCap}
              aria-label={`Increase ${r}`}
            >
              +
            </button>
            {cap !== undefined && <span className="rpicker-cap">/ {cap}</span>}
          </div>
        );
      })}
    </div>
  );
}
