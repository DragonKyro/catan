// Small inline SVG icons for the Traders & Barbarians pieces that live in
// players' hands: coins, the Wealthiest / Poor Catanian tiles, fish tokens
// and the old boot. Sized in px for HTML panels; each scales cleanly.

interface IconProps {
  size?: number;
  title?: string;
}

// A gold coin with a raised rim and an embossed value.
export function CoinIcon({ size = 18, title, value }: IconProps & { value?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={title ?? 'gold coin'}>
      {title && <title>{title}</title>}
      <circle cx={12} cy={12.6} r={10.2} fill="#9a6a12" />
      <circle cx={12} cy={11.6} r={10.2} fill="#e9b73c" stroke="#8a5d0e" strokeWidth={1.2} />
      <circle cx={12} cy={11.6} r={7.4} fill="#f6d36b" stroke="#b5841f" strokeWidth={0.9} strokeDasharray="1.4 1.1" />
      <text x={12} y={12} textAnchor="middle" dominantBaseline="central" fontSize={9} fontWeight={800} fill="#8a5d0e">
        {value ?? 1}
      </text>
    </svg>
  );
}

// The Wealthiest Catanian tile (a full red money bag) or a Poor Catanian
// tile (an empty, patched sack).
export function MoneyBagIcon({ size = 18, title, poor }: IconProps & { poor?: boolean }) {
  const label = title ?? (poor ? 'Poor Catanian' : 'Wealthiest Catanian');
  if (poor) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={label}>
        <title>{label}</title>
        <path d="M5,20 Q4,13 8,10 L9,7 L15,7 L16,10 Q20,13 19,20 Z" fill="#a8875b" stroke="#5b4426" strokeWidth={1.2} />
        <path d="M9,7 Q12,4.5 15,7" fill="none" stroke="#5b4426" strokeWidth={1.2} />
        <rect x={10.5} y={13} width={4} height={3.4} fill="#c9ad7f" stroke="#5b4426" strokeWidth={0.8} transform="rotate(-12 12.5 14.7)" />
        <path d="M7,17 L9,16 M15.5,18 L17,17" stroke="#5b4426" strokeWidth={0.8} />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={label}>
      <title>{label}</title>
      <path d="M4,20 Q3,11 9,9 L8,5.5 Q12,3.5 16,5.5 L15,9 Q21,11 20,20 Z" fill="#c4352b" stroke="#6e1712" strokeWidth={1.2} />
      <path d="M8.5,9 L15.5,9" stroke="#e8c04a" strokeWidth={1.6} strokeLinecap="round" />
      <circle cx={12} cy={15} r={3.6} fill="#e9b73c" stroke="#8a5d0e" strokeWidth={0.9} />
      <circle cx={18.5} cy={19} r={2.6} fill="#e9b73c" stroke="#8a5d0e" strokeWidth={0.8} />
    </svg>
  );
}

// A fish token: blue tile with 1-3 fish.
export function FishTokenIcon({ size = 20, title, fish }: IconProps & { fish: 1 | 2 | 3 }) {
  const rows: Array<[number, number]> =
    fish === 1 ? [[12, 12]] : fish === 2 ? [[12, 8.5], [12, 15.5]] : [[12, 6.5], [12, 12], [12, 17.5]];
  const label = title ?? `${fish}-fish token`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={label}>
      <title>{label}</title>
      <rect x={1.5} y={1.5} width={21} height={21} rx={3.5} fill="#5aa9d6" stroke="#245d80" strokeWidth={1.4} />
      {rows.map(([x, y], i) => (
        <g key={i} transform={`translate(${x - 2}, ${y}) scale(${fish === 1 ? 1.15 : 0.82})`}>
          <path d="M-6,0 Q-2,-3.6 4,-1.4 Q6,0 4,1.4 Q-2,3.6 -6,0 Z" fill="#e7c25a" stroke="#6d5a1f" strokeWidth={0.7} />
          <path d="M-6,0 L-8.6,-2.6 L-8.6,2.6 Z" fill="#e7c25a" stroke="#6d5a1f" strokeWidth={0.6} />
          <circle cx={2.4} cy={-0.4} r={0.6} fill="#1a1a1a" />
        </g>
      ))}
      {/* Value badge, legible at hand-panel size. */}
      <circle cx={18} cy={18} r={5.2} fill="#fdf8e8" stroke="#245d80" strokeWidth={1} />
      <text x={18} y={18.4} textAnchor="middle" dominantBaseline="central" fontSize={8} fontWeight={800} fill="#173f58">
        {fish}
      </text>
    </svg>
  );
}

// The old boot token (face up once drawn).
export function OldBootIcon({ size = 20, title }: IconProps) {
  const label = title ?? 'Old boot';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={label}>
      <title>{label}</title>
      <rect x={1.5} y={1.5} width={21} height={21} rx={3.5} fill="#5aa9d6" stroke="#245d80" strokeWidth={1.4} />
      <path
        d="M8,4.5 L14,4.5 L14,12.5 Q18.5,13 19.5,16.5 L19.5,18.5 L5.5,18.5 L5.5,16 Q7.5,15 8,12 Z"
        fill="#6b4220"
        stroke="#2e1a0a"
        strokeWidth={1.1}
        strokeLinejoin="round"
      />
      <path d="M8,7.5 L14,7.5" stroke="#3d240f" strokeWidth={0.9} />
      <path d="M5.5,18.5 L19.5,18.5" stroke="#2e1a0a" strokeWidth={1.6} />
      <circle cx={16.5} cy={16} r={0.9} fill="#d7c9a5" />
    </svg>
  );
}

export function fishValue(t: 'one' | 'two' | 'three'): 1 | 2 | 3 {
  return t === 'one' ? 1 : t === 'two' ? 2 : 3;
}
