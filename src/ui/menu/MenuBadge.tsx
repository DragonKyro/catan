// The hex badge for each part of the menu: a tile in a resource colour with a
// small drawing of what it does. The home buttons and the screens they open
// show the same badge.

import type { ReactNode } from 'react';
import { PLAYER_COLOR_HEX } from '@/ui/shared/playerColors';
import { hexPoints } from '@/ui/newGame/home/island';
import { TERRAIN_COLORS } from '@/ui/newGame/home/TerrainArt';

export type MenuBadgeKind = 'local' | 'online' | 'rules' | 'builder' | 'replay';

const SEA = { light: '#62c6ef', base: '#2f8fd0', dark: '#1d68a6', side: '#124577' };

const COLORS: Record<MenuBadgeKind, { light: string; base: string; dark: string; side: string }> = {
  local: TERRAIN_COLORS.wheat,
  online: SEA,
  rules: TERRAIN_COLORS.wood,
  builder: TERRAIN_COLORS.brick,
  replay: TERRAIN_COLORS.ore,
};

const INK = '#2a170a';
const CREAM = '#fff8e6';
const ORIGIN = { x: 0, y: 0 };

const house = (x: number, color: string, s = 1) => (
  <g transform={`translate(${x} 2) scale(${s})`}>
    <path d="M-7,5 L-7,-2 L0,-7 L7,-2 L7,5 Z" fill={color} stroke={INK} strokeWidth={1.3} strokeLinejoin="round" />
    <path d="M-7,5 L-7,-2 L0,-7 L0,5 Z" fill="#fff" opacity={0.22} />
    <rect x={-1.5} y={0.5} width={3} height={4.5} rx={0.6} fill={INK} opacity={0.45} />
  </g>
);

const ICONS: Record<MenuBadgeKind, ReactNode> = {
  local: (
    <g>
      {house(-5.5, PLAYER_COLOR_HEX.red, 0.95)}
      {house(5.5, PLAYER_COLOR_HEX.blue, 0.95)}
    </g>
  ),
  online: (
    <g strokeLinejoin="round">
      <path d="M-11,9 Q-7,6.6 -3,9 T5,9 T13,9" fill="none" stroke={CREAM} strokeWidth={1.4} strokeLinecap="round" opacity={0.8} />
      <path d="M-11,2.5 L11,2.5 L7,7.5 L-7,7.5 Z" fill="#8a5428" stroke={INK} strokeWidth={1.2} />
      <line x1={0} y1={-11} x2={0} y2={2.5} stroke={INK} strokeWidth={1.4} />
      <path d="M1,-10 Q9.5,-4 1,1.5 Z" fill={CREAM} stroke={INK} strokeWidth={1.1} />
      <path d="M-1,-7.5 Q-7.5,-3 -1,1.5 Z" fill={CREAM} stroke={INK} strokeWidth={1.1} />
      <path d="M0,-11 L5,-12.6 L0,-14.2 Z" fill={PLAYER_COLOR_HEX.red} />
    </g>
  ),
  rules: (
    <g strokeLinejoin="round">
      <path
        d="M0,-5.5 C-4,-8.5 -9,-8.5 -12,-6.5 L-12,8 C-9,6 -4,6 0,8.5 C4,6 9,6 12,8 L12,-6.5 C9,-8.5 4,-8.5 0,-5.5 Z"
        fill={CREAM}
        stroke={INK}
        strokeWidth={1.3}
      />
      <line x1={0} y1={-5.5} x2={0} y2={8.5} stroke={INK} strokeWidth={1.1} />
      <g stroke={INK} strokeWidth={0.9} strokeLinecap="round" opacity={0.5}>
        <line x1={-9} y1={-3} x2={-3} y2={-2.2} />
        <line x1={-9} y1={0} x2={-3} y2={0.8} />
        <line x1={-9} y1={3} x2={-4} y2={3.6} />
        <line x1={3} y1={-2.2} x2={9} y2={-3} />
        <line x1={3} y1={0.8} x2={9} y2={0} />
        <line x1={3} y1={3.6} x2={8} y2={3} />
      </g>
    </g>
  ),
  builder: (
    <g stroke={INK} strokeWidth={1.2} strokeLinejoin="round">
      <polygon points={hexPoints({ x: -5.4, y: -3.4 }, 6.6)} fill={TERRAIN_COLORS.wood.light} />
      <polygon points={hexPoints({ x: 5.9, y: -3.4 }, 6.6)} fill={TERRAIN_COLORS.wheat.light} />
      <polygon points={hexPoints({ x: 0.25, y: 6.4 }, 6.6)} fill={CREAM} strokeDasharray="2 1.6" />
      <path d="M7.5,3 L12.5,-2 L14.5,0 L9.5,5 L7,5.5 Z" fill="#ffd25e" strokeWidth={1} />
    </g>
  ),
  replay: (
    <g strokeLinejoin="round">
      <circle r={10.5} fill={CREAM} stroke={INK} strokeWidth={1.3} />
      <path d="M-3.2,-5.6 L6.4,0 L-3.2,5.6 Z" fill="#c9302c" stroke={INK} strokeWidth={1.1} />
    </g>
  ),
};

export function MenuBadge({ kind }: { kind: MenuBadgeKind }) {
  const c = COLORS[kind];
  return (
    <svg viewBox="-23 -23 46 50" aria-hidden>
      <defs>
        <linearGradient id={`home-badge-${kind}`} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor={c.light} />
          <stop offset="0.6" stopColor={c.base} />
          <stop offset="1" stopColor={c.dark} />
        </linearGradient>
      </defs>
      <polygon points={hexPoints({ x: 0, y: 4 }, 21)} fill={c.side} />
      <polygon points={hexPoints(ORIGIN, 21)} fill={`url(#home-badge-${kind})`} stroke={c.dark} strokeWidth={1} />
      <polygon points={hexPoints(ORIGIN, 18)} fill="none" stroke="#fff" strokeOpacity={0.3} strokeWidth={1.3} />
      <g className="home-badge-icon">{ICONS[kind]}</g>
    </svg>
  );
}
