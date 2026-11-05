import type { PortType, ScenarioPosition, Terrain } from '../types';

// Seafarers 5-6 maps written row by row, the way docs/map-specs/
// SEAFARERS56-SPEC-A.md transcribes the rulebook pictures. A row is
// [r, first q, cells]: cells run west → east from that q, separated by
// spaces:
//   ~      sea
//   D      desert
//   ?      random land (drawn from the layout's pools)
//   f      a face-down fog hex (a sea placeholder; the fog pool re-pins it)
//   G9     fixed terrain + printed disc: G gold, B hills, F forest,
//          P pasture, W fields, O mountains
export type MapRow = [r: number, firstQ: number, cells: string];

const TERRAIN: Record<string, Terrain> = {
  G: 'gold',
  B: 'brick',
  F: 'wood',
  P: 'sheep',
  W: 'wheat',
  O: 'ore',
};

export interface ParsedRows {
  positions: ScenarioPosition[];
  fog: { q: number; r: number }[];
}

export function parseRows(rows: MapRow[]): ParsedRows {
  const positions: ScenarioPosition[] = [];
  const fog: { q: number; r: number }[] = [];
  for (const [r, firstQ, cells] of rows) {
    cells
      .trim()
      .split(/\s+/)
      .forEach((cell, i) => {
        const q = firstQ + i;
        if (cell === '~') positions.push({ q, r, kind: 'sea' });
        else if (cell === 'D') positions.push({ q, r, kind: 'desert' });
        else if (cell === '?') positions.push({ q, r, kind: 'land' });
        else if (cell === 'f') {
          positions.push({ q, r, kind: 'sea' });
          fog.push({ q, r });
        } else {
          const terrain = TERRAIN[cell[0]!];
          const token = Number(cell.slice(1));
          if (!terrain || !Number.isInteger(token) || token < 2 || token > 12) {
            throw new Error(`Bad map cell "${cell}" at ${q},${r}`);
          }
          positions.push({ q, r, kind: 'land', fixedTerrain: terrain, fixedToken: token });
        }
      });
  }
  return { positions, fog };
}

// The Seafarers 5-6 harbor set: the five CATAN 2:1 harbors, the Seafarers
// 5-6 sheep 2:1 and five 3:1 ("6x 2:1 ports, 5x 3:1 ports").
export function seafarers56PortTypes(): PortType[] {
  return [
    'brick', 'wood', 'sheep', 'sheep', 'wheat', 'ore',
    'generic', 'generic', 'generic', 'generic', 'generic',
  ];
}
