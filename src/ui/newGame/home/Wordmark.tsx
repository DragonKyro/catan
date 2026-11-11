// The home screen's title: one letter on each of the five resource tiles,
// laid like a strip of the board. The tiles drop in one by one and ripple
// when hovered (HomeMenu.css).

import type { CSSProperties } from 'react';
import { SQRT3, hexPoints, type HomeTerrain } from './island';
import { TERRAIN_COLORS } from './TerrainArt';

const LETTERS: { ch: string; terrain: HomeTerrain; rot: number; dy: number }[] = [
  { ch: 'C', terrain: 'wood', rot: -5, dy: 2 },
  { ch: 'A', terrain: 'wheat', rot: 3, dy: -2 },
  { ch: 'T', terrain: 'brick', rot: -2, dy: 1 },
  { ch: 'A', terrain: 'sheep', rot: 4, dy: -3 },
  { ch: 'N', terrain: 'ore', rot: -3, dy: 1 },
];

const R = 31;
const W = SQRT3 * R;
const PAD = 8;
const VB_W = PAD * 2 + W * LETTERS.length;
const VB_H = R * 2 + 20;
const ORIGIN = { x: 0, y: 0 };

export function Wordmark() {
  return (
    <svg className="home-wordmark" viewBox={`0 0 ${VB_W.toFixed(1)} ${VB_H}`} role="img" aria-label="Catan">
      <defs>
        {LETTERS.map(({ terrain }) => (
          <linearGradient key={terrain} id={`home-wm-${terrain}`} x1="0.15" y1="0" x2="0.85" y2="1">
            <stop offset="0" stopColor={TERRAIN_COLORS[terrain].light} />
            <stop offset="0.6" stopColor={TERRAIN_COLORS[terrain].base} />
            <stop offset="1" stopColor={TERRAIN_COLORS[terrain].dark} />
          </linearGradient>
        ))}
        <linearGradient id="home-wm-letter" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fffef7" />
          <stop offset="0.55" stopColor="#fff2cc" />
          <stop offset="1" stopColor="#f1d494" />
        </linearGradient>
      </defs>
      {LETTERS.map((l, i) => {
        const col = TERRAIN_COLORS[l.terrain];
        return (
          <g key={i} transform={`translate(${(PAD + W / 2 + i * W).toFixed(2)} ${R + 6 + l.dy}) rotate(${l.rot})`}>
            <g className="home-wm-drop" style={{ '--d': `${0.08 + i * 0.09}s` } as CSSProperties}>
              <g className="home-wm-bounce" style={{ '--b': `${i * 0.06}s` } as CSSProperties}>
                <polygon points={hexPoints({ x: 0, y: 5 }, R - 1)} fill={col.side} />
                <polygon points={hexPoints(ORIGIN, R - 1)} fill={`url(#home-wm-${l.terrain})`} stroke={col.dark} strokeWidth={1} />
                <polygon points={hexPoints(ORIGIN, R - 4)} fill="none" stroke="#fff" strokeOpacity={0.28} strokeWidth={1.6} />
                <text y={15} textAnchor="middle" className="home-wm-letter">
                  {l.ch}
                </text>
              </g>
            </g>
          </g>
        );
      })}
    </svg>
  );
}
