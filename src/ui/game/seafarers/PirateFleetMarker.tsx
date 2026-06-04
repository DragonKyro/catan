import type { GameState } from '@/game/types';

interface Props {
  game: GameState;
}

// Pirate Islands fleet marker. Visually distinct from the regular pirate
// (singular hooded sail) — drawn as a dark cluster of ships with the
// remaining strength count. Defeated fleets render as faded wreckage.
export function PirateFleetMarker({ game }: Props) {
  const fleet = game.pirateFleet;
  if (!fleet) return null;
  const hex = game.board.hexes[fleet.hexId];
  if (!hex) return null;
  const { x, y } = hex.center;
  const defeated = fleet.defeatedBy !== null;

  return (
    <g
      className={`pirate-fleet${defeated ? ' is-defeated' : ''}`}
      transform={`translate(${x}, ${y})`}
      opacity={defeated ? 0.4 : 1}
    >
      {/* Cluster: three small ship silhouettes */}
      <ellipse cx={0} cy={14} rx={16} ry={4} fill="#00000080" />
      <g transform="translate(-9, -2)">
        <path d="M-7,4 L7,4 L5,8 L-5,8 Z" fill="#1a1a1a" stroke="#fefefe" strokeWidth={0.8} />
        <line x1={0} y1={4} x2={0} y2={-8} stroke="#1a1a1a" strokeWidth={1} />
        <path d="M0,-8 L6,0 L0,0 Z" fill="#5a1c1c" stroke="#fefefe" strokeWidth={0.6} />
      </g>
      <g transform="translate(9, -2)">
        <path d="M-7,4 L7,4 L5,8 L-5,8 Z" fill="#1a1a1a" stroke="#fefefe" strokeWidth={0.8} />
        <line x1={0} y1={4} x2={0} y2={-8} stroke="#1a1a1a" strokeWidth={1} />
        <path d="M0,-8 L6,0 L0,0 Z" fill="#5a1c1c" stroke="#fefefe" strokeWidth={0.6} />
      </g>
      <g transform="translate(0, -6)">
        <path d="M-8,4 L8,4 L6,8 L-6,8 Z" fill="#1a1a1a" stroke="#fefefe" strokeWidth={0.8} />
        <line x1={0} y1={4} x2={0} y2={-10} stroke="#1a1a1a" strokeWidth={1.2} />
        <path d="M0,-10 L8,-1 L0,-1 Z" fill="#5a1c1c" stroke="#fefefe" strokeWidth={0.6} />
        <circle cx={3} cy={-5} r={1} fill="#fefefe" />
      </g>
      {/* Strength badge */}
      {!defeated && (
        <g transform="translate(14, 10)">
          <circle r={7} fill="#c9302c" stroke="#fefefe" strokeWidth={1} />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={10}
            fontWeight={700}
            fill="#fefefe"
          >
            {fleet.strength}
          </text>
        </g>
      )}
    </g>
  );
}
