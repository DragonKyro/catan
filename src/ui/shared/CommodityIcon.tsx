import type { Commodity } from '@/game/types';

// Small inline SVG icons for the three Cities & Knights commodities, drawn
// after the 2025 card art: a paper scroll (forest), a bolt of cloth
// (pasture), a stack of coins (mountains). Sized in em so they follow the
// surrounding text.
export function CommodityIcon({ commodity, size = '1.15em' }: { commodity: Commodity; size?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width={size}
      height={size}
      aria-hidden
      focusable="false"
      style={{ verticalAlign: '-0.2em' }}
    >
      {commodity === 'paper' && <Paper />}
      {commodity === 'cloth' && <Cloth />}
      {commodity === 'coin' && <Coin />}
    </svg>
  );
}

function Paper() {
  return (
    <g stroke="#5a4520" strokeWidth={1} strokeLinejoin="round">
      <path d="M4,4 L15,4 L15,16 L4,16 Z" fill="#f3e3b8" />
      <path d="M3,3.5 C1.4,3.5 1.4,6.5 3,6.5 L15.5,6.5" fill="none" />
      <ellipse cx={15.5} cy={5} rx={1.6} ry={1.6} fill="#e6cf92" />
      <ellipse cx={4} cy={16} rx={1.6} ry={1.6} fill="#e6cf92" />
      <path d="M6.5,9 L13,9 M6.5,11.2 L13,11.2 M6.5,13.4 L11,13.4" stroke="#8a6d33" strokeWidth={0.9} />
    </g>
  );
}

function Cloth() {
  return (
    <g stroke="#4b4636" strokeWidth={1} strokeLinejoin="round">
      {/* Bolt: a roll with the cloth unrolling to the right. */}
      <path d="M8,6 L17,6 L17,15 L8,15 Z" fill="#efe6cf" />
      <path d="M10.5,6 L10.5,15 M13,6 L13,15 M15.5,6 L15.5,15" stroke="#6f9bc4" strokeWidth={0.9} />
      <ellipse cx={6} cy={10.5} rx={3.5} ry={4.8} fill="#f7f0dc" />
      <ellipse cx={6} cy={10.5} rx={1.3} ry={1.9} fill="#c8b98f" />
    </g>
  );
}

function Coin() {
  // Silver coins, as on the 2025 coin card (distinct from T&B gold).
  return (
    <g stroke="#3f454d" strokeWidth={1}>
      <ellipse cx={8} cy={14} rx={5.5} ry={2.4} fill="#aab2bb" />
      <ellipse cx={8} cy={12} rx={5.5} ry={2.4} fill="#c3cad2" />
      <ellipse cx={12.5} cy={8.5} rx={5} ry={5} fill="#dfe4ea" />
      <ellipse cx={12.5} cy={8.5} rx={3.2} ry={3.2} fill="none" stroke="#7d8792" strokeWidth={0.8} />
    </g>
  );
}
