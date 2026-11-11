// Illustrations for the home screen's island tiles, drawn in each hex's
// local coordinates (centre 0,0; circumradius HEX). Art stays clear of the
// centre, where the number token sits. The small animated parts (swaying
// wheat, hopping sheep, nodding pines) carry a class from HomeMenu.css and
// a --d delay so neighbours don't move in step.

import type { CSSProperties } from 'react';
import type { HomeTerrain } from './island';

export const TERRAIN_COLORS: Record<HomeTerrain, { light: string; base: string; dark: string; side: string }> = {
  wood: { light: '#5fb257', base: '#3f8f45', dark: '#2c6b33', side: '#1d4a23' },
  sheep: { light: '#c6ec8f', base: '#9fd46a', dark: '#7bb34b', side: '#4f7a2e' },
  wheat: { light: '#ffe27e', base: '#f5c84a', dark: '#dba62b', side: '#94701a' },
  brick: { light: '#f0a062', base: '#d77a3b', dark: '#b25a24', side: '#733915' },
  ore: { light: '#c0c0cd', base: '#9c9caa', dark: '#787886', side: '#4c4c58' },
  desert: { light: '#f6e6b8', base: '#e7cf98', dark: '#cdb277', side: '#93794a' },
};

const delay = (d: number) => ({ '--d': `${d}s` }) as CSSProperties;

function Shadow({ rx, y = 6 }: { rx: number; y?: number }) {
  return <ellipse cx={0} cy={y} rx={rx} ry={rx * 0.32} fill="#000" opacity={0.2} />;
}

function Pine({ x, y, s = 1, d = 0 }: { x: number; y: number; s?: number; d?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <Shadow rx={6.5} y={5.5} />
      <g className="home-nod" style={delay(d)}>
        <rect x={-1} y={2.5} width={2} height={3.5} fill="#5b3a1d" />
        <path d="M0,-5 L7,3.5 L-7,3.5 Z" fill="#1f5a28" />
        <path d="M0,-5 L-7,3.5 L-1,3.5 Z" fill="#2f7d37" />
        <path d="M0,-11.5 L5.2,-1.5 L-5.2,-1.5 Z" fill="#256a2e" />
        <path d="M0,-11.5 L-5.2,-1.5 L-0.8,-1.5 Z" fill="#3c9c45" />
      </g>
    </g>
  );
}

function Sheep({ x, y, flip = false, d = 0 }: { x: number; y: number; flip?: boolean; d?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -1 : 1} 1)`}>
      <Shadow rx={6} y={5} />
      <g className="home-hop" style={delay(d)}>
        {[-3.2, -1.2, 1.4, 3.2].map((lx) => (
          <rect key={lx} x={lx - 0.6} y={1.5} width={1.2} height={3.4} rx={0.5} fill="#2d2a26" />
        ))}
        <g fill="#fffdf4" stroke="#d8d0b6" strokeWidth={0.5}>
          <circle cx={-3} cy={0} r={3} />
          <circle cx={0} cy={-1.4} r={3.3} />
          <circle cx={3} cy={-0.2} r={3} />
          <circle cx={0} cy={1.2} r={3} />
        </g>
        <ellipse cx={5.8} cy={-1.4} rx={2.1} ry={2.5} fill="#2d2a26" />
        <ellipse cx={4.6} cy={-3.3} rx={1.3} ry={0.7} fill="#2d2a26" transform="rotate(-25 4.6 -3.3)" />
        <circle cx={6.6} cy={-1.9} r={0.45} fill="#fff" />
      </g>
    </g>
  );
}

function Tuft({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <path
      d={`M${x - 2},${y} L${x - 0.8},${y - 2.6} M${x},${y} L${x},${y - 3.2} M${x + 2},${y} L${x + 0.8},${y - 2.6}`}
      stroke={color}
      strokeWidth={0.9}
      strokeLinecap="round"
    />
  );
}

function Fence({ x, y, w }: { x: number; y: number; w: number }) {
  const posts = [0, w / 2, w];
  return (
    <g transform={`translate(${x} ${y})`} stroke="#7a5230" strokeLinecap="round">
      <line x1={0} y1={-2.2} x2={w} y2={-2.2} strokeWidth={1} />
      <line x1={0} y1={-0.4} x2={w} y2={-0.4} strokeWidth={1} />
      {posts.map((px) => (
        <line key={px} x1={px} y1={-4} x2={px} y2={1.2} strokeWidth={1.4} />
      ))}
    </g>
  );
}

function Sheaf({ x, y, s = 1, d = 0 }: { x: number; y: number; s?: number; d?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <Shadow rx={4.5} y={5.5} />
      <g className="home-sway" style={delay(d)}>
        {[-16, 0, 16].map((rot) => (
          <g key={rot} transform={`rotate(${rot} 0 5)`}>
            <line x1={0} y1={5} x2={0} y2={-6} stroke="#9a6d12" strokeWidth={0.9} />
            {[-7.5, -5.2, -2.9].map((gy) => (
              <g key={gy}>
                <ellipse cx={-1.1} cy={gy} rx={0.9} ry={1.7} fill="#c8901c" transform={`rotate(-28 -1.1 ${gy})`} />
                <ellipse cx={1.1} cy={gy} rx={0.9} ry={1.7} fill="#e2a92a" transform={`rotate(28 1.1 ${gy})`} />
              </g>
            ))}
          </g>
        ))}
        <rect x={-2.4} y={1.2} width={4.8} height={1.5} rx={0.6} fill="#8a5a1a" />
      </g>
    </g>
  );
}

function BrickStack({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  const brick = (bx: number, by: number) => (
    <g key={`${bx},${by}`}>
      <rect x={bx} y={by} width={4.6} height={2.8} rx={0.4} fill="#b6461f" stroke="#6b2710" strokeWidth={0.5} />
      <rect x={bx + 0.4} y={by + 0.3} width={3.8} height={0.7} rx={0.3} fill="#e07a4a" opacity={0.8} />
    </g>
  );
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <Shadow rx={8} y={3.6} />
      {[-7, -2.3, 2.4].map((bx) => brick(bx, 0))}
      {[-4.6, 0].map((bx) => brick(bx, -3))}
      {brick(-2.3, -6)}
    </g>
  );
}

function Mountain({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <Shadow rx={10} y={6.5} />
      <path d="M-11,6.5 L-1,-11 L11,6.5 Z" fill="#696977" />
      <path d="M-1,-11 L-11,6.5 L-2.5,6.5 L1.2,-2 Z" fill="#8e8e9c" />
      <path d="M-1,-11 L-4.8,-4.4 L-2.6,-5.6 L-1,-3.8 L1,-5.8 L2.9,-4.6 Z" fill="#fbfbff" />
      <path d="M-1,-11 L-4.8,-4.4 L-2.6,-5.6 L-1,-3.8 Z" fill="#ffffff" />
    </g>
  );
}

function Rock({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <Shadow rx={4} y={2.4} />
      <path d="M-3.6,2 L-2.4,-1.8 L0.6,-3 L3.4,-0.6 L2.8,2 Z" fill="#5f5f6c" />
      <path d="M-2.4,-1.8 L0.6,-3 L0.2,-0.4 L-3.6,2 Z" fill="#8b8b98" />
    </g>
  );
}

function Cactus({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <Shadow rx={4} y={6} />
      <g stroke="#2f6b33" strokeLinecap="round" fill="none">
        <path d="M0,6 L0,-6" strokeWidth={3.2} />
        <path d="M0,1 L-3,1 L-3,-3" strokeWidth={2} />
        <path d="M0,-1 L3,-1 L3,-4.5" strokeWidth={2} />
      </g>
      <path d="M-0.6,5 L-0.6,-5.4" stroke="#5aa35e" strokeWidth={0.8} strokeLinecap="round" />
    </g>
  );
}

function Stripes({ color, gap, width, angle }: { color: string; gap: number; width: number; angle: number }) {
  const lines = [];
  for (let k = -48; k <= 48; k += gap) lines.push(k);
  return (
    <g clipPath="url(#home-hexclip)" opacity={0.45}>
      <g transform={`rotate(${angle})`}>
        {lines.map((k) => (
          <line key={k} x1={-50} y1={k} x2={50} y2={k} stroke={color} strokeWidth={width} />
        ))}
      </g>
    </g>
  );
}

export function TerrainArt({ terrain, seed }: { terrain: HomeTerrain; seed: number }) {
  const d = (n: number) => ((seed * 7 + n * 13) % 17) / 6;
  switch (terrain) {
    case 'wood':
      return (
        <g>
          <Pine x={2} y={-19} s={0.9} d={d(1)} />
          <Pine x={-14} y={-12} d={d(2)} />
          <Pine x={15} y={-10} s={1.05} d={d(3)} />
          <Pine x={-19} y={6} s={0.95} d={d(4)} />
          <Pine x={19} y={9} s={0.85} d={d(5)} />
          <Pine x={-7} y={20} d={d(6)} />
          <Pine x={9} y={21} s={0.85} d={d(7)} />
        </g>
      );
    case 'sheep':
      return (
        <g>
          <Tuft x={-17} y={12} color="#5f9a3a" />
          <Tuft x={19} y={-3} color="#5f9a3a" />
          <Tuft x={-3} y={-20} color="#5f9a3a" />
          <Tuft x={-1} y={22} color="#5f9a3a" />
          <Fence x={6} y={-15} w={14} />
          <Sheep x={-14} y={-10} d={d(1)} />
          <Sheep x={14} y={13} flip d={d(2)} />
          <Sheep x={-9} y={17} d={d(3)} />
        </g>
      );
    case 'wheat':
      return (
        <g>
          <Stripes color="#c48c1c" gap={6} width={2.2} angle={-30} />
          <Sheaf x={-15} y={-12} d={d(1)} />
          <Sheaf x={14} y={-13} s={0.95} d={d(2)} />
          <Sheaf x={-15} y={13} s={0.9} d={d(3)} />
          <Sheaf x={16} y={12} d={d(4)} />
        </g>
      );
    case 'brick':
      return (
        <g>
          <g clipPath="url(#home-hexclip)" opacity={0.35}>
            <path d="M-36,4 Q-20,-12 -4,4 Z M2,-12 Q16,-26 30,-12 Z M-4,30 Q12,14 28,30 Z" fill="#8f4119" />
          </g>
          <ellipse cx={13} cy={-14} rx={6} ry={2.4} fill="#7e3a17" opacity={0.7} />
          <BrickStack x={-14} y={-9} />
          <BrickStack x={15} y={13} s={0.95} />
          <BrickStack x={-12} y={18} s={0.75} />
        </g>
      );
    case 'ore':
      return (
        <g>
          <Mountain x={-11} y={-10} s={1.15} />
          <Mountain x={12} y={-13} s={0.95} />
          <Mountain x={17} y={11} s={0.7} />
          <Rock x={-16} y={13} />
          <Rock x={3} y={20} s={0.9} />
          <Rock x={-5} y={-22} s={0.7} />
        </g>
      );
    case 'desert':
      return (
        <g>
          <g fill="none" stroke="#c4a866" strokeWidth={1.1} strokeLinecap="round" opacity={0.8}>
            <path d="M-22,-4 Q-14,-10 -6,-5" />
            <path d="M6,-18 Q13,-23 20,-17" />
            <path d="M-18,15 Q-9,10 0,16" />
            <path d="M8,20 Q15,15 22,19" />
          </g>
          <Cactus x={-14} y={-13} />
          <Cactus x={16} y={8} s={0.85} />
          <Rock x={-17} y={9} s={0.6} />
        </g>
      );
  }
}

/** A tiny glyph of the resource a terrain produces (resource cards, harbors). */
export function ResourceGlyph({ terrain }: { terrain: HomeTerrain }) {
  switch (terrain) {
    case 'wood':
      return (
        <g>
          <rect x={-0.7} y={1.5} width={1.4} height={2} fill="#5b3a1d" />
          <path d="M0,-4.5 L3.6,2 L-3.6,2 Z" fill="#1f5a28" />
        </g>
      );
    case 'brick':
      return (
        <g fill="#b6461f" stroke="#6b2710" strokeWidth={0.4}>
          <rect x={-3.6} y={0.3} width={3.4} height={2} />
          <rect x={0.2} y={0.3} width={3.4} height={2} />
          <rect x={-1.7} y={-2.1} width={3.4} height={2} />
        </g>
      );
    case 'sheep':
      return (
        <g fill="#fffdf4" stroke="#bfb69a" strokeWidth={0.4}>
          <circle cx={-1.6} cy={0.4} r={1.9} />
          <circle cx={0.6} cy={-0.8} r={2.1} />
          <circle cx={1.6} cy={1} r={1.8} />
        </g>
      );
    case 'wheat':
      return (
        <g>
          <line x1={0} y1={4} x2={0} y2={-4} stroke="#9a6d12" strokeWidth={0.8} />
          {[-3.4, -1.4, 0.6].map((gy) => (
            <g key={gy}>
              <ellipse cx={-1} cy={gy} rx={0.8} ry={1.5} fill="#c8901c" transform={`rotate(-28 -1 ${gy})`} />
              <ellipse cx={1} cy={gy} rx={0.8} ry={1.5} fill="#e2a92a" transform={`rotate(28 1 ${gy})`} />
            </g>
          ))}
        </g>
      );
    case 'ore':
      return (
        <g>
          <path d="M-3.4,2.2 L-2,-2 L1,-3 L3.6,-0.4 L2.6,2.4 Z" fill="#5f5f6c" />
          <path d="M-2,-2 L1,-3 L0.4,-0.2 L-3.4,2.2 Z" fill="#a3a3b0" />
        </g>
      );
    case 'desert':
      return null;
  }
}
