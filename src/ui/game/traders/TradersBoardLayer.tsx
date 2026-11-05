import type { GameState } from '@/game/types';
import { RiverLayer } from './RiverLayer';
import { FishingGroundMarker } from './FishingGroundMarker';

interface Props {
  game: GameState;
  pulseToken?: number | null;
}

// Rivers of Catan / Fishing on Catan board art drawn over the hexes and
// harbors, under every piece: the rivers (with unbridged bridge sites) and
// the fishing-ground frame tiles.
export function TradersBoardLayer({ game, pulseToken }: Props) {
  const board = game.board;
  const bridged = new Set(game.players.flatMap((p) => p.bridges ?? []));
  return (
    <>
      {game.rivers && (
        <RiverLayer
          board={board}
          rivers={game.rivers}
          openSites={(game.riverEdges ?? []).filter((e) => !bridged.has(e))}
        />
      )}
      {game.fishingGrounds && (
        <g className="fishing-grounds">
          {game.fishingGrounds.map((fg) => (
            <FishingGroundMarker
              key={fg.vertices.join('|')}
              board={board}
              fg={fg}
              pulse={pulseToken != null && fg.token === pulseToken}
            />
          ))}
        </g>
      )}
    </>
  );
}
