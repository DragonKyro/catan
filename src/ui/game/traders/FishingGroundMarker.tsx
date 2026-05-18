import type { BoardState, FishingGround } from '@/game/types';

interface Props {
  board: BoardState;
  fg: FishingGround;
  // Is the fishing ground's number this turn's rolled token? When true,
  // the marker pulses to mirror the production highlight on hexes.
  pulse?: boolean;
}

// Renders a fishing ground tile anchored to a coastal vertex. A small disc
// sitting just outside the hex with the tile's number printed on it —
// visually distinct from the regular hex tokens (smaller, ringed in a
// blue-grey "frame piece" color) so players can tell it's a coastal
// production source.
export function FishingGroundMarker({ board, fg, pulse }: Props) {
  const v = board.vertices[fg.vertex];
  if (!v) return null;
  const isHot = fg.token === 6 || fg.token === 8;
  return (
    <g
      className={`fishing-ground${pulse ? ' fishing-ground-pulse' : ''}`}
      transform={`translate(${v.position.x}, ${v.position.y})`}
      pointerEvents="none"
    >
      {/* Anchor halo so it visually attaches to the vertex */}
      <circle r={15} fill="#3a6f93" opacity={0.25} />
      <circle r={11} fill="#e3edf2" stroke="#3a6f93" strokeWidth={1.5} />
      <text
        textAnchor="middle"
        dominantBaseline="central"
        y={-1}
        fontSize={11}
        fontWeight={700}
        fill={isHot ? '#c83e3e' : '#1d3a4a'}
      >
        {fg.token}
      </text>
      {/* Tiny fish glyph below the number */}
      <g transform="translate(0, 6)">
        <path
          d="M-3,0 Q-1.5,-1.4 1.6,-0.6 Q2.6,0 1.6,0.6 Q-1.5,1.4 -3,0 Z"
          fill="#3a6f93"
        />
        <path d="M-3,0 L-4,-0.8 L-4,0.8 Z" fill="#3a6f93" />
      </g>
    </g>
  );
}
