import type { Hex } from '@/game/types';
import { hexPolygonPoints, probabilityDots } from './boardLayout';
import { useGameStore } from '@/store/gameStore';
import { HexTexture } from './HexTexture';

interface Props {
  hex: Hex;
  isRobberOnHex: boolean;
  clickable: boolean;
  onClick?: () => void;
}

const TERRAIN_FILL: Record<string, string> = {
  wood: 'var(--terrain-wood)',
  brick: 'var(--terrain-brick)',
  sheep: 'var(--terrain-sheep)',
  wheat: 'var(--terrain-wheat)',
  ore: 'var(--terrain-ore)',
  desert: 'var(--terrain-desert)',
};

export function HexTile({ hex, isRobberOnHex, clickable, onClick }: Props) {
  const game = useGameStore((s) => s.game!);
  const points = hexPolygonPoints(game.board, hex.id);
  const isHot = hex.numberToken === 6 || hex.numberToken === 8;
  const pips = probabilityDots(hex.numberToken);

  return (
    <g
      className={`hex hex-${hex.terrain}${clickable ? ' hex-clickable' : ''}`}
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
