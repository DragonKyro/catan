import type { PlayerColor } from '@/game/types';

// Ordered list of every selectable player color. Matches the CSS variables
// in theme.css (`--player-<name>`).
export const PLAYER_COLORS: readonly PlayerColor[] = [
  'red',
  'blue',
  'orange',
  'white',
  'purple',
  'pink',
  'teal',
  'gold',
  'lime',
  'brown',
] as const;

// Concrete hex values — useful for places that need an actual color string
// (e.g., SVG strokes computed in JS, copy/share strings, fallback for browsers
// that don't expand the CSS var into a usable color in an inline style).
export const PLAYER_COLOR_HEX: Record<PlayerColor, string> = {
  red: '#d94545',
  blue: '#3a6ec9',
  orange: '#f37025',
  white: '#f0f0f0',
  purple: '#9b59d4',
  pink: '#e85a9c',
  teal: '#1abc9c',
  gold: '#f5b223',
  lime: '#6dc960',
  brown: '#6e4a2c',
};

export function playerColorVar(c: PlayerColor): string {
  return `var(--player-${c})`;
}

// Human-readable label, used in tooltips and the color-picker.
export const PLAYER_COLOR_LABEL: Record<PlayerColor, string> = {
  red: 'Red',
  blue: 'Blue',
  orange: 'Orange',
  white: 'White',
  purple: 'Purple',
  pink: 'Pink',
  teal: 'Teal',
  gold: 'Gold',
  lime: 'Lime',
  brown: 'Brown',
};
