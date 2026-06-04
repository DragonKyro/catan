import type { GameState, ImprovementTrack } from '@/game/types';
import { playerColorVar } from '@/ui/shared/playerColors';

interface Props {
  game: GameState;
}

const TRACK_FLAG_COLOR: Record<ImprovementTrack, string> = {
  science: '#4caf6f',
  trade: '#d8a93a',
  politics: '#5a7ad6',
};

// Cities & Knights — small banner above each metropolis city, color-coded by
// track and rimmed with the owner's player color.
export function MetropolisMarker({ game }: Props) {
  const mets = game.metropolises;
  if (!mets) return null;
  const entries: Array<{ track: ImprovementTrack; vertex: string; playerId: string; permanent: boolean }> = [];
  for (const track of ['science', 'trade', 'politics'] as ImprovementTrack[]) {
    const m = mets[track];
    if (m) entries.push({ track, vertex: m.vertex, playerId: m.playerId, permanent: m.permanent });
  }
  if (entries.length === 0) return null;
  return (
    <g className="metropolis-markers">
      {entries.map(({ track, vertex, playerId, permanent }) => {
        const v = game.board.vertices[vertex];
        if (!v) return null;
        const player = game.players.find((p) => p.id === playerId);
        const rim = playerColorVar(player?.color ?? 'white');
        const { x, y } = v.position;
        return (
          <g
            key={track}
            transform={`translate(${x}, ${y - 16})`}
            pointerEvents="none"
          >
            <rect
              x={-8}
              y={-6}
              width={16}
              height={9}
              fill={TRACK_FLAG_COLOR[track]}
              stroke={rim}
              strokeWidth={1.4}
              rx={1.5}
            />
            <text
              x={0}
              y={1.5}
              textAnchor="middle"
              fontSize={6.5}
              fontWeight={700}
              fill="#fff"
              style={{ userSelect: 'none' }}
            >
              {track[0]!.toUpperCase()}
              {permanent ? '★' : ''}
            </text>
          </g>
        );
      })}
    </g>
  );
}
