import type { ReactNode } from 'react';
import type { Action, EdgeId, GameState, HexId, PlayerColor, PlayerId, VertexId } from '@/game/types';
import type { UIMode } from '@/store/gameStore';
import { playerColorVar } from '@/ui/shared/playerColors';
import { knightAt } from '@/game/modules/citiesAndKnights/knights/state';
import {
  canChaseRobberFrom,
  canPromoteKnightAt,
  knightCanAct,
  legalDisplaceTargets,
  legalIntrigueTargets,
  legalKnightMoves,
  recruitSpots,
  treasonPlacementSpots,
} from '@/game/modules/citiesAndKnights/knights/legal';
import { cityWallSites } from '@/game/modules/citiesAndKnights/actions/buildCityWall';
import { metropolisSites } from '@/game/modules/citiesAndKnights/actions/buildCityImprovement';
import { pillageableCities } from '@/game/modules/citiesAndKnights/barbarian';
import { displacedKnightDestinations } from '@/game/modules/citiesAndKnights/actions/displacedKnightMove';
import { merchantSites } from '@/game/modules/citiesAndKnights/actions/placeMerchant';
import { openRoads } from '@/game/modules/citiesAndKnights/progress/diplomacy';
import { canSwapToken } from '@/game/modules/citiesAndKnights/actions/playProgressCard';
import { canPlaceFreeRoad } from '@/game/modules/citiesAndKnights/actions/buildWrappers';
import { MAX_CITIES } from '@/game/actions/build';
import { EdgeGhost, FirstRoadPreview, VertexGhost } from '../PlacementOverlay';
import { BOARD_KNIGHT_SCALE, KnightGlyph } from './KnightPiece';

interface Ctx {
  game: GameState;
  uiMode: UIMode;
  acting: PlayerId;
  previewColor: PlayerColor;
  hoveredVid: VertexId | null;
  setHoveredVid: (v: VertexId | null) => void;
  hoveredEid: EdgeId | null;
  setHoveredEid: (e: EdgeId | null) => void;
  dispatch: (a: Action) => void;
  setMode: (m: UIMode) => void;
}

// Board click targets for every Cities & Knights mode / sub-phase. Returns
// undefined when the mode isn't a C&K one so PlacementOverlay carries on.
export function citiesKnightsOverlay(ctx: Ctx): ReactNode | undefined {
  const { game, uiMode, acting, dispatch, setMode } = ctx;
  const me = game.players.find((p) => p.id === acting);
  if (!me) return undefined;
  const vertices = (list: VertexId[], onPick: (v: VertexId) => void, variant: 'settlement' | 'city' = 'city') => (
    <g className="overlay overlay-vertices">
      {list.map((vid) => (
        <VertexGhost
          key={vid}
          vid={vid}
          variant={variant}
          previewColor={ctx.previewColor}
          isHovered={ctx.hoveredVid === vid}
          onHoverChange={(h) => ctx.setHoveredVid(h ? vid : null)}
          onClick={() => onPick(vid)}
        />
      ))}
    </g>
  );
  const knights = (
    list: VertexId[],
    onPick: (v: VertexId) => void,
    tone: 'pick' | 'target' | 'selected' = 'pick',
    selected: VertexId[] = [],
  ) => (
    <g className="overlay overlay-vertices">
      {list.map((vid) => (
        <KnightTarget
          key={vid}
          game={game}
          vid={vid}
          tone={selected.includes(vid) ? 'selected' : tone}
          onClick={() => onPick(vid)}
        />
      ))}
    </g>
  );
  const knightSpots = (list: VertexId[], onPick: (v: VertexId) => void, strength: 1 | 2 | 3 = 1, active = false) => (
    <g className="overlay overlay-vertices">
      {list.map((vid) => (
        <KnightSpotGhost
          key={vid}
          game={game}
          vid={vid}
          color={ctx.previewColor}
          strength={strength}
          active={active}
          hovered={ctx.hoveredVid === vid}
          onHover={(h) => ctx.setHoveredVid(h ? vid : null)}
          onClick={() => onPick(vid)}
        />
      ))}
    </g>
  );
  const hexes = (list: HexId[], onPick: (h: HexId) => void, selected?: HexId) => (
    <g className="overlay overlay-hexes">
      {list.map((hid) => {
        const h = game.board.hexes[hid]!;
        const isSel = hid === selected;
        return (
          <circle
            key={hid}
            cx={h.center.x}
            cy={h.center.y}
            r={26}
            fill={isSel ? '#ffd97e' : '#000'}
            fillOpacity={isSel ? 0.35 : 0.15}
            stroke="#fff"
            strokeOpacity={0.8}
            strokeDasharray="4 3"
            strokeWidth={2}
            style={{ cursor: 'pointer' }}
            onClick={() => onPick(hid)}
          />
        );
      })}
    </g>
  );
  const done = () => setMode({ kind: 'idle' });
  const myKnights = Object.entries(game.knights ?? {})
    .filter(([, k]) => k.playerId === acting)
    .map(([v]) => v);

  switch (uiMode.kind) {
    case 'buildCityWall':
      return vertices(cityWallSites(game, acting), (v) =>
        dispatch({ type: 'buildCityWall', playerId: acting, vertex: v }),
      );
    case 'engineering':
      return vertices(cityWallSites(game, acting), (v) => {
        dispatch({ type: 'playProgressCard', playerId: acting, card: 'engineering', vertex: v });
        done();
      });
    case 'medicine':
      return vertices(me.cities.length >= MAX_CITIES ? [] : me.settlements, (v) => {
        dispatch({ type: 'playProgressCard', playerId: acting, card: 'medicine', vertex: v });
        done();
      });
    case 'recruitKnight':
      return knightSpots(recruitSpots(game, acting), (v) =>
        dispatch({ type: 'recruitKnight', playerId: acting, vertex: v }),
      );
    case 'activateKnight':
      return knights(
        myKnights.filter((v) => !game.knights![v]!.active),
        (v) => dispatch({ type: 'activateKnight', playerId: acting, vertex: v }),
      );
    case 'promoteKnight':
      return knights(
        myKnights.filter((v) => canPromoteKnightAt(game, acting, v)),
        (v) => dispatch({ type: 'promoteKnight', playerId: acting, vertex: v }),
      );
    case 'smithing': {
      const sel = uiMode.selected;
      return knights(
        myKnights.filter((v) => canPromoteKnightAt(game, acting, v)),
        (v) => {
          const next = sel.includes(v) ? sel.filter((x) => x !== v) : [...sel, v].slice(-2);
          setMode({ kind: 'smithing', selected: next });
        },
        'pick',
        sel,
      );
    }
    case 'chaseRobber':
      return knights(
        myKnights.filter((v) => canChaseRobberFrom(game, v)),
        (v) => {
          dispatch({ type: 'chaseRobber', playerId: acting, vertex: v });
        },
      );
    case 'moveKnight':
    case 'displaceKnight': {
      const src = uiMode.sourceVertex;
      const wantMove = uiMode.kind === 'moveKnight';
      if (!src) {
        const able = myKnights.filter(
          (v) =>
            knightCanAct(game, v) &&
            (wantMove
              ? legalKnightMoves(game, v).length > 0 || legalDisplaceTargets(game, v).length > 0 || canChaseRobberFrom(game, v)
              : legalDisplaceTargets(game, v).length > 0),
        );
        return knights(able, (v) => setMode({ ...uiMode, sourceVertex: v }));
      }
      const k = knightAt(game, src);
      const moves = wantMove ? legalKnightMoves(game, src) : [];
      const targets = legalDisplaceTargets(game, src);
      const chase = wantMove && canChaseRobberFrom(game, src);
      const robberHex = game.board.hexes[game.board.robberHex];
      return (
        <g className="overlay overlay-vertices">
          <circle
            cx={game.board.vertices[src]!.position.x}
            cy={game.board.vertices[src]!.position.y}
            r={15}
            fill="none"
            stroke="#ffd97e"
            strokeWidth={2.5}
          />
          {k &&
            moves.map((vid) => (
              <KnightSpotGhost
                key={vid}
                game={game}
                vid={vid}
                color={ctx.previewColor}
                strength={k.strength}
                active={false}
                hovered={ctx.hoveredVid === vid}
                onHover={(h) => ctx.setHoveredVid(h ? vid : null)}
                onClick={() => {
                  dispatch({ type: 'moveKnight', playerId: acting, from: src, to: vid });
                  done();
                }}
              />
            ))}
          {targets.map((vid) => (
            <KnightTarget
              key={vid}
              game={game}
              vid={vid}
              tone="target"
              onClick={() => {
                dispatch({ type: 'displaceKnight', playerId: acting, from: src, to: vid });
                done();
              }}
            />
          ))}
          {chase && robberHex && (
            <g
              style={{ cursor: 'pointer' }}
              onClick={() => dispatch({ type: 'chaseRobber', playerId: acting, vertex: src })}
            >
              <title>Chase away the robber</title>
              <circle
                cx={robberHex.center.x}
                cy={robberHex.center.y}
                r={24}
                fill="#c0392b"
                fillOpacity={0.18}
                stroke="#ff8a7a"
                strokeWidth={2.5}
                strokeDasharray="5 3"
              />
            </g>
          )}
        </g>
      );
    }
    case 'displacedKnightMove': {
      const ctxMove = game.pendingKnightMove;
      if (!ctxMove || ctxMove.playerId !== acting) return null;
      return knightSpots(
        displacedKnightDestinations(game),
        (v) => dispatch({ type: 'displacedKnightMove', playerId: acting, to: v }),
        ctxMove.knightStrength ?? 1,
        ctxMove.knightActive ?? false,
      );
    }
    case 'intrigue':
      return knights(legalIntrigueTargets(game, acting), (v) => {
        dispatch({ type: 'playProgressCard', playerId: acting, card: 'intrigue', vertex: v });
        done();
      }, 'target');
    case 'treasonRemoveKnight':
      if (game.pendingTreason?.targetId !== acting) return null;
      return knights(myKnights, (v) =>
        dispatch({ type: 'treasonRemoveKnight', playerId: acting, vertex: v }),
      );
    case 'treasonPlaceKnight': {
      const strength = uiMode.strength;
      if (game.pendingTreason?.attackerId !== acting || !strength) return null;
      return knightSpots(
        treasonPlacementSpots(game, acting),
        (v) => dispatch({ type: 'treasonPlaceKnight', playerId: acting, vertex: v, strength }),
        strength,
        !!game.pendingTreason.removedActive,
      );
    }
    case 'placeMetropolis': {
      const track = game.pendingMetropolis?.track;
      if (!track) return null;
      return vertices(metropolisSites(game, acting), (v) =>
        dispatch({ type: 'placeMetropolis', playerId: acting, track, vertex: v }),
      );
    }
    case 'choosePillage':
      if (game.pendingPillage?.[0] !== acting) return null;
      return vertices(pillageableCities(game, acting), (v) =>
        dispatch({ type: 'choosePillagedCity', playerId: acting, vertex: v }),
      );
    case 'placeMerchant':
      return hexes(merchantSites(game, acting), (h) =>
        dispatch({ type: 'placeMerchant', playerId: acting, hex: h }),
      );
    case 'removeRoad':
      return (
        <g className="overlay overlay-edges">
          {openRoads(game).map((eid) => (
            <EdgeGhost
              key={eid}
              eid={eid}
              variant="road"
              previewColor={ctx.previewColor}
              isHovered={ctx.hoveredEid === eid}
              onHoverChange={(h) => ctx.setHoveredEid(h ? eid : null)}
              onClick={() => dispatch({ type: 'removeRoad', playerId: acting, edge: eid })}
            />
          ))}
        </g>
      );
    case 'swapTokens': {
      const first = uiMode.firstHex;
      const list = game.board.hexIds.filter((h) => canSwapToken(game, h) && h !== first);
      return hexes(
        first ? [first, ...list] : list,
        (h) => {
          if (!first) return setMode({ kind: 'swapTokens', firstHex: h });
          if (h === first) return setMode({ kind: 'swapTokens' });
          dispatch({ type: 'playProgressCard', playerId: acting, card: 'invention', fromHex: first, toHex: h });
          done();
        },
        first,
      );
    }
    case 'progressRoadBuilding': {
      const first = uiMode.first;
      const staged: GameState = first
        ? {
            ...game,
            players: game.players.map((p) =>
              p.id === acting ? { ...p, roads: [...p.roads, first] } : p,
            ),
          }
        : game;
      return (
        <g className="overlay overlay-edges">
          {game.board.edgeIds
            .filter((eid) => eid !== first && canPlaceFreeRoad(staged, acting, eid))
            .map((eid) => (
              <EdgeGhost
                key={eid}
                eid={eid}
                variant="road"
                previewColor={ctx.previewColor}
                isHovered={ctx.hoveredEid === eid}
                onHoverChange={(h) => ctx.setHoveredEid(h ? eid : null)}
                onClick={() => {
                  if (!first) return setMode({ kind: 'progressRoadBuilding', first: eid });
                  dispatch({
                    type: 'playProgressCard',
                    playerId: acting,
                    card: 'progressRoadBuilding',
                    edges: [first, eid],
                  });
                  done();
                }}
              />
            ))}
          {first && <FirstRoadPreview eid={first} color={ctx.previewColor} />}
        </g>
      );
    }
    default:
      return undefined;
  }
}

// A knight the player may click: a ring around it (gold to pick, red for an
// opposing knight to displace / intrigue, filled when selected).
function KnightTarget({
  game,
  vid,
  tone,
  onClick,
}: {
  game: GameState;
  vid: VertexId;
  tone: 'pick' | 'target' | 'selected';
  onClick: () => void;
}) {
  const p = game.board.vertices[vid]!.position;
  const stroke = tone === 'target' ? '#ff7a6b' : '#ffd97e';
  return (
    <g transform={`translate(${p.x}, ${p.y})`} style={{ cursor: 'pointer' }} onClick={onClick} className="ghost">
      <circle r={16} fill="transparent" />
      <circle
        r={13}
        fill={tone === 'selected' ? '#ffd97e' : '#fff'}
        fillOpacity={tone === 'selected' ? 0.45 : 0.12}
        stroke={stroke}
        strokeWidth={2.4}
        strokeDasharray={tone === 'selected' ? undefined : '3 3'}
      />
    </g>
  );
}

// An empty intersection a knight can be put on: dashed ring, and a ghost of
// the knight (lying down when it arrives inactive) on hover.
function KnightSpotGhost({
  game,
  vid,
  color,
  strength,
  active,
  hovered,
  onHover,
  onClick,
}: {
  game: GameState;
  vid: VertexId;
  color: PlayerColor;
  strength: 1 | 2 | 3;
  active: boolean;
  hovered: boolean;
  onHover: (h: boolean) => void;
  onClick: () => void;
}) {
  const p = game.board.vertices[vid]!.position;
  return (
    <g
      transform={`translate(${p.x}, ${p.y})`}
      style={{ cursor: 'pointer' }}
      onClick={onClick}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      className="ghost"
    >
      <circle r={14} fill="transparent" />
      {hovered && (
        <g opacity={0.7} transform={`scale(${BOARD_KNIGHT_SCALE})`}>
          <KnightGlyph color={playerColorVar(color)} strength={strength} active={active} />
        </g>
      )}
      <circle
        r={10}
        fill="#fff"
        fillOpacity={hovered ? 0 : 0.18}
        stroke="#ffd97e"
        strokeOpacity={0.9}
        strokeWidth={2}
        strokeDasharray="3 3"
      />
    </g>
  );
}
