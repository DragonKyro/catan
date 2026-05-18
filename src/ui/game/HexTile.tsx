import type { BoardState, Hex } from '@/game/types';
import { hexPolygonPoints, probabilityDots } from './boardLayout';
import { HexTexture } from './HexTexture';

interface Props {
  board: BoardState;
  hex: Hex;
  isRobberOnHex: boolean;
  clickable: boolean;
  onClick?: () => void;
  // True when this hex's token matches the most recent dice roll AND the
  // hex isn't currently robbed — used to play a brief production-pulse
  // animation when the dice land.
  pulse?: boolean;
  // Seafarers / Fog Island: hex is currently under fog. We hide the
  // terrain motif and number token, and overlay a fog cloud. The polygon
  // itself stays at the hex's terrain color so the layout doesn't shift.
  foggy?: boolean;
}

const TERRAIN_FILL: Record<string, string> = {
  wood: 'var(--terrain-wood)',
  brick: 'var(--terrain-brick)',
  sheep: 'var(--terrain-sheep)',
  wheat: 'var(--terrain-wheat)',
  ore: 'var(--terrain-ore)',
  desert: 'var(--terrain-desert)',
  sea: 'var(--terrain-sea)',
  gold: 'var(--terrain-gold)',
  swamp: 'var(--terrain-swamp, #59733e)',
  // Lake = inland water. Slightly darker than the ocean fill so it reads
  // as a distinct body of water and doesn't disappear into the sea ring.
  lake: 'var(--terrain-lake, #2a5d7c)',
  // Watering hole = dusty oasis. Sandy beige with a tinted center.
  wateringHole: 'var(--terrain-wateringHole, #b89870)',
};

export function HexTile({ board, hex, isRobberOnHex, clickable, onClick, pulse, foggy }: Props) {
  const points = hexPolygonPoints(board, hex.id);
  const isHot = hex.numberToken === 6 || hex.numberToken === 8;
  const pips = probabilityDots(hex.numberToken);

  if (foggy) {
    return (
      <g
        className={`hex hex-fog${clickable ? ' hex-clickable' : ''}`}
        onClick={clickable ? onClick : undefined}
      >
        <polygon
          points={points}
          fill="#7a8696"
          stroke="#1a1a1a40"
          strokeWidth={1.5}
        />
        {/* Cloud silhouette — three overlapping puffs centred on the hex.
            The "?" mark hints that the terrain is unknown until revealed. */}
        <g transform={`translate(${hex.center.x}, ${hex.center.y})`} opacity={0.85}>
          <circle cx={-12} cy={2} r={10} fill="#e8edf2" />
          <circle cx={0} cy={-4} r={12} fill="#e8edf2" />
          <circle cx={12} cy={2} r={10} fill="#e8edf2" />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            y={1}
            fontSize={18}
            fontWeight={700}
            fill="#3d4a5a"
          >
            ?
          </text>
        </g>
      </g>
    );
  }

  return (
    <g
      className={`hex hex-${hex.terrain}${clickable ? ' hex-clickable' : ''}${pulse ? ' hex-pulse' : ''}`}
      onClick={clickable ? onClick : undefined}
    >
      <polygon
        points={points}
        fill={TERRAIN_FILL[hex.terrain]}
        stroke="#1a1a1a40"
        strokeWidth={1.5}
      />
      <HexTexture hex={hex} />
      {hex.numberToken !== null && !isRobberOnHex && (
        <g transform={`translate(${hex.center.x}, ${hex.center.y})`}>
          <circle r={17} fill="var(--token-fill)" stroke="var(--token-edge)" strokeWidth={1.5} />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            y={-3}
            fontSize={16}
            fontWeight={700}
            fill={isHot ? 'var(--token-hot)' : '#1a1a1a'}
          >
            {hex.numberToken}
          </text>
          <g transform={`translate(0, 9)`}>
            {Array.from({ length: pips }).map((_, i) => (
              <circle
                key={i}
                cx={(i - (pips - 1) / 2) * 3.2}
                cy={0}
                r={1.1}
                fill={isHot ? 'var(--token-hot)' : '#1a1a1a'}
              />
            ))}
          </g>
        </g>
      )}
    </g>
  );
}
