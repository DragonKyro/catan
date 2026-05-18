import { useState } from 'react';
import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import {
  canPlaceSettlement,
  canPlaceCity,
  canConnectRoad,
  canPlaceInitialSettlement,
  canPlaceInitialRoad,
  canPlaceBridge,
} from '@/game/placement';
import { canBuildShip } from '@/game/modules/seafarers/validation/shipPlacement';
import type { EdgeId, PlayerColor, VertexId } from '@/game/types';
import { playerColorVar } from '@/ui/shared/playerColors';

export function PlacementOverlay() {
  const { game, uiMode, dispatch, setMode } = useGameStore();
  const [hoveredVid, setHoveredVid] = useState<VertexId | null>(null);
  const [hoveredEid, setHoveredEid] = useState<EdgeId | null>(null);
  if (!game) return null;
  const acting = getActingPlayerId(game);
  // AI placements don't need ghost markers — the AI makes its own decision
  // and the human shouldn't see "click here" hints they can't use.
  const actingPlayer = game.players.find((p) => p.id === acting);
  if (actingPlayer?.isAI) return null;
  const previewColor: PlayerColor = actingPlayer?.color ?? 'white';

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
              variant="settlement"
              previewColor={previewColor}
              isHovered={hoveredVid === vid}
              onHoverChange={(h) => setHoveredVid(h ? vid : null)}
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
              previewColor={previewColor}
              isHovered={hoveredVid === vid}
              onHoverChange={(h) => setHoveredVid(h ? vid : null)}
              onClick={() =>
                dispatch({ type: 'buildCity', playerId: acting, vertex: vid })
              }
            />
          );
        })}
      </g>
    );
  }

  if (uiMode.kind === 'buildCityWall') {
    // City wall ghosts: light up only the player's own cities that don't
    // already have a wall.
    const me = game.players.find((p) => p.id === acting);
    const walls = game.cityWalls ?? {};
    return (
      <g className="overlay overlay-vertices">
        {(me?.cities ?? [])
          .filter((vid) => !walls[vid])
          .map((vid) => (
            <VertexGhost
              key={vid}
              vid={vid}
              variant="city"
              previewColor={previewColor}
              isHovered={hoveredVid === vid}
              onHoverChange={(h) => setHoveredVid(h ? vid : null)}
              onClick={() =>
                dispatch({ type: 'buildCityWall', playerId: acting, vertex: vid })
              }
            />
          ))}
      </g>
    );
  }

  if (uiMode.kind === 'recruitKnight') {
    // Empty vertex connected to the actor's road network.
    return (
      <g className="overlay overlay-vertices">
        {game.board.vertexIds
          .filter((vid) => canRecruitKnightAt(game, acting, vid))
          .map((vid) => (
            <VertexGhost
              key={vid}
              vid={vid}
              variant="settlement"
              previewColor={previewColor}
              isHovered={hoveredVid === vid}
              onHoverChange={(h) => setHoveredVid(h ? vid : null)}
              onClick={() =>
                dispatch({
                  type: 'recruitKnight',
                  playerId: acting,
                  vertex: vid,
                })
              }
            />
          ))}
      </g>
    );
  }

  if (uiMode.kind === 'activateKnight' || uiMode.kind === 'promoteKnight') {
    const isActivate = uiMode.kind === 'activateKnight';
    const matches = Object.entries(game.knights ?? {}).filter(([, k]) => {
      if (k.playerId !== acting) return false;
      if (isActivate) return !k.active;
      return k.strength < 3;
    });
    return (
      <g className="overlay overlay-vertices">
        {matches.map(([vid]) => (
          <VertexGhost
            key={vid}
            vid={vid}
            variant="city"
            previewColor={previewColor}
            isHovered={hoveredVid === vid}
            onHoverChange={(h) => setHoveredVid(h ? vid : null)}
            onClick={() =>
              dispatch(
                isActivate
                  ? { type: 'activateKnight', playerId: acting, vertex: vid }
                  : { type: 'promoteKnight', playerId: acting, vertex: vid },
              )
            }
          />
        ))}
      </g>
    );
  }

  if (uiMode.kind === 'chaseRobber') {
    const robberHex = game.board.robberHex;
    const candidates = Object.entries(game.knights ?? {}).filter(([vid, k]) => {
      if (k.playerId !== acting || !k.active) return false;
      const v = game.board.vertices[vid];
      return !!v && v.hexes.includes(robberHex);
    });
    return (
      <g className="overlay overlay-vertices">
        {candidates.map(([vid]) => (
          <VertexGhost
            key={vid}
            vid={vid}
            variant="city"
            previewColor={previewColor}
            isHovered={hoveredVid === vid}
            onHoverChange={(h) => setHoveredVid(h ? vid : null)}
            onClick={() =>
              dispatch({ type: 'chaseRobber', playerId: acting, vertex: vid })
            }
          />
        ))}
      </g>
    );
  }

  if (uiMode.kind === 'moveKnight' || uiMode.kind === 'displaceKnight') {
    const src = uiMode.sourceVertex;
    if (!src) {
      const candidates = Object.entries(game.knights ?? {}).filter(
        ([vid, k]) =>
          k.playerId === acting &&
          k.active &&
          !(game.activatedKnightsThisTurn ?? []).includes(vid),
      );
      return (
        <g className="overlay overlay-vertices">
          {candidates.map(([vid]) => (
            <VertexGhost
              key={vid}
              vid={vid}
              variant="city"
              previewColor={previewColor}
              isHovered={hoveredVid === vid}
              onHoverChange={(h) => setHoveredVid(h ? vid : null)}
              onClick={() => setMode({ ...uiMode, sourceVertex: vid })}
            />
          ))}
        </g>
      );
    }
    return (
      <g className="overlay overlay-vertices">
        {game.board.vertexIds
          .filter((vid) => {
            if (vid === src) return false;
            if (uiMode.kind === 'moveKnight') {
              if (game.knights?.[vid]) return false;
              return vertexConnectedToOwnRoadNetwork(game, acting, vid);
            }
            const k = game.knights?.[vid];
            const srcK = game.knights?.[src];
            if (!k || !srcK) return false;
            if (k.playerId === acting) return false;
            return k.strength < srcK.strength;
          })
          .map((vid) => (
            <VertexGhost
              key={vid}
              vid={vid}
              variant="settlement"
              previewColor={previewColor}
              isHovered={hoveredVid === vid}
              onHoverChange={(h) => setHoveredVid(h ? vid : null)}
              onClick={() => {
                if (uiMode.kind === 'moveKnight') {
                  dispatch({
                    type: 'moveKnight',
                    playerId: acting,
                    from: src,
                    to: vid,
                  });
                } else {
                  dispatch({
                    type: 'displaceKnight',
                    playerId: acting,
                    from: src,
                    to: vid,
                  });
                }
                setMode({ kind: 'idle' });
              }}
            />
          ))}
      </g>
    );
  }

  if (uiMode.kind === 'displacedKnightMove') {
    const ctx = game.pendingKnightMove;
    if (!ctx || ctx.playerId !== acting) return null;
    return (
      <g className="overlay overlay-vertices">
        {game.board.vertexIds
          .filter((vid) => {
            if (vid === ctx.sourceVertex) return false;
            if (game.knights?.[vid]) return false;
            return vertexConnectedToOwnRoadNetwork(game, acting, vid);
          })
          .map((vid) => (
            <VertexGhost
              key={vid}
              vid={vid}
              variant="settlement"
              previewColor={previewColor}
              isHovered={hoveredVid === vid}
              onHoverChange={(h) => setHoveredVid(h ? vid : null)}
              onClick={() =>
                dispatch({
                  type: 'displacedKnightMove',
                  playerId: acting,
                  to: vid,
                })
              }
            />
          ))}
      </g>
    );
  }

  if (uiMode.kind === 'placeMerchant') {
    const player = game.players.find((p) => p.id === acting);
    if (!player) return null;
    const eligible = game.board.hexIds.filter((hid) => {
      const h = game.board.hexes[hid]!;
      if (h.terrain === 'sea' || h.terrain === 'desert' || h.terrain === 'gold') {
        return false;
      }
      for (const v of Object.values(game.board.vertices)) {
        if (!v.hexes.includes(hid)) continue;
        if (player.settlements.includes(v.id) || player.cities.includes(v.id)) {
          return true;
        }
      }
      return false;
    });
    return (
      <g className="overlay overlay-hexes">
        {eligible.map((hid) => {
          const h = game.board.hexes[hid]!;
          return (
            <circle
              key={hid}
              cx={h.center.x}
              cy={h.center.y}
              r={26}
              fill="#000"
              fillOpacity={0.15}
              stroke="#fff"
              strokeOpacity={0.7}
              strokeDasharray="4 3"
              strokeWidth={2}
              style={{ cursor: 'pointer' }}
              onClick={() =>
                dispatch({ type: 'placeMerchant', playerId: acting, hex: hid })
              }
            />
          );
        })}
      </g>
    );
  }

  if (uiMode.kind === 'removeRoad') {
    return (
      <g className="overlay overlay-edges">
        {game.board.edgeIds
          .filter((eid) =>
            game.players.some((p) => p.roads.includes(eid)),
          )
          .map((eid) => (
            <EdgeGhost
              key={eid}
              eid={eid}
              variant="road"
              previewColor={previewColor}
              isHovered={hoveredEid === eid}
              onHoverChange={(h) => setHoveredEid(h ? eid : null)}
              onClick={() =>
                dispatch({ type: 'removeRoad', playerId: acting, edge: eid })
              }
            />
          ))}
      </g>
    );
  }

  if (
    uiMode.kind === 'buildRoad' ||
    uiMode.kind === 'placeSetupRoad' ||
    uiMode.kind === 'roadBuilding'
  ) {
    const isSetup = uiMode.kind === 'placeSetupRoad';
    // For step 2 of road-building, include the buffered first edge in the
    // acting player's road set so canConnectRoad recognises the new chain
    // tip. Mirrors what the engine will see when both edges dispatch.
    const stagedGame =
      uiMode.kind === 'roadBuilding' && uiMode.firstEdge
        ? {
            ...game,
            players: game.players.map((p) =>
              p.id === acting
                ? { ...p, roads: [...p.roads, uiMode.firstEdge!] }
                : p,
            ),
          }
        : game;
    return (
      <g className="overlay overlay-edges">
        {game.board.edgeIds.map((eid) => {
          let ok = false;
          if (isSetup) {
            const placed = game.setupState?.lastPlacedSettlement;
            if (!placed) return null;
            ok = canPlaceInitialRoad(game, placed, eid);
          } else if (uiMode.kind === 'roadBuilding' && uiMode.firstEdge === eid) {
            // The buffered first edge isn't a valid spot for the second road,
            // but we DO want to render it (as a preview) so the user sees
            // what they already picked. Handled below the map.
            ok = false;
          } else {
            ok = canConnectRoad(stagedGame, acting, eid);
          }
          if (!ok) return null;
          return (
            <EdgeGhost
              key={eid}
              eid={eid}
              variant="road"
              previewColor={previewColor}
              isHovered={hoveredEid === eid}
              onHoverChange={(h) => setHoveredEid(h ? eid : null)}
              onClick={() => {
                if (isSetup) {
                  dispatch({ type: 'placeInitialRoad', playerId: acting, edge: eid });
                } else if (uiMode.kind === 'roadBuilding') {
                  // 2-road dev card flow:
                  //   - remaining=2 with no first edge: buffer it, wait for click 2.
                  //   - remaining=1 (already chose one, OR only 1 road left in
                  //     supply): dispatch with [firstEdge?, eid].
                  if (uiMode.remaining === 2 && !uiMode.firstEdge) {
                    setMode({ kind: 'roadBuilding', remaining: 1, firstEdge: eid });
                  } else {
                    const edges: [EdgeId] | [EdgeId, EdgeId] = uiMode.firstEdge
                      ? [uiMode.firstEdge, eid]
                      : [eid];
                    dispatch({
                      type: 'playRoadBuilding',
                      playerId: acting,
                      edges,
                    });
                  }
                } else {
                  dispatch({ type: 'buildRoad', playerId: acting, edge: eid });
                }
              }}
            />
          );
        })}
        {uiMode.kind === 'roadBuilding' && uiMode.firstEdge && (
          <FirstRoadPreview eid={uiMode.firstEdge} color={previewColor} />
        )}
      </g>
    );
  }

  if (uiMode.kind === 'buildShip') {
    return (
      <g className="overlay overlay-edges">
        {game.board.edgeIds.map((eid) => {
          if (!canBuildShip(game, acting, eid)) return null;
          return (
            <EdgeGhost
              key={eid}
              eid={eid}
              variant="ship"
              previewColor={previewColor}
              isHovered={hoveredEid === eid}
              onHoverChange={(h) => setHoveredEid(h ? eid : null)}
              onClick={() =>
                dispatch({ type: 'buildShip', playerId: acting, edge: eid })
              }
            />
          );
        })}
      </g>
    );
  }

  if (uiMode.kind === 'buildBridge') {
    return (
      <g className="overlay overlay-edges">
        {(game.riverEdges ?? []).map((eid) => {
          if (!canPlaceBridge(game, acting, eid)) return null;
          return (
            <EdgeGhost
              key={eid}
              eid={eid}
              variant="bridge"
              previewColor={previewColor}
              isHovered={hoveredEid === eid}
              onHoverChange={(h) => setHoveredEid(h ? eid : null)}
              onClick={() =>
                dispatch({ type: 'buildBridge', playerId: acting, edge: eid })
              }
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
          // Robber goes only on land hexes (skip sea).
          if (game.board.hexes[hid]!.terrain === 'sea') return null;
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

  if (uiMode.kind === 'movePirate') {
    return (
      <g className="overlay overlay-hexes">
        {game.board.hexIds.map((hid) => {
          if (hid === game.board.pirateHex) return null;
          if (game.board.hexes[hid]!.terrain !== 'sea') return null;
          const hex = game.board.hexes[hid]!;
          return (
            <circle
              key={hid}
              cx={hex.center.x}
              cy={hex.center.y}
              r={26}
              fill="#000000"
              fillOpacity={0.2}
              stroke="#fff"
              strokeOpacity={0.85}
              strokeDasharray="4 3"
              strokeWidth={2}
              style={{ cursor: 'pointer' }}
              onClick={() => {
                const candidates = pirateStealCandidates(game, acting, hid);
                if (candidates.length === 0) {
                  dispatch({
                    type: 'movePirate',
                    playerId: acting,
                    hex: hid,
                    stealFrom: null,
                  });
                } else if (candidates.length === 1) {
                  dispatch({
                    type: 'movePirate',
                    playerId: acting,
                    hex: hid,
                    stealFrom: candidates[0]!,
                  });
                } else {
                  // Multiple victims — for v1, just pick the first. A proper
                  // selector dialog can be added later.
                  dispatch({
                    type: 'movePirate',
                    playerId: acting,
                    hex: hid,
                    stealFrom: candidates[0]!,
                  });
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

// Path strings duplicated from Settlement.tsx / City.tsx so the hover preview
// stays in sync without a deeper component refactor.
const SETTLEMENT_PATH_D = 'M-7,5 L-7,-2 L0,-7 L7,-2 L7,5 Z';
const CITY_PATH_D = 'M-10,8 L-10,-4 L-3,-4 L-3,-9 L4,-9 L4,-4 L10,-4 L10,8 Z';

function VertexGhost({
  vid,
  variant,
  previewColor,
  isHovered,
  onHoverChange,
  onClick,
}: {
  vid: VertexId;
  variant: 'settlement' | 'city';
  previewColor: PlayerColor;
  isHovered: boolean;
  onHoverChange: (hovered: boolean) => void;
  onClick: () => void;
}) {
  const game = useGameStore((s) => s.game!);
  const p = game.board.vertices[vid]!.position;
  const r = variant === 'city' ? 13 : 10;
  const path = variant === 'city' ? CITY_PATH_D : SETTLEMENT_PATH_D;
  return (
    <g
      transform={`translate(${p.x}, ${p.y})`}
      onClick={onClick}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      style={{ cursor: 'pointer' }}
      className="ghost"
    >
      <circle r={r + 5} fill="transparent" />
      {isHovered && (
        <path
          d={path}
          fill={playerColorVar(previewColor)}
          fillOpacity={0.5}
          stroke={playerColorVar(previewColor)}
          strokeOpacity={0.85}
          strokeWidth={1.2}
          strokeLinejoin="round"
        />
      )}
      <circle
        r={r}
        fill="#fff"
        fillOpacity={isHovered ? 0 : 0.18}
        stroke="#ffd97e"
        strokeOpacity={0.9}
        strokeWidth={2}
        strokeDasharray="3 3"
      />
    </g>
  );
}

function EdgeGhost({
  eid,
  variant,
  previewColor,
  isHovered,
  onHoverChange,
  onClick,
}: {
  eid: EdgeId;
  variant: 'road' | 'ship' | 'bridge';
  previewColor: PlayerColor;
  isHovered: boolean;
  onHoverChange: (hovered: boolean) => void;
  onClick: () => void;
}) {
  const game = useGameStore((s) => s.game!);
  const e = game.board.edges[eid]!;
  const p1 = game.board.vertices[e.vertices[0]]!.position;
  const p2 = game.board.vertices[e.vertices[1]]!.position;
  // Foreshorten endpoints the same way Road.tsx does so the preview lines up
  // visually with where the actual road will render after build.
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy) || 1;
  const shrink = 6;
  const ux = dx / len;
  const uy = dy / len;
  const x1 = p1.x + ux * shrink;
  const y1 = p1.y + uy * shrink;
  const x2 = p2.x - ux * shrink;
  const y2 = p2.y - uy * shrink;
  return (
    <g
      onClick={onClick}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      style={{ cursor: 'pointer' }}
      className="ghost"
    >
      <line
        x1={p1.x}
        y1={p1.y}
        x2={p2.x}
        y2={p2.y}
        stroke="transparent"
        strokeWidth={20}
      />
      {isHovered && (
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={playerColorVar(previewColor)}
          strokeOpacity={0.55}
          strokeWidth={variant === 'bridge' ? 6 : variant === 'ship' ? 4 : 5}
          strokeLinecap="round"
        />
      )}
      <line
        x1={p1.x}
        y1={p1.y}
        x2={p2.x}
        y2={p2.y}
        stroke="#ffd97e"
        strokeOpacity={isHovered ? 0.4 : 0.9}
        strokeWidth={4}
        strokeDasharray="6 4"
        strokeLinecap="round"
      />
    </g>
  );
}

// First road of a Road Building dev card — rendered in the actor's color
// at full opacity so the user sees their committed first pick while
// choosing the second.
function FirstRoadPreview({ eid, color }: { eid: EdgeId; color: PlayerColor }) {
  const game = useGameStore((s) => s.game!);
  const e = game.board.edges[eid]!;
  const p1 = game.board.vertices[e.vertices[0]]!.position;
  const p2 = game.board.vertices[e.vertices[1]]!.position;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy) || 1;
  const shrink = 6;
  const ux = dx / len;
  const uy = dy / len;
  return (
    <line
      x1={p1.x + ux * shrink}
      y1={p1.y + uy * shrink}
      x2={p2.x - ux * shrink}
      y2={p2.y - uy * shrink}
      stroke={playerColorVar(color)}
      strokeOpacity={0.85}
      strokeWidth={5}
      strokeLinecap="round"
    />
  );
}

// Cities & Knights — helper: is this vertex empty (no building, no knight)
// and connected by at least one edge to one of the player's roads/ships/
// bridges? Used by recruitKnight overlay and by displacement-target picks.
function canRecruitKnightAt(
  game: import('@/game/types').GameState,
  pid: string,
  vid: import('@/game/types').VertexId,
): boolean {
  if (game.knights?.[vid]) return false;
  for (const p of game.players) {
    if (p.settlements.includes(vid) || p.cities.includes(vid)) return false;
  }
  return vertexConnectedToOwnRoadNetwork(game, pid, vid);
}

function vertexConnectedToOwnRoadNetwork(
  game: import('@/game/types').GameState,
  pid: string,
  vid: import('@/game/types').VertexId,
): boolean {
  const v = game.board.vertices[vid];
  if (!v) return false;
  const p = game.players.find((x) => x.id === pid);
  if (!p) return false;
  for (const eid of v.edges) {
    if (p.roads.includes(eid)) return true;
    if (p.ships.includes(eid)) return true;
    if (p.bridges?.includes(eid)) return true;
  }
  return false;
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

// Pirate equivalent: opponents with a ship adjacent to the sea hex who
// still hold at least one resource card.
function pirateStealCandidates(
  game: import('@/game/types').GameState,
  actorId: string,
  hexId: string,
): string[] {
  const out: string[] = [];
  const adjacentEdges = game.board.edgeIds.filter((eid) =>
    game.board.edges[eid]!.hexes.includes(hexId),
  );
  for (const p of game.players) {
    if (p.id === actorId) continue;
    const hasShipHere = adjacentEdges.some((eid) => p.ships.includes(eid));
    if (!hasShipHere) continue;
    const total =
      p.resources.wood +
      p.resources.brick +
      p.resources.sheep +
      p.resources.wheat +
      p.resources.ore;
    if (total > 0) out.push(p.id);
  }
  return out;
}
