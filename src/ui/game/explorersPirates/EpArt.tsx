import type { ReactNode } from 'react';
import type { EpCargo, EpMission, EpRegion, EpSpiceAbility, PlayerColor } from '@/game/types';
import { playerColorVar } from '@/ui/shared/playerColors';

// Explorers & Pirates art primitives, drawn around (0, 0) so callers place
// them with a transform. Board pieces (ships, harbor settlements, the
// pirate ship, crews, settlers, fish hauls, spice sacks, lair tokens, the
// face-down hex backs) plus small HTML-sized wrappers for the panels.

export const EP_REGION_EDGE: Record<EpRegion, string> = {
  parrot: '#5cbf4f',
  goose: '#ec8a33',
};
export const EP_REGION_LABEL: Record<EpRegion, string> = {
  parrot: 'Parrot',
  goose: 'Goose',
};

export const EP_CARGO_LABEL: Record<EpCargo, string> = {
  settler: 'settler',
  crew: 'crew',
  fish: 'fish haul',
  spice: 'spice sack',
};

export const EP_ABILITY_LABEL: Record<EpSpiceAbility, string> = {
  swiftVoyage: 'Swift Voyage',
  fastGold: 'Fast Gold',
  pirateBonus: 'Pirate Bonus',
};

export function abilityText(ability: EpSpiceAbility, pirateNumber?: number): string {
  switch (ability) {
    case 'swiftVoyage':
      return 'Swift Voyage: your ships get +1 movement point';
    case 'fastGold':
      return 'Fast Gold: once in your Action phase, trade 1 resource card for 1 gold';
    case 'pirateBonus':
      return `Pirate Bonus: a ${pirateNumber ?? '?'} also chases the pirate ship away (both farms: 4, 5 and 6)`;
  }
}

const INK = '#1a1a1a';

// ----- People -----

// A settler: a sturdy pawn carrying a bundle (large piece — fills a ship).
export function SettlerGlyph({ color, s = 1 }: { color: PlayerColor; s?: number }) {
  return (
    <g transform={`scale(${s})`}>
      <path d="M-4.6,5 Q-4.8,-0.6 0,-1 Q4.8,-0.6 4.6,5 Z" fill={playerColorVar(color)} stroke={INK} strokeWidth={0.9} />
      <circle cy={-3.6} r={2.6} fill={playerColorVar(color)} stroke={INK} strokeWidth={0.9} />
      {/* Hat brim + bundle on a stick. */}
      <path d="M-3.4,-5.4 L3.4,-5.4" stroke={INK} strokeWidth={1.1} strokeLinecap="round" />
      <path d="M2.6,1.4 L6.4,-4.4" stroke="#6b4a26" strokeWidth={0.9} strokeLinecap="round" />
      <circle cx={6.6} cy={-4.8} r={1.7} fill="#e9d6a8" stroke={INK} strokeWidth={0.6} />
    </g>
  );
}

// A crew: a slimmer pawn with a red bandana.
export function CrewGlyph({ color, s = 1 }: { color: PlayerColor; s?: number }) {
  return (
    <g transform={`scale(${s})`}>
      <path d="M-3.2,4.4 Q-3.4,-0.2 0,-0.6 Q3.4,-0.2 3.2,4.4 Z" fill={playerColorVar(color)} stroke={INK} strokeWidth={0.8} />
      <circle cy={-2.9} r={2.2} fill={playerColorVar(color)} stroke={INK} strokeWidth={0.8} />
      <path d="M-2.2,-3.9 Q0,-5.6 2.2,-3.9 L2.4,-3.3 L-2.4,-3.3 Z" fill="#c62828" stroke={INK} strokeWidth={0.4} />
    </g>
  );
}

// ----- Goods -----

// A fish haul: a small crate with two fish (large piece).
export function FishHaulGlyph({ s = 1 }: { s?: number }) {
  return (
    <g transform={`scale(${s})`}>
      <rect x={-5.6} y={-1} width={11.2} height={5.4} rx={1} fill="#9b6a3a" stroke={INK} strokeWidth={0.8} />
      <path d="M-5.6,1.6 L5.6,1.6" stroke="#6e4826" strokeWidth={0.6} />
      <path d="M-4.6,-1.2 Q-2,-4.4 1,-2 Q-2,0.2 -4.6,-1.2 Z" fill="#a9cde3" stroke="#28485e" strokeWidth={0.5} />
      <path d="M1,-2 L2.4,-3.2 L2.4,-0.8 Z" fill="#a9cde3" stroke="#28485e" strokeWidth={0.4} />
      <path d="M4.6,-1.4 Q2.2,-4.8 -0.6,-2.6 Q2.2,0 4.6,-1.4 Z" fill="#cfe5f2" stroke="#28485e" strokeWidth={0.5} />
    </g>
  );
}

// A spice sack. `band` = the owner's colour (sacks on a farm belong to a
// player); without one it's plain burlap (cargo on its owner's ship).
export function SpiceSackGlyph({ band, s = 1 }: { band?: PlayerColor; s?: number }) {
  return (
    <g transform={`scale(${s})`}>
      <path
        d="M-3.6,4.4 Q-5,0.6 -2.4,-1.8 L-1.6,-3.2 L1.6,-3.2 L2.4,-1.8 Q5,0.6 3.6,4.4 Z"
        fill="#d7b37a"
        stroke={INK}
        strokeWidth={0.8}
        strokeLinejoin="round"
      />
      <path d="M-2.2,-1.9 L2.2,-1.9" stroke={band ? playerColorVar(band) : '#8a5a22'} strokeWidth={1.6} />
      <circle cx={0} cy={1.6} r={1.3} fill="#c0392b" />
    </g>
  );
}

export function CargoGlyph({ piece, color, s = 1 }: { piece: EpCargo; color: PlayerColor; s?: number }) {
  switch (piece) {
    case 'settler':
      return <SettlerGlyph color={color} s={s} />;
    case 'crew':
      return <CrewGlyph color={color} s={s} />;
    case 'fish':
      return <FishHaulGlyph s={s} />;
    case 'spice':
      return <SpiceSackGlyph s={s} />;
  }
}

// ----- Tokens -----

// The pirate lair token (face down: its number stays secret until the
// lair is captured).
export function LairToken({ r = 13, captured }: { r?: number; captured?: boolean }) {
  const k = r / 13;
  return (
    <g>
      <circle r={r} fill="#1d1d22" stroke={captured ? '#ffd54f' : '#e8e1cf'} strokeWidth={1.6} />
      <g transform={`scale(${k})`}>
        {/* Crossbones. */}
        <path d="M-7,5 L7,-3 M-7,-3 L7,5" stroke="#efe8d6" strokeWidth={2} strokeLinecap="round" />
        {/* Skull. */}
        <path d="M-5,-2 Q-5,-8.6 0,-8.6 Q5,-8.6 5,-2 L3.2,0.6 L-3.2,0.6 Z" fill="#efe8d6" />
        <rect x={-2.6} y={0.2} width={5.2} height={2.6} rx={0.8} fill="#efe8d6" />
        <circle cx={-1.9} cy={-3.6} r={1.3} fill="#1d1d22" />
        <circle cx={1.9} cy={-3.6} r={1.3} fill="#1d1d22" />
      </g>
    </g>
  );
}

// A die face with `n` pips (fish shoal numbers 1-6).
export function DieFace({ n, size = 12 }: { n: number; size?: number }) {
  const h = size / 2;
  const q = size * 0.27;
  const spots: Array<[number, number]> = [];
  const add = (x: number, y: number) => spots.push([x, y]);
  if (n % 2 === 1) add(0, 0);
  if (n >= 2) {
    add(-q, -q);
    add(q, q);
  }
  if (n >= 4) {
    add(q, -q);
    add(-q, q);
  }
  if (n === 6) {
    add(-q, 0);
    add(q, 0);
  }
  return (
    <g>
      <rect x={-h} y={-h} width={size} height={size} rx={size * 0.2} fill="#fffdf4" stroke={INK} strokeWidth={0.9} />
      {spots.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={size * 0.085} fill={INK} />
      ))}
    </g>
  );
}

// ----- Spice farm advantages -----

export function AbilityGlyph({ ability, pirateNumber }: { ability: EpSpiceAbility; pirateNumber?: number }) {
  switch (ability) {
    case 'swiftVoyage':
      // A billowing sail with speed lines and "+1".
      return (
        <g>
          <path d="M-2,-7 Q5,-3 -2,4 Z" fill="#fdfbf3" stroke={INK} strokeWidth={0.8} />
          <path d="M-2,-7 L-2,5" stroke={INK} strokeWidth={0.9} />
          <path d="M-7,-3 L-4,-3 M-8,0 L-4,0 M-7,3 L-4,3" stroke="#fdfbf3" strokeWidth={1} strokeLinecap="round" />
          <text x={5.5} y={7} fontSize={6.5} fontWeight={900} fill="#fdfbf3" textAnchor="middle">
            +1
          </text>
        </g>
      );
    case 'fastGold':
      return (
        <g>
          <circle r={5.6} fill="#f2c94c" stroke="#8a5d0e" strokeWidth={1} />
          <circle r={3.8} fill="none" stroke="#b8860b" strokeWidth={0.6} />
          <path d="M1,-5 L-2.2,0.6 L0.4,0.6 L-1,5 L2.6,-1 L0,-1 Z" fill="#fff6c8" stroke="#8a5d0e" strokeWidth={0.4} />
        </g>
      );
    case 'pirateBonus':
      return (
        <g>
          <g transform="translate(-3, 0) scale(0.75)">
            <LairToken r={8} />
          </g>
          <g transform="translate(5, 2.5)">
            <circle r={4.4} fill="#fffdf4" stroke={INK} strokeWidth={0.8} />
            <text y={2.4} fontSize={6.5} fontWeight={900} textAnchor="middle" fill={INK}>
              {pirateNumber ?? '?'}
            </text>
          </g>
        </g>
      );
  }
}

// ----- Ships -----

// An Explorers & Pirates ship, upright, with up to 2 cargo slots on deck.
export function EpShipFigure({
  color,
  cargo = [],
  ghost,
}: {
  color: PlayerColor;
  cargo?: readonly EpCargo[];
  ghost?: boolean;
}) {
  const large = cargo.find((c) => c === 'settler' || c === 'fish');
  const small = cargo.filter((c) => c === 'crew' || c === 'spice');
  return (
    <g opacity={ghost ? 0.55 : 1}>
      <ellipse cx={0} cy={7.4} rx={11} ry={2.2} fill="#00000045" />
      {/* Mast + sails behind the cargo. */}
      <line x1={0} y1={2} x2={0} y2={-13} stroke={INK} strokeWidth={1.1} />
      <path d="M0.6,-12.4 Q8,-7 0.6,-2.4 Z" fill="#fdfbf3" stroke={INK} strokeWidth={0.8} />
      <path d="M-0.6,-11 Q-6,-7.2 -0.6,-3.6 Z" fill="#fdfbf3" stroke={INK} strokeWidth={0.7} />
      <path d="M0,-13 L5,-14.6 L0,-16 Z" fill={playerColorVar(color)} stroke={INK} strokeWidth={0.5} />
      {/* Hull. */}
      <path
        d="M-11,1.4 L11,1.4 Q9.6,6.6 6.4,6.6 L-6.4,6.6 Q-9.6,6.6 -11,1.4 Z"
        fill={playerColorVar(color)}
        stroke={INK}
        strokeWidth={1.1}
        strokeLinejoin="round"
      />
      <path d="M-9.4,3.6 L9.4,3.6" stroke="#00000040" strokeWidth={0.8} />
      {large && (
        <g transform="translate(-5.6, -2.6)">
          <CargoGlyph piece={large} color={color} s={0.78} />
        </g>
      )}
      {small.map((c, i) => (
        <g key={i} transform={`translate(${-6.6 + i * 13.2}, -2.2)`}>
          <CargoGlyph piece={c} color={color} s={0.78} />
        </g>
      ))}
    </g>
  );
}

// The pirate ship: black hull, a sail in its owner's colour with a skull.
export function EpPirateFigure({ color }: { color: PlayerColor }) {
  return (
    <g>
      <ellipse cx={0} cy={11} rx={14} ry={3.2} fill="#00000060" />
      <line x1={0} y1={4} x2={0} y2={-19} stroke={INK} strokeWidth={1.4} />
      <path d="M0.8,-18 L13,-9 Q7,-3 0.8,-1 Z" fill={playerColorVar(color)} stroke={INK} strokeWidth={1} />
      <path d="M-0.8,-15 L-9,-6 L-0.8,-2 Z" fill="#1d1d22" stroke="#fefefe" strokeWidth={0.7} />
      <g transform="translate(6, -8.5) scale(0.62)">
        <path d="M-5,-2 Q-5,-8.6 0,-8.6 Q5,-8.6 5,-2 L3.2,0.6 L-3.2,0.6 Z" fill="#fefefe" stroke={INK} strokeWidth={0.6} />
        <circle cx={-1.9} cy={-3.6} r={1.3} fill={INK} />
        <circle cx={1.9} cy={-3.6} r={1.3} fill={INK} />
        <path d="M-6,3 L6,-1 M-6,-1 L6,3" stroke="#fefefe" strokeWidth={1.4} strokeLinecap="round" />
      </g>
      <path d="M0,-19 L-6,-21 L0,-23 Z" fill="#1d1d22" />
      <path
        d="M-15,3 L15,3 Q13,10 9,10 L-9,10 Q-13,10 -15,3 Z"
        fill="#1d1d22"
        stroke="#fefefe"
        strokeWidth={1}
        strokeLinejoin="round"
      />
      <circle cx={-6} cy={6} r={1.1} fill="#fefefe" />
      <circle cx={0} cy={6} r={1.1} fill="#fefefe" />
      <circle cx={6} cy={6} r={1.1} fill="#fefefe" />
    </g>
  );
}

// ----- Harbor settlement -----

// A settlement with a pier and an anchor badge (worth 2 VP).
export function HarborSettlementFigure({ color, ghost }: { color: PlayerColor; ghost?: boolean }) {
  return (
    <g opacity={ghost ? 0.55 : 1}>
      <rect x={-10.5} y={4.2} width={21} height={3.4} rx={0.8} fill="#8a5a2b" stroke={INK} strokeWidth={0.9} />
      <path d="M-8,7.6 L-8,10 M0,7.6 L0,10 M8,7.6 L8,10" stroke="#5e3b18" strokeWidth={1.4} />
      <path
        d="M-8.5,5 L-8.5,-3 L0,-9.5 L8.5,-3 L8.5,5 Z"
        fill={playerColorVar(color)}
        stroke={INK}
        strokeWidth={1.3}
        strokeLinejoin="round"
      />
      {/* Anchor on a navy badge (readable on every player colour). */}
      <circle cx={0} cy={0} r={4.9} fill="#173a5c" stroke={INK} strokeWidth={0.6} />
      <g stroke="#fdfbf3" strokeWidth={1} fill="none" strokeLinecap="round">
        <circle cx={0} cy={-2.9} r={0.9} />
        <path d="M0,-2 L0,3" />
        <path d="M-1.9,-0.6 L1.9,-0.6" />
        <path d="M-3,1 Q-2.6,3.2 0,3.2 Q2.6,3.2 3,1" />
      </g>
    </g>
  );
}

// ----- Face-down hexes -----

export function ParrotSilhouette({ fill }: { fill: string }) {
  return (
    <g fill={fill}>
      {/* Tail feathers, body, head, hooked beak, wing. */}
      <path d="M-1.5,6 L-5,15 L-1,14 L0.5,15.5 L1.5,7 Z" />
      <path d="M-5,-2 Q-6,6 0,8 Q5,8 5,1 Q5,-5 0,-6 Q-4,-6 -5,-2 Z" />
      <circle cx={1.5} cy={-8.5} r={4.6} />
      <path d="M5.4,-10 Q9.6,-9.4 8.4,-5 Q7.4,-7.4 5.2,-6.8 Z" />
      <circle cx={2.4} cy={-9.4} r={1.1} fill="#13202b" />
      <path d="M-4.2,-1 Q-9,3 -6,8 Q-3.6,5.6 -2.6,1.4 Z" opacity={0.75} />
    </g>
  );
}

export function GooseSilhouette({ fill }: { fill: string }) {
  return (
    <g fill={fill}>
      {/* Long neck, head, beak, plump body, tail. */}
      <path d="M-11,6 Q-10,-1 -2,-1 L4,-1 Q10,0 11,6 Q6,11 -4,11 Q-9,10 -11,6 Z" />
      <path d="M-11,6 L-15,2.4 L-13,7 Z" />
      <path d="M3,0 Q4,-6 1.6,-10 Q0.4,-13 3,-14.6 Q6.4,-15.4 7,-12 Q7.2,-9.6 5.6,-6 Q5,-3 7,0 Z" />
      <path d="M6.6,-13.4 L11,-12 L6.8,-11 Z" />
      <circle cx={4.6} cy={-12.8} r={0.9} fill="#13202b" />
      <path d="M-6,3 Q0,1 5,4 Q0,7.4 -6,3 Z" opacity={0.7} fill="#13202b" />
    </g>
  );
}

// ----- HTML-sized wrappers (panels, buttons, dialogs) -----

function Box({ size, children, title, vb = 20 }: { size: number; children: ReactNode; title?: string; vb?: number }) {
  const h = vb / 2;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`${-h} ${-h} ${vb} ${vb}`}
      style={{ verticalAlign: 'middle', flexShrink: 0 }}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}

export function CargoIcon({ piece, color, size = 16, title }: { piece: EpCargo; color: PlayerColor; size?: number; title?: string }) {
  return (
    <Box size={size} title={title} vb={16}>
      <CargoGlyph piece={piece} color={color} s={1.15} />
    </Box>
  );
}

export function EpShipIcon({ color, size = 18, cargo, title }: { color: PlayerColor; size?: number; cargo?: readonly EpCargo[]; title?: string }) {
  return (
    <Box size={size} title={title} vb={34}>
      <g transform="translate(0, 3)">
        <EpShipFigure color={color} cargo={cargo} />
      </g>
    </Box>
  );
}

export function HarborIcon({ color, size = 18, title }: { color: PlayerColor; size?: number; title?: string }) {
  return (
    <Box size={size} title={title} vb={24}>
      <HarborSettlementFigure color={color} />
    </Box>
  );
}

export function LairIcon({ size = 16, title, captured }: { size?: number; title?: string; captured?: boolean }) {
  return (
    <Box size={size} title={title} vb={28}>
      <LairToken r={13} captured={captured} />
    </Box>
  );
}

export function AbilityIcon({
  ability,
  pirateNumber,
  size = 18,
  title,
}: {
  ability: EpSpiceAbility;
  pirateNumber?: number;
  size?: number;
  title?: string;
}) {
  return (
    <Box size={size} title={title} vb={20}>
      <circle r={9.6} fill="#8e3b1d" />
      <AbilityGlyph ability={ability} pirateNumber={pirateNumber} />
    </Box>
  );
}

export function PirateShipIcon({ color, size = 18, title }: { color: PlayerColor; size?: number; title?: string }) {
  return (
    <Box size={size} title={title} vb={36}>
      <g transform="translate(0, 5)">
        <EpPirateFigure color={color} />
      </g>
    </Box>
  );
}

// The three missions' symbols (pirate lair token, fish, spice sack).
export function MissionIcon({ mission, size = 15, title }: { mission: EpMission; size?: number; title?: string }) {
  return (
    <Box size={size} title={title} vb={mission === 'pirateLairs' ? 28 : 16}>
      {mission === 'pirateLairs' ? (
        <LairToken r={13} />
      ) : mission === 'fish' ? (
        <g transform="scale(1.3)">
          <path d="M-5,0 Q-1,-4 4,-0.6 Q-1,4 -5,0 Z" fill="#a9d4ec" stroke="#1f4a66" strokeWidth={0.8} />
          <path d="M4,-0.6 L6.6,-3 L6.6,2 Z" fill="#a9d4ec" stroke="#1f4a66" strokeWidth={0.7} />
          <circle cx={-2.6} cy={-0.5} r={0.7} fill="#1f4a66" />
        </g>
      ) : (
        <SpiceSackGlyph s={1.45} />
      )}
    </Box>
  );
}

export function DieIcon({ n, size = 14 }: { n: number; size?: number }) {
  return (
    <Box size={size} vb={14}>
      <DieFace n={n} size={12} />
    </Box>
  );
}
