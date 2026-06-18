import { useCallback, useRef, useState } from 'react';
import { Button } from '@/ui/shared/Button';
import { parseCustomMap } from '@/game/customMap/parse';
import { serializeCustomMap } from '@/game/customMap/serialize';
import type { Terrain } from '@/game/types';
import type { ScenarioLayout } from '@/game/board/scenarioTypes';
import { useBuilderState } from './useBuilderState';
import { MapCanvas } from './MapCanvas';
import { Toolbar } from './Toolbar';
import { MetaPanel } from './MetaPanel';
import { PoolTunerPanel } from './PoolTunerPanel';
import { FogPoolTunerPanel } from './FogPoolTunerPanel';
import './MapBuilder.css';

interface Props {
  onBack?: () => void;
}

export function MapBuilderScreen({ onBack }: Props) {
  const builder = useBuilderState();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const onPaintHex = useCallback(
    (q: number, r: number) => {
      const t = builder.tool;
      if (t.kind === 'erase') {
        builder.setPosition(q, r, () => null);
      } else if (t.kind === 'paint') {
        builder.setPosition(q, r, () => ({ q, r, kind: t.terrain }));
      } else if (t.kind === 'paintTerrain') {
        builder.setPosition(q, r, (prev) => ({
          ...(prev ?? { q, r }),
          q,
          r,
          kind: 'land',
          fixedTerrain: t.terrain as Terrain,
        }));
      } else if (t.kind === 'token') {
        builder.setPosition(q, r, (prev) => {
          if (!prev) return null; // can't pin token on an unpainted cell
          if (t.value == null) {
            const { fixedToken: _, ...rest } = prev;
            return rest;
          }
          return { ...prev, fixedToken: t.value };
        });
      }
    },
    [builder],
  );

  const onPaintEdge = useCallback(
    (q: number, r: number, dir: 0 | 1 | 2 | 3 | 4 | 5) => {
      const t = builder.tool;
      if (t.kind === 'erase') {
        builder.togglePort(q, r, dir, 'generic');
      } else if (t.kind === 'port') {
        builder.togglePort(q, r, dir, t.type);
      }
    },
    [builder],
  );

  const onPaintFog = useCallback(
    (q: number, r: number) => {
      // Only meaningful on Seafarers maps; the UI hides the tool otherwise.
      if (!builder.map.seafarers) return;
      builder.toggleFog(q, r);
    },
    [builder],
  );

  const onExport = () => {
    const text = serializeCustomMap(builder.map);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${builder.map.id || 'custom-map'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onLoadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLoadError(null);
    file
      .text()
      .then((text) => {
        const parsed = parseCustomMap(text);
        builder.replaceMap(parsed);
      })
      .catch((err: Error) => {
        setLoadError(err.message);
      });
  };

  const onAutofill = () => {
    builder.updatePools(() => autofillPools(builder.map.layout, builder.derived));
  };

  return (
    <div className="map-builder">
      <header className="map-builder-header">
        <h2>Map builder</h2>
        <div className="map-builder-actions">
          <Button size="sm" onClick={() => fileInputRef.current?.click()}>
            📂 Load
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={onLoadFile}
          />
          <Button size="sm" variant="primary" onClick={onExport}>
            💾 Export
          </Button>
          {onBack && (
            <Button size="sm" variant="ghost" onClick={onBack}>
              ← Back
            </Button>
          )}
        </div>
      </header>
      {loadError && (
        <div className="map-builder-load-error" role="alert">
          {loadError}
        </div>
      )}
      <div className="map-builder-body">
        <div className="map-builder-canvas-wrap">
          <MapCanvas
            map={builder.map}
            tool={builder.tool}
            radius={builder.radius}
            onPaintHex={onPaintHex}
            onPaintEdge={onPaintEdge}
            onPaintFog={onPaintFog}
          />
        </div>
        <aside className="map-builder-side">
          <MetaPanel
            map={builder.map}
            onUpdate={builder.updateMeta}
            radius={builder.radius}
            onRadiusChange={builder.setRadius}
            derived={builder.derived}
          />
          <PoolTunerPanel
            pools={builder.map.layout.pools}
            onPoolsChange={builder.updatePools}
            derived={builder.derived}
            seafarers={builder.map.seafarers}
            onAutofill={onAutofill}
          />
          {builder.map.seafarers && (
            <FogPoolTunerPanel
              pools={builder.map.fogPools}
              onPoolsChange={builder.updateFogPools}
              derived={builder.derived}
            />
          )}
        </aside>
      </div>
      <Toolbar
        tool={builder.tool}
        setTool={builder.setTool}
        seafarers={builder.map.seafarers}
        onClearAll={builder.clearMap}
      />
    </div>
  );
}

// Distribute the standard rulebook ratios across the painted frame. Greedy:
// give each terrain its share rounded down, then distribute the remainder
// to the resource buckets. Tokens follow the standard symmetric-around-7
// distribution scaled to the slot count.
function autofillPools(
  layout: ScenarioLayout,
  derived: {
    poolDrawnTerrain: number;
    tokenSlots: number;
    portCount: number;
  },
): ScenarioLayout['pools'] {
  const terrains: Array<['wood' | 'brick' | 'sheep' | 'wheat' | 'ore', number]> = [
    ['wood', 4],
    ['brick', 3],
    ['sheep', 4],
    ['wheat', 4],
    ['ore', 3],
  ];
  const terrainWeight = 18; // 4+3+4+4+3
  const out: Partial<Record<Terrain, number>> = {};
  let used = 0;
  for (const [t, w] of terrains) {
    const share = Math.floor((derived.poolDrawnTerrain * w) / terrainWeight);
    if (share > 0) out[t] = share;
    used += share;
  }
  // Push the remainder onto wheat (city resource).
  if (used < derived.poolDrawnTerrain) {
    out.wheat = (out.wheat ?? 0) + (derived.poolDrawnTerrain - used);
  }

  // Token distribution — symmetric around 7. Repeat the base pattern
  // 3,4,5,6,8,9,10,11 (each twice, plus one of 2 and 12) and crop to size.
  const tokenSeed = [6, 8, 5, 9, 4, 10, 3, 11, 6, 8, 5, 9, 4, 10, 3, 11, 2, 12];
  const tokens: number[] = [];
  for (let i = 0; tokens.length < derived.tokenSlots; i = (i + 1) % tokenSeed.length) {
    tokens.push(tokenSeed[i]!);
  }
  tokens.sort((a, b) => a - b);

  // Ports — keep existing types if balanced; otherwise fill with generics.
  let portTypes = [...layout.pools.portTypes];
  if (portTypes.length > derived.portCount) {
    portTypes = portTypes.slice(0, derived.portCount);
  } else {
    while (portTypes.length < derived.portCount) portTypes.push('generic');
  }

  return { terrainCounts: out, tokens, portTypes };
}
