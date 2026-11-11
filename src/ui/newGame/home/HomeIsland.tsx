// The home screen's hero: a small island laid out tile by tile, with a
// beach, surf, harbors, a few players' pieces, the robber and a ship
// sailing round it. The dice in the corner roll for real: the hexes with
// that number light up and pay out a card, the buildings on them hop, and a
// 7 sends the robber somewhere new.

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
import { ResourceGlyph, TERRAIN_COLORS, TerrainArt } from './TerrainArt';
import { useReducedMotion } from './useReducedMotion';

const ORIGIN: Pt = { x: 0, y: 0 };
const delay = (s: number) => ({ '--d': `${s}s` }) as CSSProperties;
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
      <svg
        className="home-island"
        viewBox="-206 -196 412 392"
        role="img"
        aria-label="An island of hex tiles with settlements, roads and harbors, and a ship sailing around it"
      >
        <Defs />
        <circle cx={0} cy={4} r={200} fill="url(#home-shallow)" />
        <Coast />
        {HARBORS.map((h, k) => (
          <HarborMarker key={k} harbor={h} at={PIECES_AT - 0.3 + k * 0.06} />
        ))}
        <Ship reduced={reduced} />
        {ISLAND.map((_, i) => (
          <Tile key={i} i={i} />
        ))}
        {ROADS.map((r, k) => (
          <RoadSvg key={k} road={r} at={PIECES_AT + k * 0.07} />
        ))}
        {BUILDINGS.map((b, k) => (
          <BuildingSvg
            key={k}
            building={b}
            at={PIECES_AT + 0.35 + k * 0.09}
            collectId={result && BUILDING_HEXES[k]!.some((i) => producing.has(i)) ? result.id : null}
          />
        ))}
        <RobberSvg at={robber} bump={result && result.blocked !== null ? result.id : null} />
        {result && <Production key={result.id} result={result} />}
      </svg>

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

/** Shallows, surf and beach: unions of enlarged hexes, so they follow the jagged coast. */
function Coast() {
  return (
    <g>
      <g fill="#93e9ee" opacity={0.55}>
        {ISLAND.map((_, i) => (
          <polygon key={i} points={hexPoints(hexCenter(i), HEX + 17)} />
        ))}
      </g>
      <g fill="none" stroke="#ffffff" strokeWidth={2.2} strokeLinecap="round" opacity={0.85}>
        {COASTAL.map((i) => (
          <polygon key={i} className="home-foam" points={hexPoints(hexCenter(i), HEX + 10.5)} />
        ))}
      </g>
      <g fill="#f4dfa3">
        {ISLAND.map((_, i) => (
          <polygon key={i} points={hexPoints(hexCenter(i), HEX + 5.5)} />
        ))}
      </g>
    </g>
  );
}

function Tile({ i }: { i: number }) {
  const h = ISLAND[i]!;
  const c = hexCenter(i);
  const col = TERRAIN_COLORS[h.terrain];
  const d = dealDelay(i);
  return (
    <g transform={`translate(${c.x} ${c.y})`}>
      <g className="home-tile-drop" style={delay(d)}>
        <g className="home-tile">
          {/* Dark edging that shows in the seams between tiles; part of the tile,
              so the beach shows where tiles haven't landed yet. */}
          <polygon points={hexPoints(ORIGIN, HEX + 0.4)} fill="#3a2814" />
          <polygon points={hexPoints({ x: 0, y: 6 }, HEX - 0.8)} fill={col.side} />
          <polygon
            points={hexPoints(ORIGIN, HEX - 0.8)}
            fill={`url(#home-top-${h.terrain})`}
            stroke={col.dark}
            strokeWidth={0.8}
          />
          <polygon points={hexPoints(ORIGIN, HEX - 3.2)} fill="none" stroke="#fff" strokeOpacity={0.22} strokeWidth={1.4} />
          <TerrainArt terrain={h.terrain} seed={i} />
          {h.number !== null && (
            <g className="home-token-pop" style={delay(d + 0.42)}>
              <Token n={h.number} />
            </g>
          )}
        </g>
      </g>
    </g>
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

const SHIP_PATH = 'M 184 0 A 184 178 0 1 1 -184 0 A 184 178 0 1 1 184 0';

/** Seen from above (so it reads the same whichever way it's heading), bow towards +x. */
function Ship({ reduced }: { reduced: boolean }) {
  const art = (
    <g className="home-ship">
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
  if (reduced) return <g transform="translate(146 -112) rotate(128)">{art}</g>;
  return (
    <g>
      <animateMotion dur="90s" repeatCount="indefinite" rotate="auto" path={SHIP_PATH} />
      {art}
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
        {city && (
          <g transform="translate(1.6 -12)">
            {[0, 1.3, 2.6].map((d) => (
              <circle key={d} className="home-smoke" r={2.3} fill="#f6f3ec" style={delay(d)} />
            ))}
          </g>
        )}
      </g>
    </g>
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
