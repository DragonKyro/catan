import type { BoardState } from '@/game/types';

interface Props {
  board: BoardState;
  // Pirate Islands: this is the pirate fleet sailing its loop.
  fleet?: boolean;
}

// Pirate token — a dark sail/ship silhouette rendered on a sea hex.
// Distinct from the Robber (hooded figure) so players can tell at a glance
// which threat is which on the board.
export function PirateMarker({ board, fleet }: Props) {
  if (!board.pirateHex) return null;
  const hex = board.hexes[board.pirateHex]!;
  const { x, y } = hex.center;
  return (
    <g className="pirate" transform={`translate(${x}, ${y - 4})`} pointerEvents="none">
      <title>
        {fleet
          ? 'Pirate fleet — sails the loop by the lower die each roll and attacks buildings on its hex'
          : 'Pirate — no ships may be built on or moved to or from the edges of this hex'}
      </title>
      <ellipse cx={0} cy={14} rx={10} ry={3} fill="#00000080" />
      {/* Hull */}
      <path d="M-11,4 L11,4 L8,10 L-8,10 Z" fill="#1a1a1a" stroke="#fefefe" strokeWidth={1} />
      {/* Mast */}
      <line x1={0} y1={4} x2={0} y2={-13} stroke="#1a1a1a" strokeWidth={1.2} />
      {/* Black sail with skull dot */}
      <path d="M0,-13 L9,-2 L0,-2 Z" fill="#1a1a1a" stroke="#fefefe" strokeWidth={0.8} />
      <circle cx={3} cy={-6} r={1.2} fill="#fefefe" />
    </g>
  );
}
