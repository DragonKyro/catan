import { useState } from 'react';
import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import { useNetworkStore, getMyPlayerId } from '@/store/networkStore';
import {
  canPlaceSettlement,
  canPlaceCity,
  canConnectRoad,
  canPlaceInitialSettlement,
  canPlaceInitialRoad,
  canPlaceBridge,
} from '@/game/placement';
import { robberHexAllowed, robberStealCandidates } from '@/game/engine';
import {
  canBuildShip,
  canPlaceInitialShip,
  isShipMovable,
  shipMoveDestinations,
} from '@/game/modules/seafarers/validation/shipPlacement';
import { pirateIslandsShipViolation } from '@/game/modules/seafarers/pirateIslands';
import {
  canMovePirateTo,
  pirateStealCandidates,
} from '@/game/modules/seafarers/actions/movePirate';
import { validTribePortEdges } from '@/game/modules/seafarers/tribe';
import { totalResources } from '@/game/resources';
import {
  placementFront,
  placementKey,
  placementTags,
} from '@/game/modules/traders/merchantTrains/trains';
import { Wagon } from './traders/Wagon';
import { BarbarianAttackOverlay, isBarbarianAttackMode } from './traders/BarbarianAttackOverlay';
import type { EdgeId, GameState, PlayerColor, PlayerId, VertexId } from '@/game/types';
import { playerColorVar } from '@/ui/shared/playerColors';
import { citiesKnightsOverlay } from './citiesAndKnights/CKPlacementOverlay';
import { setupPlacesCity } from '@/game/modules/citiesAndKnights/actions/buildWrappers';

export function PlacementOverlay() {
  const { game, uiMode, dispatch, setMode } = useGameStore();
  const role = useNetworkStore((s) => s.role);
  const [hoveredVid, setHoveredVid] = useState<VertexId | null>(null);
  const [hoveredEid, setHoveredEid] = useState<EdgeId | null>(null);
  if (!game) return null;
  const acting = getActingPlayerId(game);
  // AI placements don't need ghost markers — the AI makes its own decision
  // and the human shouldn't see "click here" hints they can't use.
  const actingPlayer = game.players.find((p) => p.id === acting);
  if (actingPlayer?.isAI) return null;
  // Online: only the peer whose UUID owns the acting seat may interact with
  // the board. Without this gate, modes driven by `game.phase` (setup, robber,
  // discard, etc.) silently render clickable ghosts on every peer, so any
  // peer could dispatch the acting player's action and diverge the boards.
  // Main-phase build modes are already gated implicitly because non-acting
  // peers can't open them (the ActionBar hides build buttons for them).
  if (role !== 'solo') {
    const myPid = getMyPlayerId(game);
    if (myPid !== acting) return null;
  }
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
              variant={isSetup && setupPlacesCity(game) ? 'city' : 'settlement'}
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

  // Cities & Knights modes (knights, walls, metropolis, progress cards…).
  const ck = citiesKnightsOverlay({
    game,
    uiMode,
    acting,
    previewColor,
    hoveredVid,
    setHoveredVid,
    hoveredEid,
    setHoveredEid,
    dispatch,
    setMode,
  });
  if (ck !== undefined) return ck;

  if (
    uiMode.kind === 'buildRoad' ||
    uiMode.kind === 'placeSetupRoad' ||
    uiMode.kind === 'roadBuilding'
  ) {
    const isSetup = uiMode.kind === 'placeSetupRoad';
    const seafarers = game.settings.expansions.includes('seafarers');
    // Road Building, second piece: stage the first one so the legality
    // checks see the new chain tip (same order the engine applies them:
    // roads, then ships).
    const first = uiMode.kind === 'roadBuilding' ? uiMode.first : undefined;
    const staged: GameState = first
      ? {
          ...game,
          players: game.players.map((p) =>
            p.id === acting
              ? first.ship
                ? { ...p, ships: [...p.ships, first.edge] }
                : { ...p, roads: [...p.roads, first.edge] }
              : p,
          ),
        }
      : game;
    const placed = game.setupState?.lastPlacedSettlement ?? null;
    const shipOk = (eid: EdgeId): boolean => {
      if (!seafarers) return false;
      if (isSetup) {
        return (
          !!placed &&
          canPlaceInitialShip(game, placed, eid) &&
          !pirateIslandsShipViolation(game, acting, eid)
        );
      }
      if (uiMode.kind !== 'roadBuilding') return false;
      // A road placed first would be applied before a ship anyway; a ship
      // placed first must stay a ship-then-ship pair (the engine places
      // roads before ships), so a second road can't depend on it.
      return canBuildShip(staged, acting, eid) && !pirateIslandsShipViolation(staged, acting, eid);
    };
    const roadOk = (eid: EdgeId): boolean => {
      if (isSetup) return !!placed && canPlaceInitialRoad(game, placed, eid);
      if (first?.ship) return canConnectRoad(game, acting, eid);
      return canConnectRoad(staged, acting, eid);
    };
    const finishRoadBuilding = (piece: { edge: EdgeId; ship: boolean }) => {
      const pieces = first ? [first, piece] : [piece];
      dispatch({
        type: 'playRoadBuilding',
        playerId: acting,
        edges: pieces.filter((x) => !x.ship).map((x) => x.edge),
        ships: pieces.filter((x) => x.ship).map((x) => x.edge),
      });
    };
    const place = (eid: EdgeId, ship: boolean) => {
      if (isSetup) {
        dispatch(
          ship
            ? { type: 'placeInitialShip', playerId: acting, edge: eid }
            : { type: 'placeInitialRoad', playerId: acting, edge: eid },
        );
      } else if (uiMode.kind === 'roadBuilding') {
        if (uiMode.remaining === 2 && !first) {
          setMode({ kind: 'roadBuilding', remaining: 1, first: { edge: eid, ship } });
        } else {
          finishRoadBuilding({ edge: eid, ship });
        }
      } else {
        dispatch({ type: 'buildRoad', playerId: acting, edge: eid });
      }
    };
    return (
      <g className="overlay overlay-edges">
        {game.board.edgeIds.map((eid) => {
          if (first?.edge === eid) return null;
          const asRoad = roadOk(eid);
          const asShip = !asRoad && shipOk(eid);
          if (!asRoad && !asShip) return null;
          return (
            <EdgeGhost
              key={eid}
              eid={eid}
              variant={asShip ? 'ship' : 'road'}
              previewColor={previewColor}
              isHovered={hoveredEid === eid}
              onHoverChange={(h) => setHoveredEid(h ? eid : null)}
              onClick={() => place(eid, asShip)}
            />
          );
        })}
        {/* Coastal edges where both fit: a road is the default; the ship
            ghost sits on the sea side so either can be picked. */}
        {(isSetup || uiMode.kind === 'roadBuilding') &&
          game.board.edgeIds
            .filter((eid) => first?.edge !== eid && roadOk(eid) && shipOk(eid))
            .map((eid) => (
              <ShipChoiceGhost
                key={`ship-${eid}`}
                eid={eid}
                game={game}
                previewColor={previewColor}
                onClick={() => place(eid, true)}
              />
            ))}
        {first && <FirstRoadPreview eid={first.edge} color={previewColor} ship={first.ship} />}
      </g>
    );
  }

  if (uiMode.kind === 'buildShip') {
    return (
      <g className="overlay overlay-edges">
        {game.board.edgeIds.map((eid) => {
          if (!canBuildShip(game, acting, eid)) return null;
          if (pirateIslandsShipViolation(game, acting, eid)) return null;
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

  if (uiMode.kind === 'moveShip') {
    const from = uiMode.from;
    if (!from) {
      // Step 1: which ship? Only ships that can actually go somewhere.
      return (
        <g className="overlay overlay-edges">
          {movableShips(game, acting).map((eid) => (
            <EdgeGhost
              key={eid}
              eid={eid}
              variant="ship"
              previewColor={previewColor}
              isHovered={hoveredEid === eid}
              onHoverChange={(h) => setHoveredEid(h ? eid : null)}
              onClick={() => setMode({ kind: 'moveShip', from: eid })}
            />
          ))}
        </g>
      );
    }
    // Step 2: where to? The lifted ship is drawn faded.
    return (
      <g className="overlay overlay-edges">
        <FirstRoadPreview eid={from} color={previewColor} ship faded />
        {moveTargets(game, acting, from).map((eid) => (
          <EdgeGhost
            key={eid}
            eid={eid}
            variant="ship"
            previewColor={previewColor}
            isHovered={hoveredEid === eid}
            onHoverChange={(h) => setHoveredEid(h ? eid : null)}
            onClick={() => {
              dispatch({ type: 'moveShip', playerId: acting, from, to: eid });
              setMode({ kind: 'idle' });
            }}
          />
        ))}
      </g>
    );
  }

  if (uiMode.kind === 'placeTribePort') {
    if (game.pendingTribePort?.playerId !== acting) return null;
    return (
      <g className="overlay overlay-edges">
        {validTribePortEdges(game, acting).map((eid) => (
          <EdgeGhost
            key={eid}
            eid={eid}
            variant="road"
            previewColor={previewColor}
            isHovered={hoveredEid === eid}
            onHoverChange={(h) => setHoveredEid(h ? eid : null)}
            onClick={() => dispatch({ type: 'placeTribePort', playerId: acting, edge: eid })}
          />
        ))}
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

  // Fishing on Catan: a free road paid with fish (5). Same edges as a road.
  if (uiMode.kind === 'fishRoad') {
    const tokens = uiMode.tokens;
    return (
      <g className="overlay overlay-edges">
        {game.board.edgeIds.map((eid) => {
          if (!canConnectRoad(game, acting, eid)) return null;
          return (
            <EdgeGhost
              key={eid}
              eid={eid}
              variant="road"
              previewColor={previewColor}
              isHovered={hoveredEid === eid}
              onHoverChange={(h) => setHoveredEid(h ? eid : null)}
              onClick={() =>
                dispatch({
                  type: 'spendFish',
                  playerId: acting,
                  tokens,
                  effect: { kind: 'buildRoad', edge: eid },
                })
              }
            />
          );
        })}
      </g>
    );
  }

  // T&B Merchant Trains: the chosen player places the wagon, or (no
  // majority) a bidder gives their votes to a spot. The lettered spots are
  // drawn for everyone by BoardSVG (WagonSpots); these are the click
  // targets for the seat whose turn it is.
  const wagonPick =
    (game.phase === 'placeWagon' && game.pendingWagonPlacement?.placerId === acting) ||
    (game.phase === 'wagonVoting' && game.wagonVote?.stage === 'assign');
  if (wagonPick) {
    const tags = placementTags(game);
    const perEdge = new Map<string, number>();
    for (const t of tags) perEdge.set(t.placement.edge, (perEdge.get(t.placement.edge) ?? 0) + 1);
    return (
      <g className="overlay overlay-edges">
        {tags.map(({ placement, tag }) => {
          const key = placementKey(placement);
          const front = placementFront(game, placement) ?? undefined;
          const shared = (perEdge.get(placement.edge) ?? 1) > 1;
          const e = game.board.edges[placement.edge]!;
          const tail = front === e.vertices[0] ? e.vertices[1] : e.vertices[0];
          const head = front ?? e.vertices[1];
          const a = game.board.vertices[shared ? tail : e.vertices[0]]!.position;
          const b = game.board.vertices[shared ? head : e.vertices[1]]!.position;
          // Two spots on one edge split it: each owns the half by its front.
          const from = shared ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : a;
          return (
            <g
              key={key}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoveredEid(key)}
              onMouseLeave={() => setHoveredEid(null)}
              onClick={() =>
                dispatch(
                  game.phase === 'placeWagon'
                    ? { type: 'placeWagon', playerId: acting, edge: placement.edge, train: placement.train }
                    : { type: 'assignWagonVotes', playerId: acting, location: placement },
                )
              }
            >
              <line x1={from.x} y1={from.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={22} />
              {hoveredEid === key && (
                <Wagon
                  board={game.board}
                  edge={placement.edge}
                  front={front}
                  ghost
                  active
                  tag={tag}
                  at={shared ? 0.7 : 0.5}
                />
              )}
            </g>
          );
        })}
      </g>
    );
  }

  // T&B Catan Event Cards / Earthquake: pick one of your roads to damage.
  const eventChoice = game.phase === 'eventResolution' ? game.eventCards?.pending?.choices[0] : undefined;
  if (eventChoice?.kind === 'damageRoad' && eventChoice.playerId === acting) {
    const damaged = new Set(game.damagedRoads ?? []);
    return (
      <g className="overlay overlay-edges">
        {(actingPlayer?.roads ?? [])
          .filter((eid) => !damaged.has(eid))
          .map((eid) => {
            const e = game.board.edges[eid]!;
            const p1 = game.board.vertices[e.vertices[0]]!.position;
            const p2 = game.board.vertices[e.vertices[1]]!.position;
            return (
              <g
                key={eid}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredEid(eid)}
                onMouseLeave={() => setHoveredEid(null)}
                onClick={() => dispatch({ type: 'resolveEvent', playerId: acting, edge: eid })}
              >
                <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="transparent" strokeWidth={20} />
                <line
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke="#f2b705"
                  strokeOpacity={hoveredEid === eid ? 0.95 : 0.6}
                  strokeWidth={hoveredEid === eid ? 11 : 9}
                  strokeDasharray="5 3"
                  strokeLinecap="round"
                />
              </g>
            );
          })}
      </g>
    );
  }

  // T&B Barbarian Attack: card choices, Treason, end-of-turn knight moves.
  if (isBarbarianAttackMode(uiMode)) {
    return <BarbarianAttackOverlay game={game} acting={acting} mode={uiMode} color={previewColor} />;
  }

  if (uiMode.kind === 'moveRobber') {
    return (
      <g className="overlay overlay-hexes">
        {game.board.hexIds.map((hid) => {
          // Land hexes on the table that the rules allow (scenario bans,
          // T&B Friendly Robber, ...).
          if (!robberHexAllowed(game, hid, acting)) return null;
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
                const candidates = robberStealCandidates(game, acting, hid);
                // Taxation steals from everyone there: no victim to pick.
                if (candidates.length === 0 || game.pendingRobberMove?.reason === 'taxation') {
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
          if (!canMovePirateTo(game, hid)) return null;
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
                const only = candidates.length === 1 ? candidates[0]! : null;
                // Cloth for Catan: a victim with both cards and cloth gets a
                // choice of what to take.
                const onlyHasChoice =
                  only !== null &&
                  game.clothVillages !== undefined &&
                  (game.players.find((p) => p.id === only)?.cloth ?? 0) > 0 &&
                  totalResources(game.players.find((p) => p.id === only)!.resources) > 0;
                if (candidates.length === 0) {
                  dispatch({ type: 'movePirate', playerId: acting, hex: hid, stealFrom: null });
                } else if (only && !onlyHasChoice) {
                  const victim = game.players.find((p) => p.id === only)!;
                  dispatch({
                    type: 'movePirate',
                    playerId: acting,
                    hex: hid,
                    stealFrom: only,
                    ...(totalResources(victim.resources) === 0 ? { stealCloth: true } : {}),
                  });
                } else {
                  useGameStore.getState().setPendingPirateHex(hid);
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

export function VertexGhost({
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

export function EdgeGhost({
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
          strokeWidth={
            variant === 'bridge'
              ? 6
              : variant === 'ship'
                ? 4
                : 5
          }
          strokeLinecap="round"
        />
      )}
      <line
        x1={p1.x}
        y1={p1.y}
        x2={p2.x}
        y2={p2.y}
        stroke={variant === 'ship' ? '#9fe3ff' : '#ffd97e'}
        strokeOpacity={isHovered ? 0.4 : 0.9}
        strokeWidth={4}
        strokeDasharray={variant === 'ship' ? '2 4' : '6 4'}
        strokeLinecap="round"
      />
      {variant === 'ship' && !isHovered && (
        <text
          x={(p1.x + p2.x) / 2}
          y={(p1.y + p2.y) / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={9}
          pointerEvents="none"
        >
          ⛵
        </text>
      )}
    </g>
  );
}

// On a coastal edge where a road and a ship both fit (setup, Road
// Building), a small ship button on the sea side picks the ship.
function ShipChoiceGhost({
  eid,
  game,
  previewColor,
  onClick,
}: {
  eid: EdgeId;
  game: GameState;
  previewColor: PlayerColor;
  onClick: () => void;
}) {
  const e = game.board.edges[eid]!;
  const a = game.board.vertices[e.vertices[0]]!.position;
  const b = game.board.vertices[e.vertices[1]]!.position;
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const land = e.hexes.find((h) => game.board.hexes[h]!.terrain !== 'sea');
  const c = land ? game.board.hexes[land]!.center : mid;
  const dx = mid.x - c.x;
  const dy = mid.y - c.y;
  const mag = Math.hypot(dx, dy) || 1;
  const x = mid.x + (dx / mag) * 11;
  const y = mid.y + (dy / mag) * 11;
  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={onClick}
      style={{ cursor: 'pointer' }}
      className="ghost"
    >
      <title>Place a ship here instead of a road</title>
      <circle r={8} fill="#0b3a5a" fillOpacity={0.85} stroke="#9fe3ff" strokeWidth={1.5} />
      <circle r={3} cy={4} fill={playerColorVar(previewColor)} opacity={0.9} />
      <text textAnchor="middle" dominantBaseline="central" fontSize={9} y={-1}>
        ⛵
      </text>
    </g>
  );
}

// First piece of a Road Building card (or the ship being moved) — drawn in
// the actor's color so the user sees what they already picked.
export function FirstRoadPreview({
  eid,
  color,
  ship,
  faded,
}: {
  eid: EdgeId;
  color: PlayerColor;
  ship?: boolean;
  faded?: boolean;
}) {
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
      strokeOpacity={faded ? 0.35 : 0.85}
      strokeWidth={ship ? 3 : 5}
      strokeDasharray={ship ? '3 3' : undefined}
      strokeLinecap="round"
    />
  );
}

// Seafarers ship moves: legal destinations (Pirate Islands line rules
// included) for the ship on `from`.
export function moveTargets(game: GameState, pid: PlayerId, from: EdgeId): EdgeId[] {
  const lifted: GameState = {
    ...game,
    players: game.players.map((p) =>
      p.id === pid ? { ...p, ships: p.ships.filter((e) => e !== from) } : p,
    ),
  };
  return shipMoveDestinations(game, pid, from).filter(
    (eid) => !pirateIslandsShipViolation(lifted, pid, eid),
  );
}

// Ships the player could move right now (open end, not built this turn, not
// by the pirate, and with somewhere to go).
export function movableShips(game: GameState, pid: PlayerId): EdgeId[] {
  const player = game.players.find((p) => p.id === pid);
  if (!player || player.movedShipThisTurn) return [];
  return player.ships.filter(
    (eid) => isShipMovable(game, pid, eid) && moveTargets(game, pid, eid).length > 0,
  );
}
