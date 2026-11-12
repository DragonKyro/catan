// Geometry and the fixed layout of the home screen's hero island. Pure data
// (no React): pointy-top hexes in axial (q, r), like the game board.

import type { PlayerColor } from '@/game/types';

export const SQRT3 = Math.sqrt(3);

export interface Pt {
  x: number;
  y: number;
}

export type HomeTerrain = 'wood' | 'brick' | 'sheep' | 'wheat' | 'ore' | 'desert';

/** Hex circumradius in the scene's user units. */
export const HEX = 34;

export function axialToPixel(q: number, r: number, size = HEX): Pt {
  return { x: size * SQRT3 * (q + r / 2), y: size * 1.5 * r };
}

/** Corner i of a pointy-top hex: 0 = top, then clockwise. */
export function corner(c: Pt, size: number, i: number): Pt {
  const a = (Math.PI / 180) * (-90 + 60 * (((i % 6) + 6) % 6));
  return { x: c.x + size * Math.cos(a), y: c.y + size * Math.sin(a) };
}

export function hexPoints(c: Pt, size: number): string {
  return [0, 1, 2, 3, 4, 5].map((i) => {
    const p = corner(c, size, i);
    return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
  }).join(' ');
}

export interface IslandHex {
  q: number;
  r: number;
  terrain: HomeTerrain;
  number: number | null;
}

// A legal standard island: 4 wood / 4 sheep / 4 wheat / 3 brick / 3 ore /
// desert, the 18 base discs, no 6 or 8 touching. Row order (top to bottom)
// is also the draw order, so each tile's thickness tucks under the row below.
export const ISLAND: readonly IslandHex[] = [
  { q: 0, r: -2, terrain: 'ore', number: 10 },
  { q: 1, r: -2, terrain: 'sheep', number: 2 },
  { q: 2, r: -2, terrain: 'wood', number: 9 },
  { q: -1, r: -1, terrain: 'wheat', number: 12 },
  { q: 0, r: -1, terrain: 'brick', number: 6 },
  { q: 1, r: -1, terrain: 'sheep', number: 4 },
  { q: 2, r: -1, terrain: 'brick', number: 10 },
  { q: -2, r: 0, terrain: 'wheat', number: 9 },
  { q: -1, r: 0, terrain: 'wood', number: 11 },
  { q: 0, r: 0, terrain: 'desert', number: null },
  { q: 1, r: 0, terrain: 'wood', number: 3 },
  { q: 2, r: 0, terrain: 'ore', number: 8 },
  { q: -2, r: 1, terrain: 'wood', number: 8 },
  { q: -1, r: 1, terrain: 'ore', number: 3 },
  { q: 0, r: 1, terrain: 'wheat', number: 4 },
  { q: 1, r: 1, terrain: 'sheep', number: 5 },
  { q: -2, r: 2, terrain: 'brick', number: 5 },
  { q: -1, r: 2, terrain: 'wheat', number: 6 },
  { q: 0, r: 2, terrain: 'sheep', number: 11 },
];

export const DESERT_INDEX = ISLAND.findIndex((h) => h.terrain === 'desert');

export function hexCenter(i: number): Pt {
  const h = ISLAND[i]!;
  return axialToPixel(h.q, h.r);
}

export function indexOf(q: number, r: number): number {
  const i = ISLAND.findIndex((h) => h.q === q && h.r === r);
  if (i < 0) throw new Error(`no island hex at ${q},${r}`);
  return i;
}

/** Seconds after mount at which tile i lands: dealt from the centre outwards. */
export function dealDelay(i: number): number {
  const order = ISLAND.map((h, idx) => {
    const ring = Math.max(Math.abs(h.q), Math.abs(h.r), Math.abs(h.q + h.r));
    const c = axialToPixel(h.q, h.r);
    const angle = (Math.atan2(c.y, c.x) + Math.PI * 2.5) % (Math.PI * 2);
    return { idx, key: ring * 10 + angle };
  }).sort((a, b) => a.key - b.key);
  return 0.35 + order.findIndex((o) => o.idx === i) * 0.055;
}

/** Pips under a number (5 on a 6 / 8, 1 on a 2 / 12). */
export const pips = (n: number) => 6 - Math.abs(7 - n);

export interface Building {
  hex: [number, number];
  corner: number;
  kind: 'settlement' | 'city';
  color: PlayerColor;
}

export interface RoadPiece {
  hex: [number, number];
  from: number; // corner index; the road runs from corner `from` to `from + 1`
  color: PlayerColor;
}

// A game a few turns in, one colour per corner of the island.
export const BUILDINGS: readonly Building[] = [
  { hex: [-1, -1], corner: 2, kind: 'settlement', color: 'red' },
  { hex: [2, -2], corner: 4, kind: 'settlement', color: 'red' },
  { hex: [2, -1], corner: 3, kind: 'city', color: 'blue' },
  { hex: [-2, 1], corner: 2, kind: 'settlement', color: 'white' },
  { hex: [0, 1], corner: 2, kind: 'city', color: 'orange' },
];

export const ROADS: readonly RoadPiece[] = [
  { hex: [-1, -1], from: 1, color: 'red' },
  { hex: [2, -2], from: 3, color: 'red' },
  { hex: [2, -1], from: 3, color: 'blue' },
  { hex: [-2, 1], from: 2, color: 'white' },
  { hex: [0, 1], from: 1, color: 'orange' },
  { hex: [0, 1], from: 0, color: 'orange' },
];

export type HarborKind = 'any' | 'wood' | 'brick' | 'sheep' | 'wheat' | 'ore';

export interface Harbor {
  hex: [number, number];
  from: number; // coastal edge from corner `from` to `from + 1`
  kind: HarborKind;
}

export const HARBORS: readonly Harbor[] = [
  { hex: [0, -2], from: 5, kind: 'any' },
  { hex: [2, -1], from: 1, kind: 'ore' },
  { hex: [1, 1], from: 2, kind: 'sheep' },
  { hex: [-1, 2], from: 3, kind: 'wheat' },
  { hex: [-2, 0], from: 4, kind: 'any' },
];

/** The point of corner `c` of island hex (q, r). */
export function cornerOf(hex: [number, number], c: number, size = HEX): Pt {
  return corner(axialToPixel(hex[0], hex[1]), size, c);
}

/** Every island hex touching the corner `c` of hex (q, r) (1-3 of them). */
export function hexesAtCorner(hex: [number, number], c: number): number[] {
  const p = cornerOf(hex, c);
  const out: number[] = [];
  ISLAND.forEach((h, i) => {
    const center = axialToPixel(h.q, h.r);
    if (Math.hypot(center.x - p.x, center.y - p.y) < HEX + 0.5) out.push(i);
  });
  return out;
}
