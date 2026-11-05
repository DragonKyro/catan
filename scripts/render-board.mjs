#!/usr/bin/env node
// Screenshot scenario boards with headless Chrome / Edge, for checking a map
// against its rulebook picture.
//
//   npm run dev                      # in another terminal (or set BOARD_URL)
//   node scripts/render-board.mjs traders:riversOfCatan traders:fishingOnCatan \
//     --players 4 --seed 3 --coords --steps 300 [--view game] --out board-renders
//
// Each spec is <kind>:<id> (kind = base | seafarers | traders | ck | ep), the same
// format as the app's `?preview=` URL (src/ui/mapBuilder/ScenarioPreview.tsx).
// Writes <out>/<kind>-<id>-<players>p-s<seed>[-m<steps>][-game].png. `--view game`
// shows the whole game screen (seat 1 human) instead of the bare board.
// `--zoom 3 --at 0.4,0.5` magnifies the bare board around that point
// (fractions of its width / height) to check small pieces. `--stop-at
// <phase>` (game view) plays on until seat 1 acts in that phase.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { openBrowser } from './lib/chrome.mjs';

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
let dialog = '';
let mode = '';
let zoom = '';
let stopAt = '';
let at = '';
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
  else if (a === '--dialog') dialog = args[++i];
  else if (a === '--mode') mode = args[++i];
  else if (a === '--zoom') zoom = args[++i];
  else if (a === '--stop-at') stopAt = args[++i];
  else if (a === '--at') at = args[++i];
  else specs.push(a);
}
if (specs.length === 0) {
  console.error('usage: render-board.mjs <kind>:<id> [...] [--players N] [--seed N] [--coords] [--out DIR]');
  process.exit(1);
}

const base = process.env.BOARD_URL ?? 'http://localhost:5173/catan/';
const [width, height] = size.split(',').map(Number);

mkdirSync(out, { recursive: true });
const chrome = await openBrowser();
let failed = false;
try {
  await chrome.emulate(width, height);
  // Warm-up: the dev server's first page load can stall while Vite
  // optimises dependencies, so load the app once before the real shots.
  await chrome.navigate(base);
  await chrome.waitFor('#root > *', 60000);
  for (const spec of specs) {
    const url = `${base}?preview=${encodeURIComponent(spec)}&players=${players}&seed=${seed}${coords ? '&coords=1' : ''}${steps ? `&steps=${steps}` : ''}${view === 'game' ? '&view=game' : ''}${variants ? `&variants=${variants}` : ''}${dialog ? `&dialog=${dialog}` : ''}${mode ? `&mode=${mode}` : ''}${zoom ? `&zoom=${zoom}` : ''}${at ? `&at=${at}` : ''}${stopAt ? `&stopAt=${stopAt}` : ''}`;
    const file = resolve(join(out, `${spec.replace(':', '-')}-${players}p-s${seed}${steps ? `-m${steps}` : ''}${view === 'game' ? '-game' : ''}${variants ? `-${variants.replace(/,/g, '+')}` : ''}${dialog ? `-${dialog}` : ''}${mode ? `-${mode}` : ''}${zoom ? `-z${zoom}@${at.replace(',', '_')}` : ''}${stopAt ? `-${stopAt}` : ''}.png`));
    await chrome.navigate(url);
    // The fast-forward runs while the page loads; wait for the screen it
    // renders (or the preview's error message) before the shot.
    const selector = view === 'game' ? '.gameview' : '.scenario-preview-board, .scenario-preview-error';
    const timeout = Number(process.env.RENDER_TIMEOUT_MS ?? 60000);
    let ready = await chrome.waitFor(selector, timeout);
    if (!ready) {
      await chrome.reload();
      ready = await chrome.waitFor(selector, timeout);
    }
    if (!ready) failed = true;
    writeFileSync(file, await chrome.screenshot());
    console.log(`${ready ? '' : 'TIMED OUT (shot anyway): '}${file}`);
  }
} finally {
  await chrome.close();
}
process.exit(failed ? 1 : 0);
