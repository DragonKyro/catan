// Short animations that show what just changed, so players see every move:
// cards flying from the hexes that produced them to each player, a ring
// bursting where something was built (a streak along a new road / ship), a
// card flying from the deck to whoever bought one, a card face popping up
// when one is played, and the Longest Road / Largest Army badge moving to
// its new holder.
//
// They never hold up the game: each runs on its own (under a second and a
// half), the AI doesn't wait for them, and headless games never render this
// layer. It's an HTML layer over the whole game view animating only
// transform / opacity (compositor work, the board SVG isn't repainted);
// positions come from the board SVG's screen transform and the panels'
// `data-anim-*` hooks. With reduced motion everything fades in place
// instead of moving. Moves made more than a few seconds ago (a rejoin
// replaying the room's log) aren't animated.

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { GameState, PlayerId } from '@/game/types';
import { onBoardTransition } from '@/store/boardEvents';
import { playerColorVar } from '@/ui/shared/playerColors';
import { ResourceChip } from '@/ui/shared/ResourceChip';
import { CommodityChip } from '@/ui/shared/CommodityChip';
import { deriveBoardEvents, type BoardEvent } from './events';
import './BoardAnimations.css';

/** Older moves are history being replayed, not news. */
const STALE_MS = 4000;
/** At most this many cards fly for one roll. */
const MAX_CHIPS = 24;
/** Cards flying from one hex to one player (more show in the "+N"). */
const MAX_PER_PILE = 4;
/** A card's flight, and the gap between cards leaving. */
const CHIP_MS = 1250;
const CHIP_STAGGER_MS = 110;
/** When in its flight a card lands (the keyframes' arrival offset). */
const LAND_AT = 0.85;

interface Pt {
  x: number;
  y: number;
}

type Item =
  | { id: number; kind: 'chip'; from: Pt; to: Pt | null; delay: number; content: ReactNode }
  | { id: number; kind: 'ring'; at: Pt; size: number; color: string; delay: number }
  | { id: number; kind: 'streak'; a: Pt; b: Pt; width: number; color: string }
  | { id: number; kind: 'popup'; at: Pt; content: ReactNode; delay: number }
  | { id: number; kind: 'gain'; at: Pt; text: string; delay: number };

let nextId = 1;

export function BoardAnimations() {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(
    () =>
      onBoardTransition((before, action, after, at) => {
        if (Date.now() - at > STALE_MS || document.hidden) return;
        const events = deriveBoardEvents(before, action, after);
        if (events.length === 0) return;
        // Wait a frame so the board and panels show the new state first.
        requestAnimationFrame(() => {
          const made = buildItems(events, after);
          if (made.length > 0) setItems((cur) => [...cur, ...made]);
        });
      }),
    [],
  );
  const done = (id: number) => setItems((cur) => cur.filter((i) => i.id !== id));
  return (
    <div className="board-anim-layer" aria-hidden>
      {items.map((item) => (
        <AnimItem key={item.id} item={item} onDone={() => done(item.id)} />
      ))}
    </div>
  );
}

// ---- geometry -------------------------------------------------------------

function boardSvg(): SVGSVGElement | null {
  return document.querySelector<SVGSVGElement>('.gameview-board .board-svg');
}

function boardPoint(svg: SVGSVGElement, x: number, y: number): Pt | null {
  const m = svg.getScreenCTM();
  if (!m) return null;
  const p = svg.createSVGPoint();
  p.x = x;
  p.y = y;
  const s = p.matrixTransform(m);
  return { x: s.x, y: s.y };
}

/** Screen pixels per board unit. */
function boardScale(svg: SVGSVGElement): number {
  const m = svg.getScreenCTM();
  return m ? Math.hypot(m.a, m.b) : 1;
}

/** The centre of an element that's actually on screen, else null. */
function visibleCenter(el: Element | null): Pt | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return null;
  if (r.right < 0 || r.bottom < 0 || r.left > window.innerWidth || r.top > window.innerHeight) return null;
  const check = (el as Element & { checkVisibility?: () => boolean }).checkVisibility;
  if (check && !check.call(el)) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

const q = (sel: string) => document.querySelector(sel);

/** Where a card for `pid` should land (their hand's chip, their row, or the Players button) and that element. */
function playerLanding(pid: PlayerId, handPart?: string): { at: Pt; el: Element } | null {
  const hand = `[data-anim-hand="${CSS.escape(pid)}"]`;
  const spots = [
    handPart ? `${hand} ${handPart}` : null,
    hand,
    `[data-anim-player="${CSS.escape(pid)}"]`,
    '.gameview-players-btn',
  ];
  for (const sel of spots) {
    if (!sel) continue;
    const el = q(sel);
    const at = visibleCenter(el);
    if (at && el) return { at, el };
  }
  return null;
}

function playerTarget(pid: PlayerId, handPart?: string): Pt | null {
  return playerLanding(pid, handPart)?.at ?? null;
}

/** A little bounce on the element a card lands on. */
function bump(el: Element, delay: number): void {
  if (reducedMotion() || typeof (el as HTMLElement).animate !== 'function') return;
  (el as HTMLElement).animate(
    [{ transform: 'scale(1)' }, { transform: 'scale(1.16)', offset: 0.4 }, { transform: 'scale(1)' }],
    { duration: 260, delay, easing: 'ease-out' },
  );
}

function boardCenter(): Pt | null {
  const r = q('.gameview-board')?.getBoundingClientRect();
  return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
}

/** A banner spot near the top of the board; `slot` stacks several. */
function bannerSpot(slot: number): Pt | null {
  const r = q('.gameview-board')?.getBoundingClientRect();
  return r ? { x: r.left + r.width / 2, y: r.top + Math.min(130, r.height * 0.22) + slot * 62 } : null;
}

// ---- events → items -------------------------------------------------------

function buildItems(events: BoardEvent[], game: GameState): Item[] {
  const svg = boardSvg();
  const out: Item[] = [];
  const name = (pid: PlayerId | null) => game.players.find((p) => p.id === pid)?.name ?? '';
  const color = (pid: PlayerId) => {
    const p = game.players.find((x) => x.id === pid);
    return p ? playerColorVar(p.color) : 'var(--accent)';
  };
  const swatch = (pid: PlayerId) => <span className="board-anim-swatch" style={{ background: color(pid) }} />;
  let chips = 0;
  let banners = 0;
  // Per player: cards gained this roll and when the first one lands.
  const gains = new Map<PlayerId, { n: number; firstLand: number }>();
  const dice = visibleCenter(q('.gameview-dice-overlay .dice')) ?? boardCenter();

  for (const ev of events) {
    switch (ev.kind) {
      case 'produce': {
        const hex = ev.hex ? game.board.hexes[ev.hex] : null;
        const from = (svg && hex ? boardPoint(svg, hex.center.x, hex.center.y) : null) ?? dice;
        if (!from) break;
        const part = 'resource' in ev.card ? `.hand-resources .rchip-${ev.card.resource}` : undefined;
        const landing = playerLanding(ev.playerId, part);
        const to = landing?.at ?? null;
        const chip = 'resource' in ev.card
          ? <ResourceChip resource={ev.card.resource} size="md" />
          : <CommodityChip commodity={ev.card.commodity} size="md" />;
        // Every card flies, a few per pile, one after another: a big roll
        // is a stream of cards. The "+N" below counts them all.
        const g = gains.get(ev.playerId) ?? { n: 0, firstLand: Infinity };
        g.n += ev.count;
        for (let i = 0; i < Math.min(ev.count, MAX_PER_PILE) && chips < MAX_CHIPS; i++, chips++) {
          const delay = chips * CHIP_STAGGER_MS;
          out.push({ id: nextId++, kind: 'chip', from, to, delay, content: chip });
          const land = delay + CHIP_MS * LAND_AT;
          g.firstLand = Math.min(g.firstLand, land);
          if (landing) bump(landing.el, land);
        }
        gains.set(ev.playerId, g);
        break;
      }
      case 'build': {
        if (!svg) break;
        const scale = boardScale(svg);
        if ('vertex' in ev) {
          const v = game.board.vertices[ev.vertex];
          const at = v ? boardPoint(svg, v.position.x, v.position.y) : null;
          if (!at) break;
          const size = Math.max(26, (ev.piece === 'city' ? 34 : 28) * scale);
          out.push({ id: nextId++, kind: 'ring', at, size, color: color(ev.playerId), delay: 0 });
          if (ev.piece === 'city') out.push({ id: nextId++, kind: 'ring', at, size: size * 1.25, color: color(ev.playerId), delay: 140 });
        } else {
          const e = game.board.edges[ev.edge];
          const [va, vb] = e ? e.vertices.map((id) => game.board.vertices[id]) : [];
          const a = va ? boardPoint(svg, va.position.x, va.position.y) : null;
          const b = vb ? boardPoint(svg, vb.position.x, vb.position.y) : null;
          if (!a || !b) break;
          out.push({ id: nextId++, kind: 'streak', a, b, width: Math.max(5, 6 * scale), color: color(ev.playerId) });
        }
        break;
      }
      case 'devBuy': {
        const from = visibleCenter(q('[data-anim-devdeck]')) ?? boardCenter();
        if (!from) break;
        out.push({
          id: nextId++, kind: 'chip', from, to: playerTarget(ev.playerId, '.hand-cards'), delay: 0,
          content: <span className="board-anim-card board-anim-card-back">?</span>,
        });
        break;
      }
      case 'devPlay': {
        const at = bannerSpot(banners++);
        if (!at) break;
        out.push({
          id: nextId++, kind: 'popup', at, delay: 0,
          content: (
            <span className="board-anim-banner">
              <span className="board-anim-card">{ev.icon}</span>
              <span className="board-anim-banner-text">
                <span className="board-anim-banner-who">{swatch(ev.playerId)}{name(ev.playerId)} played</span>
                <strong>{ev.label}</strong>
              </span>
            </span>
          ),
        });
        break;
      }
      case 'award': {
        const icon = ev.award === 'longestRoad' ? '🛣️' : '⚔️';
        const title = ev.award === 'longestRoad' ? 'Longest Road' : 'Largest Army';
        const at = bannerSpot(banners++);
        if (at) {
          out.push({
            id: nextId++, kind: 'popup', at, delay: 0,
            content: (
              <span className="board-anim-banner">
                <span className="board-anim-card board-anim-card-award">{icon}</span>
                <span className="board-anim-banner-text">
                  <strong>{title}</strong>
                  <span className="board-anim-banner-who">
                    {ev.to ? <>{swatch(ev.to)}{name(ev.to)}{ev.from ? ` takes it from ${name(ev.from)}` : ' takes it'}</> : `${name(ev.from)} loses it`}
                  </span>
                </span>
              </span>
            ),
          });
        }
        if (ev.to) {
          const from = (ev.from ? playerTarget(ev.from) : null) ?? at ?? boardCenter();
          if (from) {
            out.push({
              id: nextId++, kind: 'chip', from, to: playerTarget(ev.to), delay: 250,
              content: <span className="board-anim-card board-anim-card-award">{icon}</span>,
            });
          }
        }
        break;
      }
    }
  }
  for (const [pid, g] of gains) {
    const at = playerTarget(pid);
    if (!at || g.n <= 0) continue;
    const delay = Number.isFinite(g.firstLand) ? g.firstLand : 0;
    out.push({ id: nextId++, kind: 'gain', at, text: `+${g.n}`, delay });
  }
  return out;
}

// ---- one animated item ----------------------------------------------------

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function AnimItem({ item, onDone }: { item: Item; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof el.animate !== 'function') {
      onDone();
      return;
    }
    const still = reducedMotion();
    const [frames, opts] = keyframes(item, still);
    const anim = el.animate(frames, { fill: 'both', ...opts });
    anim.onfinish = onDone;
    // Unmounting (or React's dev-mode effect re-run) stops it without
    // counting as done: a re-run starts it again.
    return () => {
      anim.onfinish = null;
      anim.cancel();
    };
    // Each item animates once, from mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  switch (item.kind) {
    case 'chip': {
      const at = item.to && reducedMotion() ? item.to : item.from;
      return (
        <div ref={ref} className="board-anim-item" style={{ left: at.x, top: at.y }}>
          {item.content}
        </div>
      );
    }
    case 'ring':
      return (
        <div
          ref={ref}
          className="board-anim-item board-anim-ring"
          style={{ left: item.at.x, top: item.at.y, width: item.size, height: item.size, borderColor: item.color }}
        />
      );
    case 'streak': {
      const len = Math.hypot(item.b.x - item.a.x, item.b.y - item.a.y);
      const angle = Math.atan2(item.b.y - item.a.y, item.b.x - item.a.x);
      return (
        <div
          ref={ref}
          className="board-anim-item board-anim-streak"
          style={{
            left: item.a.x,
            top: item.a.y,
            width: len,
            height: item.width,
            background: item.color,
            ['--angle' as string]: `${angle}rad`,
          }}
        />
      );
    }
    case 'popup':
      return (
        <div ref={ref} className="board-anim-item" style={{ left: item.at.x, top: item.at.y }}>
          {item.content}
        </div>
      );
    case 'gain':
      return (
        <div ref={ref} className="board-anim-item board-anim-gain" style={{ left: item.at.x, top: item.at.y }}>
          {item.text}
        </div>
      );
  }
}

const CENTER = 'translate(-50%, -50%)';

function keyframes(item: Item, still: boolean): [Keyframe[], KeyframeAnimationOptions] {
  switch (item.kind) {
    case 'chip': {
      if (still || !item.to) {
        // Fade in where it lands (or, with nowhere to go, where it starts).
        return [
          [
            { opacity: 0, transform: `${CENTER} scale(0.9)` },
            { opacity: 1, transform: `${CENTER} scale(1)`, offset: 0.25 },
            { opacity: 1, transform: `${CENTER} scale(1)`, offset: 0.75 },
            { opacity: 0, transform: `${CENTER} scale(1)` },
          ],
          { duration: 900, delay: item.delay },
        ];
      }
      const dx = item.to.x - item.from.x;
      const dy = item.to.y - item.from.y;
      return [
        [
          { opacity: 0, transform: `${CENTER} translate(0, 0) scale(0.5)` },
          { opacity: 1, transform: `${CENTER} translate(0, -16px) scale(1.15)`, offset: 0.2 },
          { opacity: 1, transform: `${CENTER} translate(${dx}px, ${dy}px) scale(0.9)`, offset: LAND_AT, easing: 'ease-out' },
          { opacity: 0, transform: `${CENTER} translate(${dx}px, ${dy}px) scale(0.6)` },
        ],
        { duration: CHIP_MS, delay: item.delay, easing: 'ease-in-out' },
      ];
    }
    case 'ring':
      return still
        ? [[{ opacity: 0 }, { opacity: 0.9, offset: 0.3 }, { opacity: 0 }], { duration: 700, delay: item.delay }]
        : [
            [
              { opacity: 1, transform: `${CENTER} scale(0.4)` },
              { opacity: 0.9, transform: `${CENTER} scale(1.15)`, offset: 0.5 },
              { opacity: 0, transform: `${CENTER} scale(1.6)` },
            ],
            { duration: 750, delay: item.delay, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
          ];
    case 'streak':
      return still
        ? [[{ opacity: 0 }, { opacity: 0.85, offset: 0.3 }, { opacity: 0 }], { duration: 700 }]
        : [
            [
              { opacity: 0.95, transform: 'translateY(-50%) rotate(var(--angle)) scaleX(0)' },
              { opacity: 0.95, transform: 'translateY(-50%) rotate(var(--angle)) scaleX(1)', offset: 0.4 },
              { opacity: 0, transform: 'translateY(-50%) rotate(var(--angle)) scaleX(1)' },
            ],
            { duration: 750, easing: 'ease-out' },
          ];
    case 'gain':
      return [
        still
          ? [{ opacity: 0, transform: CENTER }, { opacity: 1, transform: CENTER, offset: 0.2 }, { opacity: 1, transform: CENTER, offset: 0.7 }, { opacity: 0, transform: CENTER }]
          : [
              { opacity: 0, transform: `${CENTER} translateY(4px) scale(0.7)` },
              { opacity: 1, transform: `${CENTER} translateY(-10px) scale(1.15)`, offset: 0.2 },
              { opacity: 1, transform: `${CENTER} translateY(-18px) scale(1)`, offset: 0.7 },
              { opacity: 0, transform: `${CENTER} translateY(-26px) scale(1)` },
            ],
        { duration: 1300, delay: item.delay },
      ];
    case 'popup':
      return still
        ? [
            [{ opacity: 0, transform: CENTER }, { opacity: 1, transform: CENTER, offset: 0.12 }, { opacity: 1, transform: CENTER, offset: 0.82 }, { opacity: 0, transform: CENTER }],
            { duration: 1500, delay: item.delay },
          ]
        : [
            [
              { opacity: 0, transform: `${CENTER} translateY(10px) scale(0.85)` },
              { opacity: 1, transform: `${CENTER} translateY(0) scale(1.03)`, offset: 0.12 },
              { opacity: 1, transform: `${CENTER} scale(1)`, offset: 0.2 },
              { opacity: 1, transform: `${CENTER} scale(1)`, offset: 0.82 },
              { opacity: 0, transform: `${CENTER} translateY(-8px) scale(0.98)` },
            ],
            { duration: 1500, delay: item.delay },
          ];
  }
}
