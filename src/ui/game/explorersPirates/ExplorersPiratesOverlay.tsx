import { useState } from 'react';
import { useGameStore, type UIMode } from '@/store/gameStore';
import type { Action, EdgeId, EpLocation, EpShip, GameState, HexId, PlayerColor, PlayerId } from '@/game/types';
import {
  buildableShipEdges,
  epSupply,
  harborUpgradeSpots,
  hasRoomFor,
  hiddenHexesAtEdge,
  isExplorersPirates,
  pieceSpots,
  pirateHexOptions,
  pirateVictims,
  shipById,
  shipsOf,
  stepOwesTribute,
  cargoAt,
} from '@/game/modules/explorersPirates/state';
import { epSetupShipEdges } from '@/game/modules/explorersPirates/setup';
import { EP_TRIBUTE_GOLD } from '@/game/modules/explorersPirates/constants';
import { EdgeGhost, VertexGhost } from '../PlacementOverlay';
import { EpShipFigure } from './EpArt';
import { edgeEnds, edgeMid, epShipSpot } from './geometry';
import { epSelectedShip, epShipOptions, type EpShipOptions } from './shipActions';

// Board click targets for Explorers & Pirates: the setup ship, harbor
// upgrades, new ships (and which ship to return when all 3 are out),
// settlers / crews onto a harbor settlement or a ship next to one, the
// Movement phase (pick a ship, step it edge by edge with the MP left and
// any tribute shown, found a settlement, land / load at the hexes it
// touches) and placing your pirate ship. Rendered by PlacementOverlay,
// which already limits it to the acting human seat (online: its device).

export type ExplorersPiratesMode = Extract<
  UIMode,
  { kind: 'epHarbor' | 'epShip' | 'epPiece' | 'epSetupShip' | 'epMove' | 'epPirate' }
>;

export function isExplorersPiratesMode(mode: UIMode): mode is ExplorersPiratesMode {
  return (
    mode.kind === 'epHarbor' ||
    mode.kind === 'epShip' ||
    mode.kind === 'epPiece' ||
    mode.kind === 'epSetupShip' ||
    mode.kind === 'epMove' ||
    mode.kind === 'epPirate'
  );
}

const GOLD = '#ffd54f';

export function ExplorersPiratesOverlay({
  game,
  acting,
  mode,
  color,
}: {
  game: GameState;
  acting: PlayerId;
  mode: ExplorersPiratesMode;
  color: PlayerColor;
}) {
  const { dispatch, setMode, setPendingPirateHex } = useGameStore();
  const [hover, setHover] = useState<string | null>(null);
  if (!isExplorersPirates(game)) return null;
  const ep = game.explorersPirates;
  const hoverProps = (key: string) => ({
    onMouseEnter: () => setHover(key),
    onMouseLeave: () => setHover((h) => (h === key ? null : h)),
  });

  if (mode.kind === 'epSetupShip') {
    if (game.phase !== 'setupRound3' || game.setupState?.step !== 'ship') return null;
    return (
      <g className="overlay ep-overlay ep-setup-ship">
        {epSetupShipEdges(game, acting).map((eid) => (
          <EdgeGhost
            key={eid}
            eid={eid}
            variant="ship"
            previewColor={color}
            isHovered={hover === eid}
            onHoverChange={(h) => setHover(h ? eid : null)}
            onClick={() => dispatch({ type: 'placeInitialShip', playerId: acting, edge: eid })}
          />
        ))}
      </g>
    );
  }

  if (mode.kind === 'epHarbor') {
    if (game.phase !== 'main') return null;
    return (
      <g className="overlay ep-overlay ep-harbor-spots">
        {harborUpgradeSpots(game, acting).map((vid) => (
          <VertexGhost
            key={vid}
            vid={vid}
            variant="harbor"
            previewColor={color}
            isHovered={hover === vid}
            onHoverChange={(h) => setHover(h ? vid : null)}
            onClick={() => dispatch({ type: 'epBuildHarbor', playerId: acting, vertex: vid })}
          />
        ))}
      </g>
    );
  }

  if (mode.kind === 'epShip') {
    if (game.phase !== 'main') return null;
    const supply = epSupply(game, acting).ships;
    if (supply <= 0 && !mode.recycle) {
      // All three ships are out: pick the one to bring home first.
      return (
        <g className="overlay ep-overlay ep-recycle">
          {shipsOf(game, acting).map((s) => (
            <ShipTarget
              key={s.id}
              game={game}
              ship={s}
              hot={hover === s.id}
              stroke="#ff8a80"
              title="Return this ship (and its cargo) to your supply, then build it again next to a harbor settlement"
              onClick={() => setMode({ kind: 'epShip', recycle: s.id })}
              {...hoverProps(s.id)}
            />
          ))}
        </g>
      );
    }
    const staged: GameState = mode.recycle
      ? { ...game, explorersPirates: { ...ep, ships: ep.ships.filter((s) => s.id !== mode.recycle) } }
      : game;
    return (
      <g className="overlay ep-overlay ep-ship-spots">
        {mode.recycle &&
          (() => {
            const old = shipById(game, mode.recycle);
            if (!old) return null;
            const at = epShipSpot(game, old);
            return (
              <g transform={`translate(${at.x}, ${at.y})`} pointerEvents="none">
                <circle r={13} fill="#ff5252" fillOpacity={0.2} stroke="#ff8a80" strokeWidth={1.8} strokeDasharray="3 2" />
                <text y={-15} textAnchor="middle" fontSize={8} fontWeight={800} fill="#ff8a80">
                  returns
                </text>
              </g>
            );
          })()}
        {buildableShipEdges(staged, acting).map((eid) => (
          <EdgeGhost
            key={eid}
            eid={eid}
            variant="ship"
            previewColor={color}
            isHovered={hover === eid}
            onHoverChange={(h) => setHover(h ? eid : null)}
            onClick={() =>
              dispatch({
                type: 'epBuildShip',
                playerId: acting,
                edge: eid,
                ...(mode.recycle ? { recycle: mode.recycle } : {}),
              })
            }
          />
        ))}
      </g>
    );
  }

  if (mode.kind === 'epPiece') {
    if (game.phase !== 'main') return null;
    const piece = mode.piece;
    const spots = pieceSpots(game, acting, piece, false);
    const place = (at: EpLocation) => {
      const cargo = cargoAt(game, at) ?? [];
      if (hasRoomFor(cargo, [piece])) {
        dispatch(
          piece === 'settler'
            ? { type: 'epBuildSettler', playerId: acting, at }
            : { type: 'epBuildCrew', playerId: acting, at },
        );
      } else {
        // Full: the ActionBar asks which pieces go back to the supply.
        setMode({ kind: 'epPiece', piece, at });
      }
    };
    const picked = mode.at ? spotKey(mode.at) : null;
    return (
      <g className="overlay ep-overlay ep-piece-spots">
        {spots.map((at) => {
          const key = spotKey(at);
          const full = !hasRoomFor(cargoAt(game, at) ?? [], [piece]);
          const stroke = key === picked ? GOLD : full ? '#ffb74d' : '#b9f6ca';
          const title = full
            ? `No room for a ${piece} here: pick it, then choose what goes back to your supply`
            : `Put the ${piece} here`;
          if ('harbor' in at) {
            const p = game.board.vertices[at.harbor]!.position;
            return (
              <g key={key} className="ghost" style={{ cursor: 'pointer' }} onClick={() => place(at)} {...hoverProps(key)}>
                <title>{title}</title>
                <circle cx={p.x} cy={p.y} r={hover === key ? 17 : 15} fill="#fff" fillOpacity={0.12} stroke={stroke} strokeWidth={2.4} strokeDasharray={full ? '3 3' : undefined} />
                <Badge x={p.x + 13} y={p.y - 13} text={full ? '↺' : '+'} stroke={stroke} />
              </g>
            );
          }
          const ship = shipById(game, at.ship);
          if (!ship) return null;
          return (
            <ShipTarget
              key={key}
              game={game}
              ship={ship}
              hot={hover === key || key === picked}
              stroke={stroke}
              dashed={full}
              badge={full ? '↺' : '+'}
              title={title}
              onClick={() => place(at)}
              {...hoverProps(key)}
            />
          );
        })}
      </g>
    );
  }

  if (mode.kind === 'epPirate') {
    const pending = ep.pendingPirate;
    if (game.phase !== 'epPlacePirate' || pending?.playerId !== acting) return null;
    return (
      <g className="overlay ep-overlay ep-pirate-spots">
        {pirateHexOptions(game).map((hid) => {
          const hex = game.board.hexes[hid]!;
          const victims = pirateVictims(game, acting, hid);
          const shoal = ep.shoals.find((s) => s.hex === hid && s.haul);
          return (
            <g
              key={hid}
              className="ghost"
              style={{ cursor: 'pointer' }}
              {...hoverProps(hid)}
              onClick={() => {
                if (victims.length <= 1) {
                  dispatch({ type: 'epPlacePirate', playerId: acting, hex: hid, stealFrom: victims[0] ?? null });
                } else {
                  setPendingPirateHex(hid);
                }
              }}
            >
              <title>
                {`Put your pirate ship here${victims.length ? ` and rob ${victims.map((v) => game.players.find((p) => p.id === v)?.name).join(' or ')}` : ''}${shoal ? ' (its fish haul goes back to the supply)' : ''}`}
              </title>
              <circle
                cx={hex.center.x}
                cy={hex.center.y}
                r={hover === hid ? 28 : 25}
                fill="#000"
                fillOpacity={hover === hid ? 0.3 : 0.18}
                stroke="#fff"
                strokeOpacity={0.85}
                strokeDasharray="4 3"
                strokeWidth={2}
              />
              {victims.length > 0 && (
                <Badge x={hex.center.x + 18} y={hex.center.y - 18} text={`💰${victims.length > 1 ? victims.length : ''}`} stroke={GOLD} wide />
              )}
            </g>
          );
        })}
      </g>
    );
  }

  // ----- Movement phase -----
  if (game.phase !== 'epMovement' || game.playerOrder[game.currentPlayerIndex] !== acting) return null;
  const selected = epSelectedShip(game, acting, mode.ship);
  const opts = selected ? epShipOptions(game, selected.id) : null;
  const mine = shipsOf(game, acting);
  return (
    <g className="overlay ep-overlay ep-move">
      {/* Ship pickers: every ship of yours (the selected one ringed gold). */}
      {mine.map((s) => {
        const isSel = s.id === selected?.id;
        const o = epShipOptions(game, s.id);
        const idle = !o || (o.steps.length === 0 && !hasAnyAction(o));
        return (
          <ShipTarget
            key={s.id}
            game={game}
            ship={s}
            hot={isSel || hover === s.id}
            stroke={isSel ? GOLD : idle ? '#9aa5b1' : '#9fe3ff'}
            dashed={!isSel}
            badge={o && o.mp > 0 ? `${o.mp}` : undefined}
            title={isSel ? 'Selected ship' : `Select this ship${o ? ` (${o.mp} MP)` : ''}`}
            onClick={() => setMode({ kind: 'epMove', ship: s.id })}
            {...hoverProps(s.id)}
          />
        );
      })}
      {selected && opts && (
        <>
          {opts.steps.map((eid) => (
            <StepTarget
              key={eid}
              game={game}
              ship={selected}
              edge={eid}
              mpAfter={opts.mp - 1}
              color={color}
              hot={hover === `step:${eid}`}
              onClick={() => dispatch({ type: 'epMoveShip', playerId: acting, ship: selected.id, to: eid })}
              {...hoverProps(`step:${eid}`)}
            />
          ))}
          {opts.found.map((vid) => (
            <VertexGhost
              key={`found:${vid}`}
              vid={vid}
              variant="settlement"
              previewColor={color}
              isHovered={hover === `found:${vid}`}
              onHoverChange={(h) => setHover(h ? `found:${vid}` : null)}
              onClick={() => dispatch({ type: 'epFoundSettlement', playerId: acting, ship: selected.id, vertex: vid })}
            />
          ))}
          {hexActions(opts).map(({ hex, kind, label, title }) => {
            const c = game.board.hexes[hex]!.center;
            const key = `${kind}:${hex}`;
            return (
              <g
                key={key}
                className="ghost"
                style={{ cursor: 'pointer' }}
                {...hoverProps(key)}
                onClick={() => dispatch(hexAction(kind, acting, selected.id, hex))}
              >
                <title>{title}</title>
                <circle cx={c.x} cy={c.y} r={hover === key ? 20 : 18} fill="#2e7d32" fillOpacity={hover === key ? 0.35 : 0.18} stroke="#b9f6ca" strokeWidth={2.2} strokeDasharray="4 3" />
                <Badge x={c.x} y={c.y - 33} text={label} stroke="#b9f6ca" wide />
              </g>
            );
          })}
        </>
      )}
    </g>
  );
}

export type HexActionKind = 'epCrewToLair' | 'epCrewFromLair' | 'epCrewToFarm' | 'epLoadSpice' | 'epLoadFish';

export function hexAction(kind: HexActionKind, playerId: PlayerId, ship: string, hex: HexId): Action {
  switch (kind) {
    case 'epCrewToLair':
      return { type: 'epCrewToLair', playerId, ship, hex };
    case 'epCrewFromLair':
      return { type: 'epCrewFromLair', playerId, ship, hex };
    case 'epCrewToFarm':
      return { type: 'epCrewToFarm', playerId, ship, hex };
    case 'epLoadSpice':
      return { type: 'epLoadSpice', playerId, ship, hex };
    case 'epLoadFish':
      return { type: 'epLoadFish', playerId, ship, hex };
  }
}

export function hexActions(o: EpShipOptions): Array<{
  hex: HexId;
  kind: HexActionKind;
  label: string;
  title: string;
}> {
  return [
    ...o.crewToLair.map((hex) => ({ hex, kind: 'epCrewToLair' as const, label: '👥 attack', title: 'Land a crew on this pirate lair (the third crew captures it)' })),
    ...o.crewFromLair.map((hex) => ({ hex, kind: 'epCrewFromLair' as const, label: '👥 aboard', title: 'Take your crew back aboard from this gold field' })),
    ...o.crewToFarm.map((hex) => ({ hex, kind: 'epCrewToFarm' as const, label: '👥 land', title: 'Land a crew on this spice farm: its advantage and building rights are yours for good' })),
    ...o.loadSpice.map((hex) => ({ hex, kind: 'epLoadSpice' as const, label: '🌶 load', title: 'Load your spice sack from this farm' })),
    ...o.loadFish.map((hex) => ({ hex, kind: 'epLoadFish' as const, label: '🐟 load', title: 'Load the fish haul (it fills the ship)' })),
  ];
}

export function hasAnyAction(o: EpShipOptions): boolean {
  return (
    o.found.length > 0 ||
    hexActions(o).length > 0 ||
    o.deliver ||
    o.chase ||
    o.harbors.length > 0
  );
}

function spotKey(at: EpLocation): string {
  return 'harbor' in at ? `h:${at.harbor}` : `s:${at.ship}`;
}

function Badge({ x, y, text, stroke, wide }: { x: number; y: number; text: string; stroke: string; wide?: boolean }) {
  const w = wide ? Math.max(16, text.length * 6 + 6) : 14;
  return (
    <g transform={`translate(${x}, ${y})`} pointerEvents="none">
      <rect x={-w / 2} y={-6.5} width={w} height={13} rx={6.5} fill="#1f2933" stroke={stroke} strokeWidth={1.2} />
      <text y={3.4} textAnchor="middle" fontSize={8.5} fontWeight={800} fill="#fff">
        {text}
      </text>
    </g>
  );
}

function ShipTarget({
  game,
  ship,
  hot,
  stroke,
  dashed,
  badge,
  title,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: {
  game: GameState;
  ship: EpShip;
  hot: boolean;
  stroke: string;
  dashed?: boolean;
  badge?: string;
  title: string;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const at = epShipSpot(game, ship);
  return (
    <g
      className="ghost ep-ship-target"
      style={{ cursor: 'pointer' }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      transform={`translate(${at.x}, ${at.y})`}
    >
      <title>{title}</title>
      <circle cy={-3} r={hot ? 16 : 14.5} fill="#fff" fillOpacity={hot ? 0.16 : 0.06} stroke={stroke} strokeWidth={hot ? 2.6 : 2} strokeDasharray={dashed ? '3 2.5' : undefined} />
      {badge && <Badge x={12} y={-15} text={badge} stroke={stroke} />}
    </g>
  );
}

function StepTarget({
  game,
  ship,
  edge,
  mpAfter,
  color,
  hot,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: {
  game: GameState;
  ship: EpShip;
  edge: EdgeId;
  mpAfter: number;
  color: PlayerColor;
  hot: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const [a, b] = edgeEnds(game, edge);
  const m = edgeMid(game, edge);
  const tribute = stepOwesTribute(game, ship, ship.edge, edge);
  const explores = hiddenHexesAtEdge(game, edge).length > 0;
  const full = (game.explorersPirates?.ships.filter((s) => s.edge === edge && s.id !== ship.id).length ?? 0) >= 2;
  const stroke = explores ? '#b9f6ca' : tribute ? '#ffb74d' : '#9fe3ff';
  const owner = tribute ? game.players.find((p) => p.id === game.explorersPirates?.pirate?.owner)?.name : null;
  return (
    <g className="ghost ep-step" style={{ cursor: 'pointer' }} onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <title>
        {`Sail here: ${mpAfter} MP left after${tribute ? ` — pays ${owner} ${EP_TRIBUTE_GOLD} gold tribute` : ''}${explores ? ' — explores the face-down hex (ends the move)' : ''}${full ? ' — 2 ships there: you may pass but not stop' : ''}`}
      </title>
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={18} />
      <line
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        stroke={stroke}
        strokeOpacity={hot ? 1 : 0.8}
        strokeWidth={hot ? 4.4 : 3.2}
        strokeDasharray="5 3"
        strokeLinecap="round"
      />
      {hot && (
        <g transform={`translate(${m.x}, ${m.y})`} pointerEvents="none">
          <EpShipFigure color={color} cargo={ship.cargo} ghost />
        </g>
      )}
      <g transform={`translate(${m.x}, ${m.y})`} pointerEvents="none">
        <rect x={tribute || explores ? -12 : -7} y={-6.5} width={tribute || explores ? 24 : 14} height={13} rx={6.5} fill="#1f2933" stroke={stroke} strokeWidth={1.2} />
        <text x={tribute || explores ? -5 : 0} y={3.4} textAnchor="middle" fontSize={9} fontWeight={800} fill="#fff">
          {full ? '→' : mpAfter}
        </text>
        {tribute && (
          <g transform="translate(6, 0)">
            <circle r={4.4} fill="#e9b73c" stroke="#8a5d0e" strokeWidth={0.8} />
            <text y={2.6} textAnchor="middle" fontSize={6} fontWeight={800} fill="#8a5d0e">
              1
            </text>
          </g>
        )}
        {explores && !tribute && (
          <text x={6} y={3.4} textAnchor="middle" fontSize={8}>
            🧭
          </text>
        )}
      </g>
    </g>
  );
}
