// The sea behind every menu screen (home, new game, online, lobby, rulebook,
// map builder): a sunlit gradient, two layers of drifting wave marks, sun
// glints and clouds (with their shadows) passing over. All motion is
// transform / opacity on HTML layers, so it stays on the compositor
// (MenuScreen.css).

import type { CSSProperties } from 'react';

const SPARKLES: [number, number, number][] = [
  [12, 18, 0],
  [78, 12, 1.6],
  [88, 64, 3.1],
  [22, 78, 2.2],
  [55, 88, 0.8],
  [64, 30, 3.8],
  [8, 52, 4.6],
];

const PUFFS: [number, number, number][] = [
  [62, 66, 30],
  [98, 50, 38],
  [138, 60, 32],
  [168, 74, 24],
  [40, 80, 22],
  [112, 82, 30],
];

function Cloud({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 250 150" aria-hidden>
      <g fill="#05305a" opacity={0.14} transform="translate(30 36)">
        {PUFFS.map(([x, y, r], k) => (
          <circle key={k} cx={x} cy={y} r={r} />
        ))}
      </g>
      <g fill="#ffffff" opacity={0.93}>
        {PUFFS.map(([x, y, r], k) => (
          <circle key={k} cx={x} cy={y} r={r} />
        ))}
      </g>
      <g fill="#dceefa" opacity={0.9}>
        {PUFFS.map(([x, y, r], k) => (
          <circle key={k} cx={x + 4} cy={y + 6} r={r * 0.62} />
        ))}
      </g>
    </svg>
  );
}

export function SeaBackdrop() {
  return (
    <div className="menu-sea" aria-hidden>
      <div className="menu-waves menu-waves-a" />
      <div className="menu-waves menu-waves-b" />
      {SPARKLES.map(([x, y, d], k) => (
        <span key={k} className="menu-sparkle" style={{ left: `${x}%`, top: `${y}%`, '--d': `${d}s` } as CSSProperties} />
      ))}
      <Cloud className="menu-cloud menu-cloud-1" />
      <Cloud className="menu-cloud menu-cloud-2" />
      <Cloud className="menu-cloud menu-cloud-3" />
    </div>
  );
}
