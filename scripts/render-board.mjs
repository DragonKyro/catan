#!/usr/bin/env node
// Screenshot scenario boards with headless Chrome / Edge, for checking a map
// against its rulebook picture.
//
//   npm run dev                      # in another terminal (or set BOARD_URL)
//   node scripts/render-board.mjs traders:riversOfCatan traders:fishingOnCatan \
//     --players 4 --seed 3 --coords --steps 300 [--view game] --out board-renders
//
// Each spec is <kind>:<id> (kind = base | seafarers | traders | ck), the same
// format as the app's `?preview=` URL (src/ui/mapBuilder/ScenarioPreview.tsx).
// Writes <out>/<kind>-<id>-<players>p-s<seed>[-m<steps>][-game].png. `--view game`
// shows the whole game screen (seat 1 human) instead of the bare board.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const specs = [];
let players = 4;
let seed = 1;
let coords = false;
let steps = 0;
let view = 'board';
let out = 'board-renders';
let size = '1100,1000';
let variants = '';
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--players') players = Number(args[++i]);
  else if (a === '--seed') seed = Number(args[++i]);
  else if (a === '--coords') coords = true;
  else if (a === '--steps') steps = Number(args[++i]);
  else if (a === '--view') view = args[++i];
  else if (a === '--out') out = args[++i];
  else if (a === '--size') size = args[++i];
  else if (a === '--variants') variants = args[++i];
  else specs.push(a);
}
if (specs.length === 0) {
  console.error('usage: render-board.mjs <kind>:<id> [...] [--players N] [--seed N] [--coords] [--out DIR]');
  process.exit(1);
}

const base = process.env.BOARD_URL ?? 'http://localhost:5173/catan/';
const browsers = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const browser = browsers.find((b) => existsSync(b));
if (!browser) {
  console.error('No Chrome / Edge found; set CHROME=/path/to/browser');
  process.exit(1);
}

mkdirSync(out, { recursive: true });
for (const spec of specs) {
  const url = `${base}?preview=${encodeURIComponent(spec)}&players=${players}&seed=${seed}${coords ? '&coords=1' : ''}${steps ? `&steps=${steps}` : ''}${view === 'game' ? '&view=game' : ''}${variants ? `&variants=${variants}` : ''}`;
  const file = resolve(join(out, `${spec.replace(':', '-')}-${players}p-s${seed}${steps ? `-m${steps}` : ''}${view === 'game' ? '-game' : ''}${variants ? `-${variants.replace(/,/g, '+')}` : ''}.png`));
  // A fresh profile per shot: a second Chrome on a shared profile can hand
  // the URL to the first instance and exit without rendering.
  const profile = mkdtempSync(join(tmpdir(), 'catan-render-'));
  execFileSync(
    browser,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      `--window-size=${size}`,
      `--virtual-time-budget=${process.env.RENDER_BUDGET_MS ?? 20000}`,
      `--user-data-dir=${profile}`,
      // Without these the game screen (timers, animations) can screenshot blank.
      '--run-all-compositor-stages-before-draw',
      '--disable-features=PaintHolding',
      '--no-first-run',
      `--screenshot=${file}`,
      url,
    ],
    { stdio: 'ignore' },
  );
  rmSync(profile, { recursive: true, force: true });
  console.log(file);
}
