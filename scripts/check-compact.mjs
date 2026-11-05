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

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

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
const browser = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find((b) => b && existsSync(b));
if (!browser) {
  console.error('No Chrome / Edge found; set CHROME=/path/to/browser');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForFile(path, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (existsSync(path)) {
      const text = readFileSync(path, 'utf8');
      if (text.includes('\n')) return text;
    }
    await sleep(100);
  }
  throw new Error(`timed out waiting for ${path}`);
}

// Minimal CDP client over the page target's WebSocket.
function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString());
    if (msg.id && pending.has(msg.id)) {
      const { ok, fail } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) fail(new Error(msg.error.message));
      else ok(msg.result);
    }
  };
  const ready = new Promise((r, j) => {
    ws.onopen = r;
    ws.onerror = j;
  });
  const send = (method, params = {}) =>
    new Promise((ok, fail) => {
      const n = ++id;
      pending.set(n, { ok, fail });
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  return { ready, send, close: () => ws.close() };
}

async function evaluate(client, expression) {
  const r = await client.send('Runtime.evaluate', { expression, returnByValue: true });
  return r.result?.value;
}

mkdirSync(out, { recursive: true });
const profile = mkdtempSync(join(tmpdir(), 'catan-compact-'));
const chrome = spawn(
  browser,
  ['--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${profile}`, '--remote-debugging-port=0', 'about:blank'],
  { stdio: 'ignore' },
);
let failed = false;
try {
  const portFile = await waitForFile(join(profile, 'DevToolsActivePort'), 15000);
  const port = portFile.split('\n')[0].trim();
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = list.find((t) => t.type === 'page');
  const client = cdp(page.webSocketDebuggerUrl);
  await client.ready;
  await client.send('Page.enable');
  await client.send('Runtime.enable');
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
      await client.send('Emulation.setDeviceMetricsOverride', {
        width: w,
        height: h,
        deviceScaleFactor: 2,
        mobile: true,
      });
      await client.send('Page.navigate', { url: `${base}?${params}` });
      // Wait for the game screen to mount (the fast-forward runs at load).
      const end = Date.now() + 60000;
      while (Date.now() < end) {
        if (await evaluate(client, `!!document.querySelector('.gameview')`)) break;
        await sleep(250);
      }
      await sleep(800);
      const m = await evaluate(
        client,
        `JSON.stringify({ sh: document.scrollingElement.scrollHeight, ih: innerHeight, sw: document.scrollingElement.scrollWidth, iw: innerWidth })`,
      );
      const { sh, ih, sw, iw } = JSON.parse(m ?? '{}');
      const scrolls = sh > ih || sw > iw;
      if (scrolls) failed = true;
      const shot = await client.send('Page.captureScreenshot', { format: 'png' });
      const file = resolve(join(out, `${spec.replace(':', '-')}-${w}x${h}.png`));
      writeFileSync(file, Buffer.from(shot.data, 'base64'));
      console.log(
        `${scrolls ? 'SCROLLS' : 'ok     '} ${spec} ${w}x${h}  scroll ${sw}x${sh} vs viewport ${iw}x${ih}  ${file}`,
      );
    }
  }
  client.close();
} finally {
  chrome.kill();
  await sleep(300);
  rmSync(profile, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
