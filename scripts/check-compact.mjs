#!/usr/bin/env node
// Compact-screen check for the game screen (CLAUDE.md "Compact screens"):
// loads a fast-forwarded position at the phone / small-tablet sizes the
// project promises, reports whether the page scrolls (it must not:
// document.scrollingElement.scrollHeight must equal innerHeight), and saves
// a screenshot per size. Uses the Chrome DevTools protocol for real device
// emulation, so widths below headless Chrome's ~500 px window minimum work.
//
//   npm run dev        # or set BOARD_URL
//   node scripts/check-compact.mjs ck:standard traders:barbarianAttack --steps 300 --out compact-shots
//
// Specs are <kind>:<id> as for render-board.mjs. Extra preview params can be
// passed with --param key=value (e.g. --param dialog=progressCards).
// Exit code 1 if any size scrolls.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { openBrowser, sleep } from './lib/chrome.mjs';

const SIZES = [
  [390, 664],
  [360, 560],
  [844, 390],
  [932, 430],
];

const args = process.argv.slice(2);
const specs = [];
let players = 4;
let seed = 1;
let steps = 300;
let out = 'compact-shots';
const extra = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--players') players = Number(args[++i]);
  else if (a === '--seed') seed = Number(args[++i]);
  else if (a === '--steps') steps = Number(args[++i]);
  else if (a === '--out') out = args[++i];
  else if (a === '--param') extra.push(args[++i]);
  else specs.push(a);
}
if (specs.length === 0) {
  console.error('usage: check-compact.mjs <kind>:<id> [...] [--steps N] [--seed N] [--players N] [--param k=v] [--out DIR]');
  process.exit(1);
}

const base = process.env.BOARD_URL ?? 'http://localhost:5173/catan/';

mkdirSync(out, { recursive: true });
const chrome = await openBrowser();
let failed = false;
try {
  // Warm-up load (the dev server's first page can stall on dependency
  // optimisation).
  await chrome.navigate(base);
  await chrome.waitFor('#root > *', 60000);
  for (const spec of specs) {
    const params = [
      `preview=${encodeURIComponent(spec)}`,
      `players=${players}`,
      `seed=${seed}`,
      `steps=${steps}`,
      'view=game',
      ...extra,
    ].join('&');
    for (const [w, h] of SIZES) {
      await chrome.emulate(w, h, true);
      await chrome.navigate(`${base}?${params}`);
      let ready = await chrome.waitFor('.gameview', 60000);
      if (!ready) {
        await chrome.reload();
        ready = await chrome.waitFor('.gameview', 60000);
      }
      await sleep(200);
      const m = await chrome.evaluate(
        `JSON.stringify({ sh: document.scrollingElement.scrollHeight, ih: innerHeight, sw: document.scrollingElement.scrollWidth, iw: innerWidth })`,
      );
      const { sh, ih, sw, iw } = JSON.parse(m ?? '{}');
      const scrolls = !ready || sh > ih || sw > iw;
      if (scrolls) failed = true;
      const file = resolve(join(out, `${spec.replace(':', '-')}-${w}x${h}.png`));
      writeFileSync(file, await chrome.screenshot());
      console.log(
        `${!ready ? 'NO GAME' : scrolls ? 'SCROLLS' : 'ok     '} ${spec} ${w}x${h}  scroll ${sw}x${sh} vs viewport ${iw}x${ih}  ${file}`,
      );
    }
  }
} finally {
  await chrome.close();
}
process.exit(failed ? 1 : 0);
