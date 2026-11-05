import type { GameState, WagonPlacement } from '@/game/types';
import {
  placementFront,
  placementKey,
  placementTags,
} from '@/game/modules/traders/merchantTrains/trains';
import { Wagon } from './Wagon';

interface Props {
  game: GameState;
  // Spot under the pointer (from the placement overlay).
  hovered?: string | null;
}

// Merchant Trains voting round: every place the wagon could go, as a
// lettered ghost wagon facing the way its train would run. Shown to the
// whole table while bids are made, votes assigned and the wagon placed, so
// "location C" means the same spot on every screen.
export function WagonSpots({ game, hovered }: Props) {
  if (game.phase !== 'wagonVoting' && game.phase !== 'placeWagon') return null;
  const tags = placementTags(game);
  const perEdge = new Map<string, number>();
  for (const t of tags) perEdge.set(t.placement.edge, (perEdge.get(t.placement.edge) ?? 0) + 1);
  return (
    <g className="wagon-spots">
      {tags.map(({ placement, tag }) => (
        <Wagon
          key={placementKey(placement)}
          board={game.board}
          edge={placement.edge}
          front={placementFront(game, placement) ?? undefined}
          ghost
          tag={tag}
          active={hovered === placementKey(placement)}
          at={(perEdge.get(placement.edge) ?? 1) > 1 ? 0.7 : 0.5}
        />
      ))}
    </g>
  );
}

// The letter tag of a placement among the current spots ("?" if gone).
export function tagOf(game: GameState, p: WagonPlacement): string {
  return (
    placementTags(game).find((t) => placementKey(t.placement) === placementKey(p))?.tag ?? '?'
  );
}
