// The home screen's hero: a small island laid out tile by tile, with a
// beach, surf, harbors, a few players' pieces, the robber and a ship
// sailing round it. The dice in the corner roll for real: the hexes with
// that number light up and pay out a card, the buildings on them hop, and a
// 7 sends the robber somewhere new.
//
// Drawn as a stack of layers sharing one coordinate system (the island's
// user units, VB below), so the motion stays off the main thread. Anything
// animated inside an SVG repaints that whole SVG every frame, so the still
// drawing (sea, beach and harbors, pieces) sits in SVGs that never change,
// and everything that keeps moving or arrives (each tile with its landing
// and hover lift, the sheep and wheat on it, its number token, the surf, the
// ship, the chimney smoke) is its own small box animating only transform /
// opacity, which the compositor runs. Boxes are placed in percentages of
// their parent box, which always has its coordinates' shape (.home-island is
// the island's, a tile's box its own), so they line up at any size and in
// browsers without container units (iOS before 16). Only the pieces' arrival
// and the dice roll's brief effects (glow, cards, hops) still repaint.

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { PLAYER_COLOR_HEX } from '@/ui/shared/playerColors';
import {
  BUILDINGS,
  DESERT_INDEX,
  HARBORS,
  HEX,
  ISLAND,
  ROADS,
  axialToPixel,
  corner,
  cornerOf,
  dealDelay,
  hexCenter,
  hexPoints,
  hexesAtCorner,
  pips,
  type Building,
  type Harbor,
  type HomeTerrain,
  type Pt,
  type RoadPiece,
} from './island';
import { FX_BOX, ResourceGlyph, TERRAIN_COLORS, TerrainArt, TerrainFxArt, terrainFx, type TerrainFx } from './TerrainArt';
import { useReducedMotion } from './useReducedMotion';

const ORIGIN: Pt = { x: 0, y: 0 };
const delay = (s: number) => ({ '--d': `${s}s` }) as CSSProperties;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The scene's user units: every layer and box is placed in these. */
const VB: Box = { x: -206, y: -196, w: 412, h: 392 };
const VIEWBOX = `${VB.x} ${VB.y} ${VB.w} ${VB.h}`;
const pct = (f: number) => `${+(f * 100).toFixed(4)}%`;

const viewBox = (b: Box) => `${b.x} ${b.y} ${b.w} ${b.h}`;

/**
 * Style for a box drawn in its own coordinates `b`, scaled by `s`, with its
 * own origin placed at `at` in its parent's coordinates (the parent box
 * being `parent`, in the same units). It transforms about `pivot` (its own
 * coordinates; default its origin).
 */
function place(b: Box, at: Pt, parent: Box, s = 1, pivot: Pt = ORIGIN): CSSProperties {
  return {
    left: pct((at.x + b.x * s - parent.x) / parent.w),
    top: pct((at.y + b.y * s - parent.y) / parent.h),
    width: pct((b.w * s) / parent.w),
    height: pct((b.h * s) / parent.h),
    transformOrigin: `${pct((pivot.x - b.x) / b.w)} ${pct((pivot.y - b.y) / b.h)}`,
  };
}
const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

const RING = (i: number) => {
  const h = ISLAND[i]!;
  return Math.max(Math.abs(h.q), Math.abs(h.r), Math.abs(h.q + h.r));
};
const COASTAL = ISLAND.map((_, i) => i).filter((i) => RING(i) === 2);
const LAST_TILE = Math.max(...ISLAND.map((_, i) => dealDelay(i)));
/** When the pieces start arriving, once every tile and token is down. */
const PIECES_AT = LAST_TILE + 0.75;
const BUILDING_HEXES = BUILDINGS.map((b) => hexesAtCorner(b.hex, b.corner));
const buildingAt = (k: number) => PIECES_AT + 0.35 + k * 0.09;

const RESOURCE: Record<HomeTerrain, string> = {
  wood: 'wood',
  brick: 'brick',
  sheep: 'sheep',
  wheat: 'wheat',
  ore: 'ore',
  desert: '',
};

interface RollResult {
  id: number;
  total: number;
  /** Hexes that pay out (the number, minus the robber's hex). */
  producing: number[];
  /** The robber's hex, when it has the number. */
  blocked: number | null;
}

function rollNote(r: RollResult): string {
  if (r.total === 7) return 'Seven! The robber moves.';
  const names = [...new Set(r.producing.map((i) => RESOURCE[ISLAND[i]!.terrain]))];
  if (names.length === 0) return `${r.total}: the robber blocks it!`;
  return `${r.total}: ${names.join(' & ')}!`;
}

export function HomeIsland() {
  const reduced = useReducedMotion();
  const [dice, setDice] = useState<[number, number]>([2, 4]);
  const [rolling, setRolling] = useState(false);
  const [rolled, setRolled] = useState(false);
  const [robber, setRobber] = useState(DESERT_INDEX);
  const [result, setResult] = useState<RollResult | null>(null);
  const timeouts = useRef<number[]>([]);
  const flicker = useRef<number | null>(null);
  const nextId = useRef(0);

  useEffect(
    () => () => {
      timeouts.current.forEach((t) => window.clearTimeout(t));
      if (flicker.current !== null) window.clearInterval(flicker.current);
    },
    [],
  );

  const later = (fn: () => void, ms: number) => {
    timeouts.current.push(window.setTimeout(fn, ms));
  };

  const roll = () => {
    if (rolling) return;
    const face = () => 1 + Math.floor(Math.random() * 6);
    const a = face();
    const b = face();
    const settle = () => {
      setDice([a, b]);
      setRolling(false);
      setRolled(true);
      const total = a + b;
      const id = ++nextId.current;
      if (total === 7) {
        const options = ISLAND.map((_, i) => i).filter((i) => i !== robber);
        setRobber(options[Math.floor(Math.random() * options.length)]!);
        setResult({ id, total, producing: [], blocked: null });
      } else {
        const hit = ISLAND.map((h, i) => (h.number === total ? i : -1)).filter((i) => i >= 0);
        setResult({
          id,
          total,
          producing: hit.filter((i) => i !== robber),
          blocked: hit.includes(robber) ? robber : null,
        });
      }
      later(() => setResult((r) => (r && r.id === id ? null : r)), 2800);
    };
    if (reduced) {
      settle();
      return;
    }
    setRolling(true);
    flicker.current = window.setInterval(() => setDice([face(), face()]), 85);
    later(() => {
      if (flicker.current !== null) window.clearInterval(flicker.current);
      flicker.current = null;
      settle();
    }, 720);
  };

  const producing = new Set(result?.producing ?? []);

  return (
    <div className="home-scene">
      <div
        className="home-island"
        role="img"
        aria-label="An island of hex tiles with settlements, roads and harbors, and a ship sailing around it"
      >
        <svg className="home-layer home-layer-base" viewBox={VIEWBOX} aria-hidden>
          <Defs />
          <circle cx={0} cy={4} r={200} fill="url(#home-shallow)" />
          <Shallows />
        </svg>
        <Surf phase="a" />
        <Surf phase="b" />
        <svg className="home-layer" viewBox={VIEWBOX} aria-hidden>
          <Beach />
          {HARBORS.map((h, k) => (
            <HarborMarker key={k} harbor={h} at={PIECES_AT - 0.3 + k * 0.06} />
          ))}
        </svg>
        <ShipOrbit />
        {ISLAND.map((_, i) => (
          <Tile key={i} i={i} />
        ))}
        <svg className="home-layer" viewBox={VIEWBOX} aria-hidden>
          {ROADS.map((r, k) => (
            <RoadSvg key={k} road={r} at={PIECES_AT + k * 0.07} />
          ))}
          {BUILDINGS.map((b, k) => (
            <BuildingSvg
              key={k}
              building={b}
              at={buildingAt(k)}
              collectId={result && BUILDING_HEXES[k]!.some((i) => producing.has(i)) ? result.id : null}
            />
          ))}
          <RobberSvg at={robber} bump={result && result.blocked !== null ? result.id : null} />
          {result && <Production key={result.id} result={result} />}
        </svg>
        {BUILDINGS.map((b, k) => (b.kind === 'city' ? <ChimneySmoke key={k} building={b} at={buildingAt(k)} /> : null))}
      </div>

      <button
        type="button"
        className={`home-dice${rolling ? ' is-rolling' : ''}${rolled ? ' was-rolled' : ''}`}
        onClick={roll}
        aria-label={`Roll the dice (showing ${dice[0]} and ${dice[1]})`}
      >
        <Die value={dice[0]} tone="ivory" />
        <Die value={dice[1]} tone="red" />
      </button>
      {!rolled && (
        <span className="home-dice-hint" aria-hidden>
          Roll the dice!
        </span>
      )}
      <p className="home-roll-note" aria-live="polite">
        {result && <span key={result.id}>{rollNote(result)}</span>}
      </p>
    </div>
  );
}

function Defs() {
  return (
    <defs>
      {(Object.keys(TERRAIN_COLORS) as HomeTerrain[]).map((t) => (
        <linearGradient key={t} id={`home-top-${t}`} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor={TERRAIN_COLORS[t].light} />
          <stop offset="0.55" stopColor={TERRAIN_COLORS[t].base} />
          <stop offset="1" stopColor={TERRAIN_COLORS[t].dark} />
        </linearGradient>
      ))}
      <radialGradient id="home-shallow">
        <stop offset="0.5" stopColor="#8be8ee" stopOpacity="0.6" />
        <stop offset="1" stopColor="#8be8ee" stopOpacity="0" />
      </radialGradient>
      <clipPath id="home-hexclip">
        <polygon points={hexPoints(ORIGIN, HEX - 0.8)} />
      </clipPath>
    </defs>
  );
}

// Shallows, surf and beach: unions of enlarged hexes, so they follow the jagged coast.

function Shallows() {
  return (
    <g fill="#93e9ee" opacity={0.55}>
      {ISLAND.map((_, i) => (
        <polygon key={i} points={hexPoints(hexCenter(i), HEX + 17)} />
      ))}
    </g>
  );
}

function Beach() {
  return (
    <g fill="#f4dfa3">
      {ISLAND.map((_, i) => (
        <polygon key={i} points={hexPoints(hexCenter(i), HEX + 5.5)} />
      ))}
    </g>
  );
}

const SURF_SIZE = HEX + 10.5;
/** Bounds of the surf line, plus its stroke. */
const SURF_BOX: Box = (() => {
  const pts = COASTAL.flatMap((i) => [0, 1, 2, 3, 4, 5].map((k) => corner(hexCenter(i), SURF_SIZE, k)));
  const x = Math.floor(Math.min(...pts.map((p) => p.x)) - 2);
  const y = Math.floor(Math.min(...pts.map((p) => p.y)) - 2);
  const right = Math.ceil(Math.max(...pts.map((p) => p.x)) + 2);
  const bottom = Math.ceil(Math.max(...pts.map((p) => p.y)) + 2);
  return { x, y, w: right - x, h: bottom - y };
})();

/**
 * The surf line round the beach. Two of them lap in and out of phase (the
 * second with its dashes in the first's gaps), so the surf seems to wash
 * along the coast while each layer only scales and fades.
 */
function Surf({ phase }: { phase: 'a' | 'b' }) {
  return (
    <svg
      className={`home-surf home-surf-${phase}`}
      viewBox={viewBox(SURF_BOX)}
      style={place(SURF_BOX, ORIGIN, VB)}
      aria-hidden
    >
      <g
        fill="none"
        stroke="#ffffff"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeDasharray="7 10"
        strokeDashoffset={phase === 'b' ? 8.5 : 0}
      >
        {COASTAL.map((i) => (
          <polygon key={i} points={hexPoints(hexCenter(i), SURF_SIZE)} />
        ))}
      </g>
    </svg>
  );
}

/**
 * A tile's box in hex-local units: the edging, and the thickness showing
 * below it. (Its drop-in and hover lift in HomeMenu.css are percentages of
 * its height, 78.)
 */
const TILE_BOX: Box = { x: -31, y: -36, w: 62, h: 78 };
/** The number token with its shadow (Token draws it 1 unit low). */
const TOKEN_BOX: Box = { x: -13, y: -12, w: 26, h: 27 };

/**
 * One tile: its own box, which lands and lifts on hover; the sheep or wheat
 * on it and then its token ride along on top as boxes of their own. Only the
 * tile's hex takes the pointer, so a hover means the hex itself.
 */
function Tile({ i }: { i: number }) {
  const h = ISLAND[i]!;
  const c = hexCenter(i);
  const col = TERRAIN_COLORS[h.terrain];
  const d = dealDelay(i);
  return (
    <div className="home-tile" style={{ ...place(TILE_BOX, c, VB), ...delay(d) }}>
      <svg className="home-tile-art" viewBox={viewBox(TILE_BOX)} aria-hidden>
        {/* Dark edging that shows in the seams between tiles; part of the tile,
            so the beach shows where tiles haven't landed yet. */}
        <polygon className="home-tile-hit" points={hexPoints(ORIGIN, HEX + 0.4)} fill="#3a2814" />
        <polygon points={hexPoints({ x: 0, y: 6 }, HEX - 0.8)} fill={col.side} />
        <polygon
          points={hexPoints(ORIGIN, HEX - 0.8)}
          fill={`url(#home-top-${h.terrain})`}
          stroke={col.dark}
          strokeWidth={0.8}
        />
        <polygon points={hexPoints(ORIGIN, HEX - 3.2)} fill="none" stroke="#fff" strokeOpacity={0.22} strokeWidth={1.4} />
        <TerrainArt terrain={h.terrain} seed={i} />
      </svg>
      {terrainFx(h.terrain, i).map((fx, k) => (
        <TileFx key={k} fx={fx} />
      ))}
      {h.number !== null && (
        <svg
          className="home-token-pop"
          viewBox={viewBox(TOKEN_BOX)}
          style={{ ...place(TOKEN_BOX, ORIGIN, TILE_BOX, 1, { x: 0, y: 1 }), ...delay(d + 0.42) }}
          aria-hidden
        >
          <Token n={h.number} />
        </svg>
      )}
    </div>
  );
}

/** A hopping sheep or a swaying sheaf, in its own box on its tile. */
function TileFx({ fx }: { fx: TerrainFx }) {
  const b = FX_BOX[fx.kind];
  return (
    <svg
      className={`home-fx ${fx.kind === 'sheep' ? 'home-hop' : 'home-sway'}`}
      viewBox={viewBox(b)}
      style={{ ...place(b, fx, TILE_BOX, fx.s, { x: b.px, y: b.py }), ...delay(fx.d) }}
      aria-hidden
    >
      <TerrainFxArt fx={fx} />
    </svg>
  );
}

function Token({ n }: { n: number }) {
  const hot = n === 6 || n === 8;
  const count = pips(n);
  return (
    <g transform="translate(0 1)">
      <circle cx={0.8} cy={2} r={11.6} fill="#000" opacity={0.22} />
      <circle r={11.5} fill="#f8f0d4" stroke="#5a4426" strokeWidth={1.1} />
      <circle r={9.4} fill="none" stroke="#e2d4a8" strokeWidth={0.7} />
      <text
        y={hot ? 3.6 : 3.2}
        textAnchor="middle"
        fontSize={hot ? 11.5 : 10.5}
        fontWeight={800}
        fill={hot ? '#c9302c' : '#2b2015'}
        className="home-token-num"
      >
        {n}
      </text>
      {Array.from({ length: count }, (_, k) => (
        <circle key={k} cx={(k - (count - 1) / 2) * 2.3} cy={7} r={0.85} fill={hot ? '#c9302c' : '#2b2015'} />
      ))}
    </g>
  );
}

function HarborMarker({ harbor, at }: { harbor: Harbor; at: number }) {
  const c = axialToPixel(harbor.hex[0], harbor.hex[1]);
  const a = corner(c, HEX, harbor.from);
  const b = corner(c, HEX, harbor.from + 1);
  const m = lerp(a, b, 0.5);
  const len = Math.hypot(m.x - c.x, m.y - c.y);
  const n = { x: (m.x - c.x) / len, y: (m.y - c.y) / len };
  const disc = { x: m.x + n.x * 15, y: m.y + n.y * 15 };
  const plank = (from: Pt) => {
    const p = lerp(from, disc, 0.1);
    const q = lerp(from, disc, 0.62);
    return (
      <g>
        <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="#6b4423" strokeWidth={3.4} strokeLinecap="round" />
        <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="#b9854f" strokeWidth={1.4} strokeLinecap="round" />
      </g>
    );
  };
  return (
    <g>
      {plank(a)}
      {plank(b)}
      <g transform={`translate(${disc.x} ${disc.y})`}>
        <g className="home-piece" style={delay(at)}>
          <circle cx={0.8} cy={1.6} r={9.5} fill="#06325a" opacity={0.25} />
          <circle r={9.5} fill="#f8f0d4" stroke="#5a4426" strokeWidth={1.1} />
          {harbor.kind === 'any' ? (
            <text y={2.8} textAnchor="middle" fontSize={7.6} fontWeight={800} fill="#2b2015" className="home-token-num">
              3:1
            </text>
          ) : (
            <>
              <circle cy={-1.8} r={5.4} fill={TERRAIN_COLORS[harbor.kind].base} />
              <g transform="translate(0 -1.8) scale(0.8)">
                <ResourceGlyph terrain={harbor.kind} />
              </g>
              <text y={7.4} textAnchor="middle" fontSize={4.6} fontWeight={800} fill="#2b2015" className="home-token-num">
                2:1
              </text>
            </>
          )}
        </g>
      </g>
    </g>
  );
}

/** How far out the ship sails, clear of the harbors. */
const SHIP_ORBIT = 181;
/** The ship's box: its art turned bow-down, the way it heads at the orbit's 3 o'clock. */
const SHIP_BOX: Box = { x: -13, y: -34, w: 26, h: 52 };

/**
 * The ship sails clockwise round the island: the whole layer turns about
 * the island's centre (so the bow always points along the course) and the
 * ship's own box rocks. Both are compositor-only rotations.
 */
function ShipOrbit() {
  return (
    <div className="home-ship-orbit" aria-hidden>
      <svg className="home-ship" viewBox={viewBox(SHIP_BOX)} style={place(SHIP_BOX, { x: SHIP_ORBIT, y: 0 }, VB)}>
        <g transform="rotate(90)">
          <ShipArt />
        </g>
      </svg>
    </div>
  );
}

/** Seen from above (so it reads the same whichever way it's heading), bow towards +x. */
function ShipArt() {
  return (
    <g>
      <path d="M-12,-3.5 L-32,-10 M-12,3.5 L-32,10" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" opacity={0.55} />
      <ellipse cx={1.5} cy={4} rx={15} ry={6} fill="#06325a" opacity={0.22} />
      <path d="M15,0 C9,-6.8 -6,-6.8 -12,-5.2 L-12,5.2 C-6,6.8 9,6.8 15,0 Z" fill="#7a4a24" stroke="#3d220d" strokeWidth={1} />
      <path d="M12,0 C7,-4.4 -5,-4.6 -9.6,-3.5 L-9.6,3.5 C-5,4.6 7,4.4 12,0 Z" fill="#b07a45" />
      <path d="M-6,-3.6 L-6,3.6 M0,-4 L0,4 M6,-3.4 L6,3.4" stroke="#8a5a2c" strokeWidth={0.6} />
      <path d="M-11.5,0 L-17,-2.6 L-17,2.6 Z" fill={PLAYER_COLOR_HEX.red} stroke="#3d220d" strokeWidth={0.5} />
      <path d="M1.2,-11.5 Q8,0 1.2,11.5 L-1.4,11.5 Q4.2,0 -1.4,-11.5 Z" fill="#fffaf0" stroke="#bdb196" strokeWidth={0.6} />
      <circle cx={-1} cy={0} r={1.5} fill="#3d220d" />
    </g>
  );
}

function RoadSvg({ road, at }: { road: RoadPiece; at: number }) {
  const a = cornerOf(road.hex, road.from);
  const b = cornerOf(road.hex, road.from + 1);
  const p = lerp(a, b, 0.17);
  const q = lerp(a, b, 0.83);
  const line = { x1: p.x, y1: p.y, x2: q.x, y2: q.y, strokeLinecap: 'round' as const };
  return (
    <g className="home-piece" style={delay(at)}>
      <line {...line} stroke="#000" strokeOpacity={0.25} strokeWidth={7} transform="translate(1 2.2)" />
      <line {...line} stroke="#1a1a1a" strokeWidth={6.6} />
      <line {...line} stroke={PLAYER_COLOR_HEX[road.color]} strokeWidth={4.4} />
    </g>
  );
}

const SETTLEMENT_D = 'M-7,5 L-7,-2 L0,-7 L7,-2 L7,5 Z';
const SETTLEMENT_LIT = 'M-7,5 L-7,-2 L0,-7 L0,5 Z';
const CITY_D = 'M-10,8 L-10,-4 L-3,-4 L-3,-9 L4,-9 L4,-4 L10,-4 L10,8 Z';
const CITY_LIT = 'M-10,8 L-10,-4 L-3,-4 L-3,-9 L0.5,-9 L0.5,8 Z';

function BuildingSvg({ building, at, collectId }: { building: Building; at: number; collectId: number | null }) {
  const p = cornerOf(building.hex, building.corner);
  const city = building.kind === 'city';
  const s = city ? 1.05 : 1.25;
  const body = (
    <g transform={`scale(${s})`}>
      <path d={city ? CITY_D : SETTLEMENT_D} fill={PLAYER_COLOR_HEX[building.color]} stroke="#1a1a1a" strokeWidth={1.2} strokeLinejoin="round" />
      <path d={city ? CITY_LIT : SETTLEMENT_LIT} fill="#fff" opacity={0.2} />
      {city ? (
        <g fill="#1a1a1a" opacity={0.45}>
          <rect x={-0.9} y={-6.5} width={1.8} height={2.4} rx={0.4} />
          <rect x={-7.5} y={0} width={2.4} height={3} rx={0.4} />
          <rect x={5} y={0} width={2.4} height={3} rx={0.4} />
        </g>
      ) : (
        <rect x={-1.5} y={0.5} width={3} height={4.5} rx={0.6} fill="#1a1a1a" opacity={0.45} />
      )}
    </g>
  );
  return (
    <g transform={`translate(${p.x} ${p.y})`}>
      <g className="home-piece" style={delay(at)}>
        <ellipse cx={1.6} cy={city ? 8.6 : 6.4} rx={city ? 11.5 : 9} ry={3.1} fill="#000" opacity={0.28} />
        <g key={collectId ?? 'idle'} className={collectId !== null ? 'home-collect' : undefined}>
          {body}
        </g>
      </g>
    </g>
  );
}

/** A smoke puff's box (its rise in HomeMenu.css is in percentages of its 4.6 units). */
const PUFF: Box = { x: -2.3, y: -2.3, w: 4.6, h: 4.6 };

/** A city's chimney smoke: three puffs, each its own box, arriving with the city. */
function ChimneySmoke({ building, at }: { building: Building; at: number }) {
  const p = cornerOf(building.hex, building.corner);
  const vent = { x: p.x + 1.6, y: p.y - 12 };
  return (
    <div className="home-smoke-stack" style={delay(at)} aria-hidden>
      {[0, 1.3, 2.6].map((d) => (
        <span key={d} className="home-smoke" style={{ ...place(PUFF, vent, VB), ...delay(d) }} />
      ))}
    </div>
  );
}

function RobberSvg({ at, bump }: { at: number; bump: number | null }) {
  const c = hexCenter(at);
  return (
    <g className="home-robber" style={{ transform: `translate(${c.x}px, ${c.y - 3}px)` }}>
      <g className="home-piece" style={delay(PIECES_AT + 0.9)}>
        <g key={`${at}-${bump ?? ''}`} className="home-robber-hop">
          <ellipse cx={1} cy={11} rx={8.5} ry={3} fill="#000" opacity={0.3} />
          <path d="M0,-12 C5,-12 8,-8 8,-3 L8,8 L-8,8 L-8,-3 C-8,-8 -5,-12 0,-12 Z" fill="#1d1b1f" stroke="#fefefe" strokeWidth={1} />
          <path d="M0,-11.5 C-4.5,-11.5 -7.4,-8 -7.4,-3 L-7.4,7.4 L-3.4,7.4 L-3.4,-3 C-3.4,-7.6 -1.6,-10.8 0,-11.5 Z" fill="#fff" opacity={0.13} />
          <circle cx={0} cy={-4} r={2.2} fill="#fefefe" />
        </g>
      </g>
    </g>
  );
}

function Production({ result }: { result: RollResult }) {
  return (
    <g pointerEvents="none">
      {result.producing.map((i) => {
        const c = hexCenter(i);
        const terrain = ISLAND[i]!.terrain;
        return (
          <g key={i} transform={`translate(${c.x} ${c.y})`}>
            <polygon className="home-glow" points={hexPoints(ORIGIN, HEX - 2.4)} />
            <g transform="translate(0 -16)">
              <g className="home-card">
                <rect x={-7.5} y={-10} width={15} height={20} rx={2.4} fill="#fffaf0" stroke="#5a4426" strokeWidth={0.9} />
                <rect x={-5.8} y={-8.3} width={11.6} height={16.6} rx={1.5} fill={TERRAIN_COLORS[terrain].base} />
                <g transform="scale(1.2)">
                  <ResourceGlyph terrain={terrain} />
                </g>
              </g>
            </g>
          </g>
        );
      })}
    </g>
  );
}

const PIP_SPOTS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};

function Die({ value, tone }: { value: number; tone: 'ivory' | 'red' }) {
  const red = tone === 'red';
  return (
    <svg className="home-die" viewBox="-20 -20 40 40" aria-hidden>
      <rect x={-17} y={-14} width={34} height={33} rx={8} fill={red ? '#9a231e' : '#bfae7c'} />
      <rect x={-17} y={-17} width={34} height={33} rx={8} fill={red ? '#e5463d' : '#fffaf0'} />
      <rect x={-14} y={-15} width={28} height={8} rx={4} fill="#fff" opacity={0.22} />
      {PIP_SPOTS[value]!.map(([x, y], k) => (
        <circle key={k} cx={x * 8.6} cy={y * 8.6 - 1} r={3.3} fill={red ? '#fff7ec' : '#2b2015'} />
      ))}
    </svg>
  );
}
