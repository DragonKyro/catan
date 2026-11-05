import type { GameState } from '@/game/types';
import { playerColorVar } from '@/ui/shared/playerColors';

interface Props {
  game: GameState;
}

// Cities & Knights city walls (p.8): a crenellated wall slab in the owner's
// colour placed UNDER the city. Rendered before the cities layer so the city
// sits on top of it; wider than the city so it shows on both sides.
export function CityWallMarker({ game }: Props) {
  const walls = game.cityWalls;
  if (!walls) return null;
  const entries = Object.entries(walls);
  if (entries.length === 0) return null;
  return (
    <g className="city-walls" pointerEvents="none">
      {entries.map(([vid, playerId]) => {
        const v = game.board.vertices[vid];
        const player = game.players.find((p) => p.id === playerId);
        if (!v || !player) return null;
        const { x, y } = v.position;
        return (
          <g key={vid} transform={`translate(${x}, ${y})`}>
            <title>{`${player.name}'s city wall (+2 cards on a 7)`}</title>
            <CityWallGlyph color={playerColorVar(player.color)} />
          </g>
        );
      })}
    </g>
  );
}

// The wall drawing, centred under a city at (0, 0).
export function CityWallGlyph({ color }: { color: string }) {
  // Battlements along the top edge, then a solid band.
  const top =
    'M-15,4 L-15,1 L-12,1 L-12,3 L-9,3 L-9,1 L-6,1 L-6,3 L6,3 L6,1 L9,1 L9,3 L12,3 L12,1 L15,1 L15,4';
  return (
    <g>
      <path
        d={`${top} L15,11 L-15,11 Z`}
        fill={color}
        stroke="#151515"
        strokeWidth={1.1}
        strokeLinejoin="round"
      />
      {/* Masonry joints. */}
      <path
        d="M-15,7.5 L15,7.5 M-10,4 L-10,7.5 M-4,4 L-4,7.5 M4,4 L4,7.5 M10,4 L10,7.5 M-7,7.5 L-7,11 M0,7.5 L0,11 M7,7.5 L7,11"
        stroke="#00000066"
        strokeWidth={0.8}
      />
    </g>
  );
}
