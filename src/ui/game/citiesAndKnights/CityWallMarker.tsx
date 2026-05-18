import type { GameState } from '@/game/types';
import { playerColorVar } from '@/ui/shared/playerColors';

interface Props {
  game: GameState;
}

// Cities & Knights — renders a thin bracket beneath each walled city,
// painted in the wall owner's color. Drawn after the cities layer so the
// brick wall sits visually under the city silhouette.
export function CityWallMarker({ game }: Props) {
  const walls = game.cityWalls;
  if (!walls) return null;
  const entries = Object.entries(walls);
  if (entries.length === 0) return null;
  return (
    <g className="city-walls">
      {entries.map(([vid, playerId]) => {
        const v = game.board.vertices[vid];
        if (!v) return null;
        const player = game.players.find((p) => p.id === playerId);
        if (!player) return null;
        const { x, y } = v.position;
        const color = playerColorVar(player.color);
        return (
          <g key={vid} transform={`translate(${x}, ${y})`}>
            {/* Bracket wall: a curved arc just beneath the city footprint. */}
            <path
              d="M-13,9 L-13,12 L13,12 L13,9"
              fill="none"
              stroke={color}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Inner highlight for visibility on dark hexes. */}
            <path
              d="M-13,9 L-13,12 L13,12 L13,9"
              fill="none"
              stroke="rgba(0,0,0,0.45)"
              strokeWidth={1.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        );
      })}
    </g>
  );
}
