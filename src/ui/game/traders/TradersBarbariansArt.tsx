import type { CommodityGood, CommodityLocationId, PlayerColor } from '@/game/types';
import { PLAYER_COLOR_HEX } from '@/ui/shared/playerColors';

// Art for the "Traders & Barbarians" scenario: the four commodity tokens,
// the location glyphs, the "X" marker and the players' covered wagons. Each
// piece is drawn around (0, 0) in board units so the board can place it with
// a transform; the *Svg wrappers size one for HTML panels.

export const GOOD_LABEL: Record<CommodityGood, string> = {
  sand: 'Sand',
  marble: 'Marble',
  tools: 'Tools',
  glass: 'Glass',
};

export const LOCATION_LABEL: Record<CommodityLocationId, string> = {
  quarry: 'Quarry',
  castle: 'Castle',
  glassworks: 'Glassworks',
};

// Token backs show where the stack lies (rulebook: "the location shown on
// the back of the tokens").
export const LOCATION_BACK: Record<CommodityLocationId, { fill: string; edge: string }> = {
  quarry: { fill: '#c7643a', edge: '#6d2d14' },
  castle: { fill: '#7cad48', edge: '#35561c' },
  glassworks: { fill: '#3b7a43', edge: '#1b3d20' },
};

const TOKEN_FACE: Record<CommodityGood, { fill: string; edge: string }> = {
  sand: { fill: '#f6e6b6', edge: '#9c7a33' },
  marble: { fill: '#f2f3f4', edge: '#6d7378' },
  tools: { fill: '#e2d4c4', edge: '#6b4a2b' },
  glass: { fill: '#d5f1f2', edge: '#2d7c86' },
};

function hexPoints(r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 90);
    pts.push(`${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}

// The picture on a token face, in a ±8 box.
function GoodMotif({ good }: { good: CommodityGood }) {
  switch (good) {
    case 'sand':
      return (
        <g>
          <path d="M-7,4.5 Q-3.5,-4.5 0,-4 Q3.5,-4.5 7,4.5 Z" fill="#dcb460" stroke="#8a6524" strokeWidth={0.8} />
          <circle cx={-2.5} cy={1} r={0.6} fill="#8a6524" />
          <circle cx={1.5} cy={-1} r={0.6} fill="#8a6524" />
          <circle cx={3} cy={2.4} r={0.6} fill="#8a6524" />
          <circle cx={-0.5} cy={3} r={0.6} fill="#8a6524" />
        </g>
      );
    case 'marble':
      return (
        <g>
          <path d="M-6,-1.5 L-1.5,-4.5 L6,-2.5 L6,3.5 L1.5,5.5 L-6,3.5 Z" fill="#ffffff" stroke="#5f666b" strokeWidth={0.8} strokeLinejoin="round" />
          <path d="M-6,-1.5 L1.5,0.5 L6,-2.5 M1.5,0.5 L1.5,5.5" fill="none" stroke="#5f666b" strokeWidth={0.7} />
          <path d="M-4.5,1 Q-2,0.6 -1,3 M3,-1.5 Q4,0.5 3.5,2.5" fill="none" stroke="#9aa3a8" strokeWidth={0.5} />
        </g>
      );
    case 'tools':
      return (
        <g>
          {/* hammer */}
          <path d="M-5.5,5.5 L2,-2" stroke="#8a5a2b" strokeWidth={1.8} strokeLinecap="round" />
          <path d="M-0.6,-5.6 L4.6,-0.4 L2.8,1.4 L-2.4,-3.8 Z" fill="#7a8288" stroke="#30363a" strokeWidth={0.7} strokeLinejoin="round" />
          {/* chisel */}
          <path d="M5.5,5.5 L-1.5,-1.5" stroke="#4d5358" strokeWidth={1.3} strokeLinecap="round" />
          <path d="M5.5,5.5 L3,3" stroke="#c48a3a" strokeWidth={2.2} strokeLinecap="round" />
        </g>
      );
    case 'glass':
      return (
        <g>
          <path
            d="M-1.6,-6 L1.6,-6 L1.6,-3.4 Q5,-2 5,1.8 Q5,6 0,6 Q-5,6 -5,1.8 Q-5,-2 -1.6,-3.4 Z"
            fill="#7fd0d8"
            stroke="#1f6b74"
            strokeWidth={0.8}
            strokeLinejoin="round"
          />
          <path d="M-2.8,0 Q-2.6,-1.6 -1.2,-2.2" fill="none" stroke="#ffffff" strokeWidth={0.9} strokeLinecap="round" />
          <rect x={-2.2} y={-7} width={4.4} height={1.4} rx={0.5} fill="#1f6b74" />
        </g>
      );
  }
}

// A commodity token (face up), hexagonal like the cardboard tokens.
export function CommodityToken({ good, r = 7 }: { good: CommodityGood; r?: number }) {
  const f = TOKEN_FACE[good];
  return (
    <g>
      <polygon points={hexPoints(r)} fill={f.fill} stroke={f.edge} strokeWidth={r * 0.13} strokeLinejoin="round" />
      <g transform={`scale(${(r / 10).toFixed(3)})`}>
        <GoodMotif good={good} />
      </g>
    </g>
  );
}

// A face-down token: the location's colour with its glyph.
export function CommodityTokenBack({ location, r = 7 }: { location: CommodityLocationId; r?: number }) {
  const b = LOCATION_BACK[location];
  return (
    <g>
      <polygon points={hexPoints(r)} fill={b.fill} stroke={b.edge} strokeWidth={r * 0.13} strokeLinejoin="round" />
      <g transform={`scale(${(r / 13).toFixed(3)})`}>
        <LocationGlyph location={location} light />
      </g>
    </g>
  );
}

export function CommodityTokenSvg({ good, size = 18, title }: { good: CommodityGood; size?: number; title?: string }) {
  const label = title ?? GOOD_LABEL[good];
  return (
    <svg width={size} height={size} viewBox="-8.5 -8.5 17 17" role="img" aria-label={label}>
      <title>{label}</title>
      <CommodityToken good={good} r={8} />
    </svg>
  );
}

// Location glyphs in a ±8 box: pickaxe (quarry), tower (castle), furnace
// with a flask (glassworks).
export function LocationGlyph({ location, light }: { location: CommodityLocationId; light?: boolean }) {
  const ink = light ? '#fff8e8' : '#3b2a17';
  switch (location) {
    case 'quarry':
      return (
        <g stroke={ink} strokeLinecap="round" fill="none">
          <path d="M-5,6 L4,-3" strokeWidth={1.8} />
          <path d="M-1,-6 Q5,-6 7,0" strokeWidth={2} />
        </g>
      );
    case 'castle':
      return (
        <g fill={ink}>
          <path d="M-5,7 L-5,-3 L-6,-3 L-6,-6 L-3.6,-6 L-3.6,-4.4 L-1.2,-4.4 L-1.2,-6 L1.2,-6 L1.2,-4.4 L3.6,-4.4 L3.6,-6 L6,-6 L6,-3 L5,-3 L5,7 Z" />
        </g>
      );
    case 'glassworks':
      return (
        <g fill={ink}>
          <path d="M-6,7 L-6,-1 L-1,-4 L4,-1 L4,7 Z" />
          <rect x={1} y={-7} width={2.6} height={5} />
        </g>
      );
  }
}

export function LocationGlyphSvg({ location, size = 16 }: { location: CommodityLocationId; size?: number }) {
  const b = LOCATION_BACK[location];
  return (
    <svg width={size} height={size} viewBox="-9 -9 18 18" role="img" aria-label={LOCATION_LABEL[location]}>
      <title>{LOCATION_LABEL[location]}</title>
      <circle r={8.6} fill={b.fill} stroke={b.edge} strokeWidth={1} />
      <g transform="scale(0.85)">
        <LocationGlyph location={location} light />
      </g>
    </svg>
  );
}

// The red hexagonal "X" marker on a commodity hex's frame-side edges: no
// roads there.
export function XMarker({ x, y, r = 6 }: { x: number; y: number; r?: number }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <polygon points={hexPoints(r + 1.4)} fill="#f3e3c4" stroke="#7a1d1d" strokeWidth={0.8} />
      <circle r={r} fill="#9b1c1c" />
      <path
        d={`M${-r * 0.45},${-r * 0.45} L${r * 0.45},${r * 0.45} M${r * 0.45},${-r * 0.45} L${-r * 0.45},${r * 0.45}`}
        stroke="#fff"
        strokeWidth={r * 0.32}
        strokeLinecap="round"
      />
    </g>
  );
}

// A player's covered wagon, side on: canvas hood in the player's colour on
// a wooden bed with two spoked wheels and a drawbar. ~26 × 20 board units.
export function PlayerWagonFigure({
  color,
  cargo,
  ghost,
  scale = 1,
}: {
  color: PlayerColor;
  cargo?: CommodityGood | null;
  ghost?: boolean;
  scale?: number;
}) {
  const hood = PLAYER_COLOR_HEX[color];
  return (
    <g transform={`scale(${scale})`} opacity={ghost ? 0.6 : 1}>
      <ellipse cy={8.6} rx={12} ry={2} fill="#000" opacity={ghost ? 0.12 : 0.3} />
      {/* drawbar */}
      <path d="M9,3.2 L15.5,5.6" stroke="#4a2f17" strokeWidth={1.5} strokeLinecap="round" />
      {/* bed */}
      <rect x={-10.5} y={-0.6} width={20} height={5} rx={0.8} fill="#8d5a2b" stroke="#2f1d0c" strokeWidth={1} />
      <path d="M-10.5,2 H9.5" stroke="#5e3a19" strokeWidth={0.6} />
      {/* canvas hood */}
      <path
        d="M-9.6,-0.6 L-9.6,-8 Q-9.6,-11.6 -6,-11.6 L5,-11.6 Q8.6,-11.6 8.6,-8 L8.6,-0.6 Z"
        fill={hood}
        stroke="#1b1b1b"
        strokeWidth={1.1}
        strokeLinejoin="round"
        strokeDasharray={ghost ? '2 1.4' : undefined}
      />
      <path d="M-4,-11.4 V-0.8 M2,-11.4 V-0.8" stroke="#00000055" strokeWidth={0.8} />
      {/* wheels */}
      {[-6, 5].map((cx) => (
        <g key={cx} transform={`translate(${cx}, 5.2)`}>
          <circle r={3.6} fill="#5e3a19" stroke="#1f1308" strokeWidth={0.9} />
          <path d="M-3,0 H3 M0,-3 V3 M-2.1,-2.1 L2.1,2.1 M2.1,-2.1 L-2.1,2.1" stroke="#d9b98a" strokeWidth={0.5} />
          <circle r={0.9} fill="#d9b98a" />
        </g>
      ))}
      {cargo && (
        <g transform="translate(-0.5, -17)">
          <CommodityToken good={cargo} r={6} />
        </g>
      )}
    </g>
  );
}

export function PlayerWagonSvg({ color, size = 22, cargo }: { color: PlayerColor; size?: number; cargo?: CommodityGood | null }) {
  return (
    <svg width={size} height={size} viewBox={cargo ? '-13 -24 30 34' : '-13 -14 30 24'} role="img" aria-label="wagon">
      <PlayerWagonFigure color={color} cargo={cargo} />
    </svg>
  );
}
