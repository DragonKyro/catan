import type { BoardState, CommodityLocation, GameState, VertexId } from '@/game/types';
import { hexPolygonPoints } from '../boardLayout';
import { BarbarianFigure } from './BarbarianAttackBoard';
import {
  CommodityToken,
  CommodityTokenBack,
  GOOD_LABEL,
  LOCATION_LABEL,
  PlayerWagonFigure,
  XMarker,
} from './TradersBarbariansArt';

// "Traders & Barbarians" scenario board art (rulebook pp. 20-23): the three
// commodity hexes (quarry, castle, glassworks) with their interior paths,
// centre plaza and "X" markers, each location's face-down token stack on
// the frame next to it, the barbarians standing on edges and the players'
// wagons on intersections. Pointer events are off — the overlay handles
// clicks.

type Pt = { x: number; y: number };

function at(c: Pt, angle: number, r: number): Pt {
  return { x: c.x + Math.cos(angle) * r, y: c.y + Math.sin(angle) * r };
}

// Direction from the hex centre toward its frame side (the mean of the X
// edges' midpoints): the motif and the token stack sit that way.
function frameAngle(board: BoardState, loc: CommodityLocation): number {
  const c = board.hexes[loc.hex]!.center;
  let dx = 0;
  let dy = 0;
  for (const e of loc.xEdges) {
    const [a, b] = board.edges[e]!.vertices.map((v) => board.vertices[v]!.position);
    dx += (a!.x + b!.x) / 2 - c.x;
    dy += (a!.y + b!.y) / 2 - c.y;
  }
  return Math.atan2(dy, dx);
}

// Drawn right after the hex tiles (under harbors, roads and pieces).
export function TradersBarbariansHexLayer({ game }: { game: GameState }) {
  const tb = game.tradersBarbarians;
  if (!tb) return null;
  return (
    <g className="tb-commodity-hexes" pointerEvents="none">
      {tb.locations.map((loc) => (
        <CommodityHex key={loc.id} board={game.board} loc={loc} />
      ))}
    </g>
  );
}

const GROUND: Record<CommodityLocation['id'], { base: string; dark: string; light: string }> = {
  quarry: { base: '#c86b3c', dark: '#a24f28', light: '#de8c58' },
  castle: { base: '#86b84f', dark: '#699a3a', light: '#a3cc6b' },
  glassworks: { base: '#4b8a44', dark: '#2f652e', light: '#64a35a' },
};

function CommodityHex({ board, loc }: { board: BoardState; loc: CommodityLocation }) {
  const hex = board.hexes[loc.hex];
  if (!hex) return null;
  const c = hex.center;
  const g = GROUND[loc.id];
  const away = frameAngle(board, loc);
  const motif = at(c, away, 21);
  const plaza = board.vertices[loc.plaza]?.position ?? c;
  // Ground texture blobs toward each edge midpoint (30° off every corner, so
  // never on a path).
  const blobs = Array.from({ length: 6 }, (_, i) => at(c, ((60 * i) * Math.PI) / 180, 31));
  const needs = loc.needs.map((n) => GOOD_LABEL[n].toLowerCase()).join(' and ');
  return (
    <g className={`tb-commodity tb-${loc.id}`}>
      <title>{`${LOCATION_LABEL[loc.id]} — buys ${needs}. Wagons entering the plaza end their move, deliver, and pick up the next token.`}</title>
      <polygon points={hexPolygonPoints(board, loc.hex)} fill={g.base} stroke="#1a1a1a40" strokeWidth={1.5} />
      {blobs.map((b, i) =>
        loc.id === 'glassworks' ? (
          <g key={i}>
            <circle cx={b.x} cy={b.y} r={6.6} fill={g.dark} />
            <circle cx={b.x - 1.4} cy={b.y - 1.6} r={3.6} fill={g.light} />
          </g>
        ) : loc.id === 'castle' ? (
          <path
            key={i}
            d={`M${b.x - 4},${b.y + 2} q2,-5 4,0 q2,-5 4,0`}
            fill="none"
            stroke={g.dark}
            strokeWidth={1.4}
            strokeLinecap="round"
          />
        ) : (
          <g key={i}>
            <path
              d={`M${b.x - 6},${b.y + 3} L${b.x - 2},${b.y - 4} L${b.x + 3},${b.y - 2} L${b.x + 6},${b.y + 3} Z`}
              fill={g.dark}
            />
            <path d={`M${b.x - 2},${b.y - 4} L${b.x},${b.y + 3}`} stroke={g.light} strokeWidth={0.9} />
          </g>
        ),
      )}
      {/* Interior paths, corner → plaza. */}
      {loc.paths.map((e) => {
        const [a, b] = board.edges[e]!.vertices.map((v) => board.vertices[v]!.position);
        return (
          <g key={e}>
            <line x1={a!.x} y1={a!.y} x2={b!.x} y2={b!.y} stroke="#8a6a3c" strokeWidth={7} strokeLinecap="round" />
            <line
              x1={a!.x}
              y1={a!.y}
              x2={b!.x}
              y2={b!.y}
              stroke="#ecdcae"
              strokeWidth={4.6}
              strokeLinecap="round"
              strokeDasharray="1 2.4"
              strokeOpacity={0.55}
            />
            <line x1={a!.x} y1={a!.y} x2={b!.x} y2={b!.y} stroke="#e6d39f" strokeWidth={4.4} strokeLinecap="round" strokeOpacity={0.8} />
          </g>
        );
      })}
      <g transform={`translate(${motif.x}, ${motif.y})`}>
        <LocationMotif id={loc.id} />
      </g>
      {/* The centre plaza. */}
      <g transform={`translate(${plaza.x}, ${plaza.y})`}>
        <circle r={9} fill="#f1e5c4" stroke="#6b5230" strokeWidth={1.3} />
        <circle r={6.2} fill="none" stroke="#b79d6a" strokeWidth={0.8} strokeDasharray="1.6 1.4" />
        <circle r={2} fill="#b79d6a" />
      </g>
      {loc.xEdges.map((e) => {
        const [a, b] = board.edges[e]!.vertices.map((v) => board.vertices[v]!.position);
        return <XMarker key={e} x={(a!.x + b!.x) / 2} y={(a!.y + b!.y) / 2} r={5} />;
      })}
      <StackMarker loc={loc} pos={at(c, away, 80)} />
    </g>
  );
}

// The location's picture on its frame side.
function LocationMotif({ id }: { id: CommodityLocation['id'] }) {
  if (id === 'quarry') {
    return (
      <g>
        {/* marble pit with a wooden crane */}
        <path d="M-14,2 Q-13,-9 -1,-9 Q13,-10 14,0 Q13,9 0,9 Q-13,10 -14,2 Z" fill="#efece4" stroke="#8d857a" strokeWidth={1} />
        <path d="M-9,-2 L-4,-5 L2,-3 M-6,4 L1,1 L8,3 M4,-6 L9,-3" fill="none" stroke="#b5ada0" strokeWidth={0.9} />
        <path d="M-3,6 L-3,-13 L8,-13 M-3,-9 L1,-13 M8,-13 L8,-6" fill="none" stroke="#5b3a1c" strokeWidth={1.4} strokeLinecap="round" />
        <rect x={6.6} y={-6} width={3} height={2.6} fill="#f5f3ef" stroke="#5b3a1c" strokeWidth={0.6} />
      </g>
    );
  }
  if (id === 'castle') {
    return (
      <g transform="scale(0.78)">
        <path d="M-17,10 L-17,-2 L17,-2 L17,10 Z" fill="#a08870" stroke="#3b2f25" strokeWidth={1} />
        <path d="M-17,-2 h4 v-2 h3 v2 h4 v-2 h3 v2 h4 v-2 h3 v2 h4 v-2 h3 v2 h3" fill="none" stroke="#3b2f25" strokeWidth={0.9} />
        <rect x={-7} y={-14} width={14} height={14} fill="#b59a7e" stroke="#3b2f25" strokeWidth={1} />
        <path d="M-9,-14 L0,-21 L9,-14 Z" fill="#c4452b" stroke="#5a1d12" strokeWidth={0.9} />
        <rect x={-19} y={-9} width={6} height={19} fill="#9c846b" stroke="#3b2f25" strokeWidth={1} />
        <path d="M-20.5,-9 L-16,-15 L-11.5,-9 Z" fill="#c4452b" stroke="#5a1d12" strokeWidth={0.8} />
        <rect x={13} y={-9} width={6} height={19} fill="#9c846b" stroke="#3b2f25" strokeWidth={1} />
        <path d="M11.5,-9 L16,-15 L20.5,-9 Z" fill="#c4452b" stroke="#5a1d12" strokeWidth={0.8} />
        <path d="M-3,10 L-3,4 Q0,1 3,4 L3,10 Z" fill="#3b2f25" />
        <rect x={-1.2} y={-10} width={2.4} height={3.4} fill="#3b2f25" />
        <line x1={0} y1={-21} x2={0} y2={-27} stroke="#3b2f25" strokeWidth={0.8} />
        <path d="M0,-27 L5,-25.5 L0,-24 Z" fill="#e53935" />
      </g>
    );
  }
  return (
    <g>
      {/* glass furnace: brick hut, chimney and smoke, a glowing mouth */}
      <circle cx={8} cy={-19} r={3} fill="#e7e7e7" opacity={0.8} />
      <circle cx={11} cy={-23} r={3.8} fill="#efefef" opacity={0.7} />
      <rect x={4.5} y={-16} width={5} height={10} fill="#8a3f2a" stroke="#3a180e" strokeWidth={0.9} />
      <path d="M-12,8 L-12,-4 L-1,-12 L10,-4 L10,8 Z" fill="#b65a3c" stroke="#3a180e" strokeWidth={1.1} strokeLinejoin="round" />
      <path d="M-12,-4 L-1,-12 L10,-4" fill="none" stroke="#6b2f1d" strokeWidth={2.2} strokeLinejoin="round" />
      <path d="M-5,8 L-5,2 Q-1,-2 3,2 L3,8 Z" fill="#ffb03b" stroke="#3a180e" strokeWidth={0.8} />
      <path d="M-3,8 L-3,4 Q-1,2 1,4 L1,8 Z" fill="#ff7a1a" />
      <path d="M-11,-1 h3 M-11,3 h3 M6,-1 h3 M6,3 h3" stroke="#7c3522" strokeWidth={0.7} />
      <g transform="translate(-14, 4)">
        <path d="M-2,-4 L2,-4 L2,-2 Q4,-1 4,2 Q4,5 0,5 Q-4,5 -4,2 Q-4,-1 -2,-2 Z" fill="#8fe0e8" stroke="#1f6b74" strokeWidth={0.7} />
      </g>
    </g>
  );
}

// The location's face-down stack on the frame, with the count left and the
// goods the location buys.
function StackMarker({ loc, pos }: { loc: CommodityLocation; pos: Pt }) {
  const left = loc.stack.length;
  const R = 11;
  const n = loc.needs.length;
  const pillW = 16 + n * 17;
  return (
    <g transform={`translate(${pos.x}, ${pos.y})`}>
      <title>{`${LOCATION_LABEL[loc.id]}: ${left} token${left === 1 ? '' : 's'} left in the stack; buys ${loc.needs.map((g) => GOOD_LABEL[g].toLowerCase()).join(' and ')}`}</title>
      {left > 0 ? (
        <>
          {left > 2 && (
            <g transform="translate(0, 5)">
              <CommodityTokenBack location={loc.id} r={R} />
            </g>
          )}
          {left > 1 && (
            <g transform="translate(0, 2.5)">
              <CommodityTokenBack location={loc.id} r={R} />
            </g>
          )}
          <CommodityTokenBack location={loc.id} r={R} />
        </>
      ) : (
        <circle r={R} fill="none" stroke="#ffffff90" strokeWidth={1.4} strokeDasharray="2.4 2" />
      )}
      <text
        x={R + 4}
        y={4}
        fontSize={11}
        fontWeight={800}
        fill="#fffbea"
        stroke="#1d2b38"
        strokeWidth={2.8}
        paintOrder="stroke fill"
      >
        {left}
      </text>
      {/* Buys: the goods this location takes. */}
      <g transform="translate(0, -24)">
        <rect x={-pillW / 2} y={-9} width={pillW} height={18} rx={9} fill="#fffbea" stroke="#2e7d32" strokeWidth={1.2} opacity={0.95} />
        <text x={-pillW / 2 + 7} y={3.6} fontSize={10} fontWeight={900} fill="#2e7d32" textAnchor="middle">
          ⇣
        </text>
        {loc.needs.map((g, i) => (
          <g key={g} transform={`translate(${-pillW / 2 + 21 + i * 17}, 0)`}>
            <CommodityToken good={g} r={7} />
          </g>
        ))}
      </g>
    </g>
  );
}

// Barbarians on edges and players' wagons on intersections, drawn above
// roads and buildings.
export function TradersBarbariansPieces({ game }: { game: GameState }) {
  const tb = game.tradersBarbarians;
  if (!tb) return null;
  const board = game.board;
  const byVertex = new Map<VertexId, string[]>();
  for (const pid of game.playerOrder) {
    const w = tb.wagons[pid];
    if (!w) continue;
    byVertex.set(w.vertex, [...(byVertex.get(w.vertex) ?? []), pid]);
  }
  return (
    <g className="tb-pieces" pointerEvents="none">
      {tb.barbarians.map((edge, i) => {
        const e = board.edges[edge];
        if (!e) return null;
        const [a, b] = e.vertices.map((v) => board.vertices[v]!.position);
        return (
          <g key={i} className="tb-barbarian">
            <BarbarianFigure x={(a!.x + b!.x) / 2} y={(a!.y + b!.y) / 2 - 5} scale={1.45} />
          </g>
        );
      })}
      {[...byVertex.entries()].map(([vertex, pids]) =>
        pids.map((pid, k) => {
          const p = game.players.find((pl) => pl.id === pid);
          const w = tb.wagons[pid]!;
          if (!p) return null;
          const pos = wagonSpot(game, vertex, k, pids.length);
          return (
            <g key={pid} transform={`translate(${pos.x}, ${pos.y})`} className="tb-wagon">
              <PlayerWagonFigure color={p.color} cargo={w.cargo?.good ?? null} scale={0.95} />
            </g>
          );
        }),
      )}
    </g>
  );
}

// Where a wagon on `vertex` is drawn: centred on a plaza; next to a corner
// otherwise, in the gap between its edges so the building there stays
// visible. Several wagons on one intersection fan out.
export function wagonSpot(game: GameState, vertex: VertexId, k = 0, n = 1): Pt {
  const board = game.board;
  const v = board.vertices[vertex];
  if (!v) return { x: 0, y: 0 };
  const isPlaza = game.tradersBarbarians?.locations.some((l) => l.plaza === vertex) ?? false;
  const fan = (k - (n - 1) / 2) * 15;
  if (isPlaza) return { x: v.position.x + fan, y: v.position.y + 1 };
  const goesDown = v.neighborVertices.some((nv) => {
    const p = board.vertices[nv]!.position;
    return Math.abs(p.x - v.position.x) < 1 && p.y > v.position.y;
  });
  const base = goesDown ? { x: 14, y: 6 } : { x: 0, y: 15 };
  return { x: v.position.x + base.x + fan, y: v.position.y + base.y };
}
