import type { ReactNode } from 'react';
import type { EpCargo, GameState, HexId, Player, PlayerColor, PlayerId, VertexId } from '@/game/types';
import { isExplorersPirates, isHarbor } from '@/game/modules/explorersPirates/state';
import { EP_LAIR_CREWS } from '@/game/modules/explorersPirates/constants';
import {
  AbilityGlyph,
  CargoGlyph,
  CrewGlyph,
  DieFace,
  EP_ABILITY_LABEL,
  EP_CARGO_LABEL,
  EP_REGION_EDGE,
  EP_REGION_LABEL,
  EpPirateFigure,
  EpShipFigure,
  FishHaulGlyph,
  GooseSilhouette,
  HarborSettlementFigure,
  LairToken,
  ParrotSilhouette,
  SpiceSackGlyph,
  abilityText,
} from './EpArt';
import { epShipSpot, seaward, type Pt } from './geometry';

// Explorers & Pirates board art (2025 Rulebook). Pure and prop-driven like
// the rest of BoardSVG, so the end-game replay draws it too. Pointer events
// are off: ExplorersPiratesOverlay owns the clicks.
//
// The hex layer goes right after the hex tiles: face-down parrot / goose
// backs (only the region is shown — never what lies underneath), the
// Council of Catan island with its two anchors, the frame sea, spice farms
// (advantage, sacks still there, crews), pirate lairs on gold fields (the
// lair token's number stays hidden until it's captured), fish shoals and
// their hauls, and the harbor-settlement marks during setup.
// The piece layer goes after the settlements: harbor settlements with the
// pieces stored on them, the ships with their cargo, the pirate ship.

function cornerPoints(game: GameState, hexId: HexId, scale = 1): string {
  const hex = game.board.hexes[hexId]!;
  const c = hex.center;
  return hex.corners
    .map((v) => {
      const p = game.board.vertices[v]!.position;
      return `${c.x + (p.x - c.x) * scale},${c.y + (p.y - c.y) * scale}`;
    })
    .join(' ');
}

function colorOf(game: GameState, pid: PlayerId): PlayerColor {
  return game.players.find((p) => p.id === pid)?.color ?? 'white';
}

function nameOf(game: GameState, pid: PlayerId): string {
  return game.players.find((p) => p.id === pid)?.name ?? pid;
}

// A row of small pieces centred on `at`, `gap` apart.
function Row({ at, gap, children }: { at: Pt; gap: number; children: ReactNode[] }) {
  const n = children.length;
  return (
    <>
      {children.map((child, i) => (
        <g key={i} transform={`translate(${at.x + (i - (n - 1) / 2) * gap}, ${at.y})`}>
          {child}
        </g>
      ))}
    </>
  );
}

export function ExplorersPiratesHexLayer({ game }: { game: GameState }) {
  if (!isExplorersPirates(game)) return null;
  const ep = game.explorersPirates;
  const board = game.board;
  return (
    <g className="ep-hexes" pointerEvents="none">
      {/* Face-down hexes: the back of the region's tiles. */}
      {Object.keys(ep.regionOf)
        .filter((h) => ep.hidden[h] !== undefined && board.hexes[h])
        .map((h) => {
          const region = ep.regionOf[h]!;
          const edge = EP_REGION_EDGE[region];
          const c = board.hexes[h]!.center;
          return (
            <g key={h} className={`ep-back ep-back-${region}`}>
              <title>{`${EP_REGION_LABEL[region]} hex — face down. A ship reaching one of its corners explores it.`}</title>
              <polygon points={cornerPoints(game, h)} fill="#24394b" stroke="#0e1a24" strokeWidth={1.5} />
              <polygon points={cornerPoints(game, h, 0.88)} fill="#2c4659" stroke={edge} strokeWidth={4} strokeLinejoin="round" />
              <polygon points={cornerPoints(game, h, 0.74)} fill="none" stroke={edge} strokeOpacity={0.35} strokeWidth={1.2} />
              <g transform={`translate(${c.x}, ${c.y + 1}) scale(1.35)`}>
                {region === 'parrot' ? <ParrotSilhouette fill={edge} /> : <GooseSilhouette fill={edge} />}
              </g>
            </g>
          );
        })}

      {/* Sea printed on the frame: ships yes, the pirate no. */}
      {ep.frameHexes
        .filter((h) => board.hexes[h])
        .map((h) => {
          const c = board.hexes[h]!.center;
          return (
            <g key={h} className="ep-frame-sea">
              <title>Sea printed on the frame: ships may sail here, the pirate ship may not.</title>
              <polygon points={cornerPoints(game, h, 0.9)} fill="#000" fillOpacity={0.12} stroke="#b7915a" strokeWidth={3} strokeDasharray="7 4" />
              <text x={c.x} y={c.y + 30} textAnchor="middle" fontSize={8} fontWeight={700} fill="#e8d5ae" opacity={0.85}>
                FRAME
              </text>
            </g>
          );
        })}

      <CouncilIsland game={game} />

      {/* Fish shoals: die number, a haul when one is waiting. */}
      {ep.shoals.map((s) => {
        const c = board.hexes[s.hex]!.center;
        const pirateHere = ep.pirate?.hex === s.hex;
        return (
          <g key={s.hex} className={`ep-shoal${s.haul ? ' has-haul' : ''}`}>
            <title>{`Fish shoal ${s.number}${s.haul ? ' — a fish haul waits here: a ship next to it can load it (it fills the ship)' : ''}${pirateHere ? ' — the pirate is here: no haul appears' : ''}`}</title>
            <polygon points={cornerPoints(game, s.hex, 0.94)} fill="#3f8fc0" fillOpacity={0.35} />
            <FishSchool at={{ x: c.x, y: c.y + 2 }} />
            <g transform={`translate(${c.x}, ${c.y - 22})`}>
              <DieFace n={s.number} size={13} />
            </g>
            {s.haul && (
              <g transform={`translate(${c.x}, ${c.y + 19}) scale(1.5)`}>
                <FishHaulGlyph />
              </g>
            )}
          </g>
        );
      })}

      {/* Spice farms: advantage, sacks still there, crews. */}
      {ep.farms.map((f) => {
        const c = board.hexes[f.hex]!.center;
        const crewNames = f.crews.map((p) => nameOf(game, p)).join(', ');
        return (
          <g key={f.hex} className={`ep-farm ep-farm-${f.ability}`}>
            <title>
              {`Spice farm — ${abilityText(f.ability, f.pirateNumber)}.${f.crews.length ? ` Crews: ${crewNames}.` : ' No crews yet.'} Land a crew to gain its advantage and the right to build here; then load your spice sack.`}
            </title>
            <circle cx={c.x} cy={c.y} r={12.5} fill="#7a2f16" stroke="#f3d39b" strokeWidth={1.4} />
            <g transform={`translate(${c.x}, ${c.y}) scale(1.05)`}>
              <AbilityGlyph ability={f.ability} pirateNumber={f.pirateNumber} />
            </g>
            <Row at={{ x: c.x, y: c.y - 23 }} gap={9}>
              {f.sacks.map((pid) => (
                <SpiceSackGlyph key={pid} band={colorOf(game, pid)} s={1.05} />
              ))}
            </Row>
            <Row at={{ x: c.x, y: c.y + 23 }} gap={9}>
              {f.crews.map((pid) => (
                <CrewGlyph key={pid} color={colorOf(game, pid)} s={1.15} />
              ))}
            </Row>
            <text x={c.x} y={c.y + 37} textAnchor="middle" fontSize={6.5} fontWeight={800} fill="#fff4dc" opacity={0.9}>
              {EP_ABILITY_LABEL[f.ability].toUpperCase()}
            </text>
          </g>
        );
      })}

      {/* Pirate lairs on gold fields. */}
      {ep.lairs.map((l) => {
        const c = board.hexes[l.hex]!.center;
        const pending = l.captured && ep.pendingLairs.includes(l.hex);
        const showToken = !l.captured || pending;
        return (
          <g key={l.hex} className={`ep-lair${l.captured ? ' is-captured' : ''}`}>
            <title>
              {l.captured
                ? pending
                  ? 'Pirate lair captured! It is resolved when this Movement phase ends.'
                  : `Captured gold field: pays 2 gold per building on a ${board.hexes[l.hex]!.numberToken}.`
                : `Pirate lair — ${l.crews.length}/${EP_LAIR_CREWS} crews. The third crew captures it; nobody builds here until then.`}
            </title>
            {showToken && (
              <g transform={`translate(${c.x}, ${c.y})`}>
                <LairToken r={14} captured={pending} />
              </g>
            )}
            {pending && (
              <text x={c.x + 12} y={c.y - 10} fontSize={11} fontWeight={900} fill="#ffd54f" stroke="#1a1a1a" strokeWidth={2} paintOrder="stroke">
                ✓
              </text>
            )}
            <Row at={{ x: c.x, y: c.y + 25 }} gap={9}>
              {l.crews.map((pid, i) => (
                <CrewGlyph key={`${pid}${i}`} color={colorOf(game, pid)} s={1.15} />
              ))}
            </Row>
            {!l.captured && (
              <text x={c.x} y={c.y - 20} textAnchor="middle" fontSize={8} fontWeight={800} fill="#fff4c2" stroke="#3a2a00" strokeWidth={2} paintOrder="stroke">
                {l.crews.length}/{EP_LAIR_CREWS}
              </text>
            )}
          </g>
        );
      })}

      {/* Setup round 1: the marked intersections for harbor settlements. */}
      {game.phase === 'setupRound1' &&
        ep.harborSites.map((v) => {
          const p = board.vertices[v]!.position;
          const taken = game.players.some((pl) => pl.settlements.includes(v));
          if (taken) return null;
          return (
            <g key={v} className="ep-harbor-site" transform={`translate(${p.x}, ${p.y})`}>
              <circle r={6.5} fill="#2e7d32" stroke="#e8f5e9" strokeWidth={1.4} />
              <path d="M-3,0.2 L-0.8,2.6 L3.2,-2.4" fill="none" stroke="#fff" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
            </g>
          );
        })}
    </g>
  );
}

function FishSchool({ at }: { at: Pt }) {
  const fish = [
    { x: -9, y: -3, s: 1 },
    { x: 6, y: -6, s: 0.85 },
    { x: 2, y: 5, s: 0.95 },
  ];
  return (
    <g opacity={0.8}>
      {fish.map((f, i) => (
        <g key={i} transform={`translate(${at.x + f.x}, ${at.y + f.y}) scale(${f.s})`}>
          <path d="M-5,0 Q-1,-3.6 4,-0.6 Q-1,3.6 -5,0 Z" fill="#d9eef8" stroke="#1f4a66" strokeWidth={0.6} />
          <path d="M4,-0.6 L7,-2.6 L7,1.6 Z" fill="#d9eef8" stroke="#1f4a66" strokeWidth={0.5} />
          <circle cx={-2.6} cy={-0.5} r={0.6} fill="#1f4a66" />
        </g>
      ))}
    </g>
  );
}

// The Council of Catan: a small island with the council hall, and its two
// anchors at the hex's north and south corners (deliveries).
function CouncilIsland({ game }: { game: GameState }) {
  const ep = game.explorersPirates!;
  const hex = game.board.hexes[ep.councilHex];
  if (!hex) return null;
  const c = hex.center;
  return (
    <g className="ep-council">
      <title>
        The Council of Catan. A ship with an end on one of its anchors delivers fish hauls and spice sacks (one track space each).
      </title>
      <path
        d={`M${c.x - 26},${c.y + 6} Q${c.x - 30},${c.y - 14} ${c.x - 8},${c.y - 19} Q${c.x + 14},${c.y - 25} ${c.x + 27},${c.y - 6} Q${c.x + 32},${c.y + 14} ${c.x + 8},${c.y + 19} Q${c.x - 20},${c.y + 24} ${c.x - 26},${c.y + 6} Z`}
        fill="#e8d29a"
        stroke="#b99a5c"
        strokeWidth={1.4}
      />
      <path
        d={`M${c.x - 20},${c.y + 5} Q${c.x - 22},${c.y - 9} ${c.x - 6},${c.y - 13} Q${c.x + 10},${c.y - 17} ${c.x + 20},${c.y - 4} Q${c.x + 24},${c.y + 10} ${c.x + 6},${c.y + 13} Q${c.x - 16},${c.y + 17} ${c.x - 20},${c.y + 5} Z`}
        fill="#7fb35a"
        opacity={0.85}
      />
      {/* Council hall: pediment, columns, steps. */}
      <g transform={`translate(${c.x}, ${c.y + 1})`}>
        <path d="M-12,-5 L0,-13 L12,-5 Z" fill="#f4efe1" stroke="#5b4a2e" strokeWidth={1} strokeLinejoin="round" />
        <rect x={-11} y={-5} width={22} height={2} fill="#e6dfca" stroke="#5b4a2e" strokeWidth={0.7} />
        {[-8, -3, 2, 7].map((x) => (
          <rect key={x} x={x} y={-3} width={2} height={9} fill="#f4efe1" stroke="#5b4a2e" strokeWidth={0.5} />
        ))}
        <rect x={-13} y={6} width={26} height={2.6} fill="#e6dfca" stroke="#5b4a2e" strokeWidth={0.7} />
        <path d="M0,-13 L0,-19 L6,-17.4 L0,-15.8" fill="#c0392b" stroke="#5b4a2e" strokeWidth={0.5} />
      </g>
      {ep.councilAnchors.map((v) => {
        const p = game.board.vertices[v]!.position;
        return (
          <g key={v} transform={`translate(${p.x}, ${p.y})`}>
            <circle r={8} fill="#13324a" stroke="#f2d27a" strokeWidth={1.6} />
            <g stroke="#f2d27a" strokeWidth={1.3} fill="none" strokeLinecap="round">
              <circle cx={0} cy={-4} r={1.3} />
              <path d="M0,-2.7 L0,4.2" />
              <path d="M-2.6,-0.8 L2.6,-0.8" />
              <path d="M-4,1.6 Q-3.4,4.6 0,4.6 Q3.4,4.6 4,1.6" />
            </g>
          </g>
        );
      })}
    </g>
  );
}

// ----- Pieces -----

export function ExplorersPiratesPieces({ game }: { game: GameState }) {
  if (!isExplorersPirates(game)) return null;
  const ep = game.explorersPirates;
  const moving = ep.movement?.moving ?? null;
  const harbors: Array<{ v: VertexId; player: Player }> = [];
  for (const p of game.players) {
    for (const v of p.settlements) if (isHarbor(game, v)) harbors.push({ v, player: p });
  }
  return (
    <g className="ep-pieces" pointerEvents="none">
      {harbors.map(({ v, player }) => (
        <HarborPiece key={v} game={game} vertex={v} player={player} cargo={ep.harbors[v] ?? []} />
      ))}
      {ep.ships.map((s) => {
        const at = epShipSpot(game, s);
        const owner = game.players.find((p) => p.id === s.owner);
        if (!owner) return null;
        return (
          <g key={s.id} className={`ep-ship${s.id === moving ? ' is-moving' : ''}`} transform={`translate(${at.x}, ${at.y})`}>
            <title>
              {`${owner.name}'s ship${s.cargo.length ? ` carrying ${s.cargo.map((c) => EP_CARGO_LABEL[c]).join(' and ')}` : ' (empty)'}${s.id === moving ? ` — moving, ${ep.movement?.mp ?? 0} MP left` : ''}`}
            </title>
            {s.id === moving && (
              <ellipse cx={0} cy={-2} rx={15} ry={14} fill="#ffd54f" fillOpacity={0.18} stroke="#ffd54f" strokeWidth={1.6} strokeDasharray="3 2" />
            )}
            <EpShipFigure color={owner.color} cargo={s.cargo} />
          </g>
        );
      })}
      {ep.pirate &&
        (() => {
          const hex = game.board.hexes[ep.pirate.hex];
          if (!hex) return null;
          const owner = nameOf(game, ep.pirate.owner);
          return (
            <g className="ep-pirate" transform={`translate(${hex.center.x}, ${hex.center.y - 2})`}>
              <title>
                {`${owner}'s pirate ship. Other players' ships pay ${owner} 1 gold tribute to sail onto, off or along this hex (once per ship a turn); an unmoved ship next to it may try to chase it away.`}
              </title>
              <EpPirateFigure color={colorOf(game, ep.pirate.owner)} />
            </g>
          );
        })()}
    </g>
  );
}

function HarborPiece({
  game,
  vertex,
  player,
  cargo,
}: {
  game: GameState;
  vertex: VertexId;
  player: Player;
  cargo: readonly EpCargo[];
}) {
  const p = game.board.vertices[vertex]!.position;
  const out = seaward(game, vertex);
  const dock = { x: p.x + out.x * 19, y: p.y + out.y * 19 };
  return (
    <g className="ep-harbor">
      <title>
        {`${player.name}'s harbor settlement (2 VP)${cargo.length ? ` — storing ${cargo.map((c) => EP_CARGO_LABEL[c]).join(' and ')}` : ''}`}
      </title>
      <g transform={`translate(${p.x}, ${p.y})`}>
        <HarborSettlementFigure color={player.color} />
      </g>
      {cargo.length > 0 && (
        <g transform={`translate(${dock.x}, ${dock.y})`}>
          <rect x={cargo.length > 1 ? -11 : -7} y={-7} width={cargo.length > 1 ? 22 : 14} height={13} rx={4} fill="#13202b" fillOpacity={0.82} stroke="#f2d27a" strokeWidth={0.9} />
          {cargo.map((c, i) => (
            <g key={i} transform={`translate(${cargo.length > 1 ? (i === 0 ? -5.4 : 5.4) : 0}, -0.6)`}>
              <CargoGlyph piece={c} color={player.color} s={0.9} />
            </g>
          ))}
        </g>
      )}
    </g>
  );
}
