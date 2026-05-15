import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import {
  canPlaceSettlement,
  canPlaceCity,
  canConnectRoad,
  canPlaceInitialSettlement,
  canPlaceInitialRoad,
} from '@/game/placement';
import type { EdgeId, VertexId } from '@/game/types';

export function PlacementOverlay() {
  const { game, uiMode, dispatch } = useGameStore();
  if (!game) return null;
  const acting = getActingPlayerId(game);

  if (uiMode.kind === 'buildSettlement' || uiMode.kind === 'placeSetupSettlement') {
    const isSetup = uiMode.kind === 'placeSetupSettlement';
    return (
      <g className="overlay overlay-vertices">
        {game.board.vertexIds.map((vid) => {
          const ok = isSetup
            ? canPlaceInitialSettlement(game, vid)
            : canPlaceSettlement(game, acting, vid);
          if (!ok) return null;
          return (
            <VertexGhost
              key={vid}
              vid={vid}
              onClick={() =>
                dispatch(
                  isSetup
                    ? { type: 'placeInitialSettlement', playerId: acting, vertex: vid }
                    : { type: 'buildSettlement', playerId: acting, vertex: vid },
                )
              }
            />
          );
        })}
      </g>
    );
  }

  if (uiMode.kind === 'buildCity') {
    return (
      <g className="overlay overlay-vertices">
        {game.board.vertexIds.map((vid) => {
          if (!canPlaceCity(game, acting, vid)) return null;
          return (
            <VertexGhost
              key={vid}
              vid={vid}
              variant="city"
              onClick={() =>
                dispatch({ type: 'buildCity', playerId: acting, vertex: vid })
              }
            />
          );
        })}
      </g>
    );
  }

  if (
    uiMode.kind === 'buildRoad' ||
    uiMode.kind === 'placeSetupRoad' ||
    uiMode.kind === 'roadBuilding'
  ) {
    const isSetup = uiMode.kind === 'placeSetupRoad';
    return (
      <g className="overlay overlay-edges">
        {game.board.edgeIds.map((eid) => {
          let ok = false;
          if (isSetup) {
            const placed = game.setupState?.lastPlacedSettlement;
            if (!placed) return null;
            ok = canPlaceInitialRoad(game, placed, eid);
          } else {
            ok = canConnectRoad(game, acting, eid);
          }
          if (!ok) return null;
          return (
            <EdgeGhost
              key={eid}
              eid={eid}
              onClick={() => {
                if (isSetup) {
                  dispatch({ type: 'placeInitialRoad', playerId: acting, edge: eid });
                } else if (uiMode.kind === 'roadBuilding') {
                  // For roadBuilding dev card, we dispatch a single-edge action
                  // (engine accepts 1 or 2). The store will keep mode if more
                  // roads to place; we use a simpler one-shot for now and
                  // upgrade to 2-shot later if needed.
                  dispatch({
                    type: 'playRoadBuilding',
                    playerId: acting,
                    edges: [eid],
                  });
                } else {
                  dispatch({ type: 'buildRoad', playerId: acting, edge: eid });
                }
              }}
            />
          );
        })}
      </g>
    );
  }

  if (uiMode.kind === 'moveRobber') {
    return (
      <g className="overlay overlay-hexes">
        {game.board.hexIds.map((hid) => {
          if (hid === game.board.robberHex) return null;
          const hex = game.board.hexes[hid]!;
          return (
            <circle
              key={hid}
              cx={hex.center.x}
              cy={hex.center.y}
              r={26}
              fill="#000000"
              fillOpacity={0.15}
              stroke="#fff"
              strokeOpacity={0.7}
              strokeDasharray="4 3"
              strokeWidth={2}
              style={{ cursor: 'pointer' }}
              onClick={() => {
                const candidates = stealCandidatesOnHex(game, acting, hid);
                if (candidates.length === 0) {
                  dispatch({
                    type: 'moveRobber',
                    playerId: acting,
                    hex: hid,
                    stealFrom: null,
                  });
                } else if (candidates.length === 1) {
                  dispatch({
                    type: 'moveRobber',
                    playerId: acting,
                    hex: hid,
                    stealFrom: candidates[0]!,
                  });
                } else {
                  useGameStore.getState().setPendingRobberHex(hid);
                }
              }}
            />
          );
        })}
      </g>
    );
  }

  return null;
}

function VertexGhost({
  vid,
  variant = 'settlement',
  onClick,
}: {
  vid: VertexId;
  variant?: 'settlement' | 'city';
  onClick: () => void;
}) {
  const game = useGameStore((s) => s.game!);
  const p = game.board.vertices[vid]!.position;
  const r = variant === 'city' ? 13 : 10;
  return (
    <g
      transform={`translate(${p.x}, ${p.y})`}
      onClick={onClick}
      style={{ cursor: 'pointer' }}
      className="ghost"
    >
      <circle r={r + 5} fill="transparent" />
      <circle
        r={r}
        fill="#fff"
        fillOpacity={0.18}
        stroke="#ffd97e"
        strokeOpacity={0.9}
        strokeWidth={2}
        strokeDasharray="3 3"
      />
    </g>
  );
}

function EdgeGhost({ eid, onClick }: { eid: EdgeId; onClick: () => void }) {
  const game = useGameStore((s) => s.game!);
  const e = game.board.edges[eid]!;
  const p1 = game.board.vertices[e.vertices[0]]!.position;
  const p2 = game.board.vertices[e.vertices[1]]!.position;
  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }} className="ghost">
      <line
        x1={p1.x}
        y1={p1.y}
        x2={p2.x}
        y2={p2.y}
        stroke="transparent"
        strokeWidth={20}
      />
      <line
        x1={p1.x}
        y1={p1.y}
        x2={p2.x}
        y2={p2.y}
        stroke="#ffd97e"
        strokeOpacity={0.9}
        strokeWidth={4}
        strokeDasharray="6 4"
        strokeLinecap="round"
      />
    </g>
  );
}

// Returns IDs of opponent players with a settlement/city on the given hex
// who still have at least one resource card. Mirrors engine logic.
function stealCandidatesOnHex(
  game: import('@/game/types').GameState,
  actorId: string,
  hexId: string,
): string[] {
  const out: string[] = [];
  for (const v of Object.values(game.board.vertices)) {
    if (!v.hexes.includes(hexId)) continue;
    for (const p of game.players) {
      if (p.id === actorId) continue;
      if (p.settlements.includes(v.id) || p.cities.includes(v.id)) {
        const total =
          p.resources.wood +
          p.resources.brick +
          p.resources.sheep +
          p.resources.wheat +
          p.resources.ore;
        if (total > 0 && !out.includes(p.id)) out.push(p.id);
      }
    }
  }
  return out;
}
