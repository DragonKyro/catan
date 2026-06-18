import { useCallback, useMemo, useState } from 'react';
import type { Terrain, PortType } from '@/game/types';
import type {
  ScenarioLayout,
  ScenarioPosition,
} from '@/game/board/scenarioTypes';
import { emptyCustomMap } from '@/game/customMap/sample';
import type { CustomMap } from '@/game/customMap/types';
import { neighbourAxial } from '@/game/customMap/parse';
import { hexagonalDisk } from '@/game/modules/base/scenarios/helpers';

// Toolbar selection. Discriminates the painting brush:
//   - 'erase'   → remove the hex / port at the click target
//   - 'sea'/'desert' → set the position kind (sea / desert)
//   - 'land'    → plain land (no fixed terrain — terrain comes from pool)
//   - resource (wood/.../gold) → land with `fixedTerrain` pinned
//   - token     → set `fixedToken` on the clicked hex
//   - port:<type> → place a port anchor of the given type
//   - fog       → toggle a fog hex (Seafarers only)
export type Tool =
  | { kind: 'erase' }
  | { kind: 'paint'; terrain: 'sea' | 'desert' | 'land' }
  | { kind: 'paintTerrain'; terrain: Terrain }
  | { kind: 'token'; value: number | null }
  | { kind: 'port'; type: PortType }
  | { kind: 'fog' };

export const DEFAULT_TOOL: Tool = { kind: 'paint', terrain: 'land' };

// Internal layout we edit. Identical shape to ScenarioLayout but we maintain
// it directly so React renders track changes.
function cloneLayout(layout: ScenarioLayout): ScenarioLayout {
  return {
    positions: layout.positions.map((p) => ({ ...p })),
    portAnchors: layout.portAnchors.map((a) => ({ ...a })),
    pools: {
      terrainCounts: { ...layout.pools.terrainCounts },
      tokens: [...layout.pools.tokens],
      portTypes: [...layout.pools.portTypes],
    },
    ...(layout.tokenConstraints
      ? { tokenConstraints: { ...layout.tokenConstraints } }
      : {}),
    ...(layout.robberStart ? { robberStart: { ...layout.robberStart } } : {}),
    ...(layout.pirateStart ? { pirateStart: { ...layout.pirateStart } } : {}),
  };
}

export function useBuilderState(initial?: CustomMap) {
  const [map, setMap] = useState<CustomMap>(() => initial ?? emptyCustomMap(3));
  const [tool, setTool] = useState<Tool>(DEFAULT_TOOL);
  const [radius, setRadiusInternal] = useState<number>(3);

  // Changing the disk radius reshapes the painted frame to fit:
  //   - Drops any position whose (q,r) is now outside the disk.
  //   - Drops port anchors / fog hexes attached to dropped positions.
  //   - Fills the remaining empty disk cells with `kind: 'sea'` so the
  //     user doesn't have to paint sea over every newly-visible cell.
  const setRadius = useCallback((next: number) => {
    setRadiusInternal(next);
    setMap((prev) => {
      const inDisk = (q: number, r: number) =>
        Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= next;

      const keptPositions = prev.layout.positions.filter((p) => inDisk(p.q, p.r));
      const occupied = new Set(keptPositions.map((p) => `${p.q},${p.r}`));
      const additions: ScenarioPosition[] = [];
      for (const c of hexagonalDisk(next)) {
        if (!occupied.has(`${c.q},${c.r}`)) {
          additions.push({ q: c.q, r: c.r, kind: 'sea' });
        }
      }

      const keptAnchorIndices: number[] = [];
      const keptAnchors = prev.layout.portAnchors.filter((a, i) => {
        if (!inDisk(a.q, a.r)) return false;
        keptAnchorIndices.push(i);
        return true;
      });
      const keptPortTypes = keptAnchorIndices.map(
        (i) => prev.layout.pools.portTypes[i]!,
      );
      const keptFog = prev.fogHexes.filter((f) => inDisk(f.q, f.r));

      return {
        ...prev,
        fogHexes: keptFog,
        layout: {
          ...prev.layout,
          positions: [...keptPositions, ...additions],
          portAnchors: keptAnchors,
          pools: { ...prev.layout.pools, portTypes: keptPortTypes },
        },
      };
    });
  }, []);

  const layout = map.layout;

  // Apply a position mutation by replacing or inserting at (q, r).
  const setPosition = useCallback(
    (q: number, r: number, mutator: (p: ScenarioPosition | undefined) => ScenarioPosition | null) => {
      setMap((prev) => {
        const next = cloneLayout(prev.layout);
        const idx = next.positions.findIndex((p) => p.q === q && p.r === r);
        const current = idx >= 0 ? next.positions[idx] : undefined;
        const result = mutator(current);
        if (result == null) {
          if (idx >= 0) next.positions.splice(idx, 1);
        } else if (idx >= 0) {
          next.positions[idx] = result;
        } else {
          next.positions.push(result);
        }
        return { ...prev, layout: next };
      });
    },
    [],
  );

  // Toggle a port anchor at (q, r, direction). Removes the matching anchor
  // if one exists; otherwise adds and appends a port type to the pool.
  const togglePort = useCallback(
    (q: number, r: number, direction: 0 | 1 | 2 | 3 | 4 | 5, type: PortType) => {
      setMap((prev) => {
        const next = cloneLayout(prev.layout);
        const idx = next.portAnchors.findIndex(
          (a) => a.q === q && a.r === r && a.direction === direction,
        );
        if (idx >= 0) {
          next.portAnchors.splice(idx, 1);
          next.pools.portTypes.splice(idx, 1);
        } else {
          next.portAnchors.push({ q, r, direction });
          next.pools.portTypes.push(type);
        }
        return { ...prev, layout: next };
      });
    },
    [],
  );

  // Toggle a fog hex.
  const toggleFog = useCallback((q: number, r: number) => {
    setMap((prev) => {
      const idx = prev.fogHexes.findIndex((f) => f.q === q && f.r === r);
      const nextFog = idx >= 0
        ? [...prev.fogHexes.slice(0, idx), ...prev.fogHexes.slice(idx + 1)]
        : [...prev.fogHexes, { q, r }];
      return { ...prev, fogHexes: nextFog };
    });
  }, []);

  // Replace whole map state (used by File→Load and meta edits).
  const replaceMap = useCallback((next: CustomMap) => setMap(next), []);

  // Reset the painted frame to all-sea at the current radius, keep meta.
  const clearMap = useCallback(() => {
    setMap((prev) => {
      const fresh = emptyCustomMap(radius);
      return {
        ...fresh,
        id: prev.id,
        name: prev.name,
        description: prev.description,
        minPlayers: prev.minPlayers,
        maxPlayers: prev.maxPlayers,
        defaultVpToWin: prev.defaultVpToWin,
        seafarers: prev.seafarers,
      };
    });
  }, [radius]);

  const updateMeta = useCallback(
    (
      patch: Partial<Pick<CustomMap, 'name' | 'description' | 'id' | 'minPlayers' | 'maxPlayers' | 'defaultVpToWin' | 'seafarers'>>,
    ) => {
      setMap((prev) => ({ ...prev, ...patch }));
    },
    [],
  );

  const updatePools = useCallback(
    (mutator: (pools: ScenarioLayout['pools']) => ScenarioLayout['pools']) => {
      setMap((prev) => ({
        ...prev,
        layout: { ...prev.layout, pools: mutator(prev.layout.pools) },
      }));
    },
    [],
  );

  const updateFogPools = useCallback(
    (
      mutator: (
        pools: import('@/game/customMap/types').FogPools,
      ) => import('@/game/customMap/types').FogPools,
    ) => {
      setMap((prev) => ({
        ...prev,
        fogPools: mutator(prev.fogPools ?? { terrainCounts: {}, tokens: [] }),
      }));
    },
    [],
  );

  // Derived counts surfaced in the side panel. Fog cells are excluded
  // from the main pool counts — they come from `fogPools` instead.
  const derived = useMemo(() => {
    const fogKeys = new Set(map.fogHexes.map((f) => `${f.q},${f.r}`));
    const isFog = (p: { q: number; r: number }) => fogKeys.has(`${p.q},${p.r}`);
    const landAll = layout.positions.filter((p) => p.kind === 'land');
    const poolDrawnTerrain = landAll.filter(
      (p) => !p.fixedTerrain && !isFog(p),
    ).length;
    const nonProducingPoolDraws =
      (layout.pools.terrainCounts.desert ?? 0) +
      (layout.pools.terrainCounts.swamp ?? 0) +
      (layout.pools.terrainCounts.wateringHole ?? 0) +
      (layout.pools.terrainCounts.castle ?? 0);
    const tokenSlots = Math.max(
      0,
      layout.positions.filter((p) => {
        if (isFog(p)) return false;
        if (p.fixedToken != null) return false;
        if (p.kind === 'sea') return false;
        if (p.kind === 'desert' && !p.forceToken) return false;
        const t = p.fixedTerrain;
        if (t === 'desert' || t === 'swamp' || t === 'wateringHole' || t === 'castle') {
          return false;
        }
        return true;
      }).length - nonProducingPoolDraws,
    );

    // Fog pool stats (Seafarers only).
    const fogCount = map.fogHexes.length;
    const fogTerrainTotal = Object.values(map.fogPools?.terrainCounts ?? {}).reduce(
      (a, b) => a + (b ?? 0),
      0,
    );
    const fogNonProducing =
      (map.fogPools?.terrainCounts.sea ?? 0) +
      (map.fogPools?.terrainCounts.desert ?? 0) +
      (map.fogPools?.terrainCounts.swamp ?? 0);
    const fogTokenTotal = map.fogPools?.tokens.length ?? 0;
    const fogTokenSlots = Math.max(0, fogCount - fogNonProducing);
    const terrainPoolTotal = Object.values(layout.pools.terrainCounts).reduce(
      (a, b) => a + (b ?? 0),
      0,
    );
    return {
      landCount: landAll.length,
      seaCount: layout.positions.filter((p) => p.kind === 'sea').length,
      desertCount: layout.positions.filter((p) => p.kind === 'desert').length,
      portCount: layout.portAnchors.length,
      poolDrawnTerrain,
      terrainPoolTotal,
      tokenSlots,
      tokenPoolTotal: layout.pools.tokens.length,
      portPoolTotal: layout.pools.portTypes.length,
      fogCount,
      fogTerrainTotal,
      fogTokenTotal,
      fogTokenSlots,
    };
  }, [layout, map.fogHexes, map.fogPools]);

  return {
    map,
    tool,
    radius,
    setTool,
    setRadius,
    setPosition,
    togglePort,
    toggleFog,
    replaceMap,
    clearMap,
    updateMeta,
    updatePools,
    updateFogPools,
    derived,
    // Helper exposed for the canvas — given (q, r, direction), what's the
    // neighbour axial coord? The canvas uses this to highlight whether a
    // would-be port faces sea / land / off-board.
    neighbourAxial,
  };
}
