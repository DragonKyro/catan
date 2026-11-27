import { useMemo, useState } from 'react';
import { createGame } from '@/game/createGame';
import type { Action, GameState, GameSettings } from '@/game/types';
import { applyAction } from '@/game/engine';
import { getActingPlayerId } from '@/game/helpers';
import { rollDice } from '@/game/rng';
import { chooseAction, shouldAcceptTrade } from '@/ai';
import { pendingTradeStep } from '@/ai/trade';
import { BoardSVG } from '@/ui/game/BoardSVG';
import { previewOptions, type PreviewKind, type PreviewSpec } from './previewQuery';
import { TRADERS_SCENARIO_ORDER } from '@/game/modules/traders/board/scenarios';
import { SEAFARERS_EXPANSION_ID } from '@/game/modules/seafarers/constants';
import { TRADERS_EXPANSION_ID } from '@/game/modules/traders/constants';
import { CITIES_AND_KNIGHTS_EXPANSION_ID } from '@/game/modules/citiesAndKnights/constants';
import { EXPLORERS_PIRATES_EXPANSION_ID } from '@/game/modules/explorersPirates/constants';
import './ScenarioPreview.css';

// Scenario preview: renders the board a scenario generates, so a map can be
// checked against the rulebook picture side by side. Reachable two ways:
//   - Map builder → "Preview scenarios" (interactive pickers).
//   - URL `?preview=<kind>:<id>&players=4&seed=1&coords=1&steps=0` — renders only
//     the board, full-window, for headless screenshots
//     (`scripts/render-board.sh` drives Chrome with these URLs).
// <kind> is base | seafarers | traders | ck | ep. `coords=1` overlays each hex's
// axial (q, r), the coordinates scenario files are written in. `steps=N`
// lets heuristic AIs play N moves first (seeded dice), to see pieces
// (roads, knights, wagons, barbarians…) on a mid-game board.

export { previewOptions, parsePreviewQuery, type PreviewKind, type PreviewSpec } from './previewQuery';

export function previewSettings(spec: PreviewSpec): Partial<GameSettings> {
  switch (spec.kind) {
    case 'base':
      return { expansions: [], baseScenarioId: spec.id };
    case 'ck':
      return { expansions: [CITIES_AND_KNIGHTS_EXPANSION_ID], baseScenarioId: spec.id };
    case 'seafarers':
      return { expansions: [SEAFARERS_EXPANSION_ID], scenarioId: spec.id };
    case 'traders':
      return { expansions: [TRADERS_EXPANSION_ID], tradersScenarioId: spec.id };
    case 'ep':
      return { expansions: [EXPLORERS_PIRATES_EXPANSION_ID] };
  }
}

export function buildPreviewGame(spec: PreviewSpec): GameState {
  const names = Array.from({ length: spec.players }, (_, i) => `P${i + 1}`);
  const game = createGame({
    playerNames: names,
    // The AIs play every seat while fast-forwarding; in the game view seat 1
    // is handed back to a human afterwards (see App.tsx).
    playerTypes: names.map(() => 'ai' as const),
    seed: spec.seed,
    settings: {
      ...previewSettings(spec),
      ...(spec.variants?.length
        ? {
            tradersVariants: {
              friendlyRobber: spec.variants.includes('friendlyRobber'),
              strongestPorts: spec.variants.includes('strongestPorts'),
              eventCards: spec.variants.includes('eventCards'),
            },
          }
        : {}),
    },
    randomizeTurnOrder: false,
  });
  return spec.steps ? simulate(game, spec.steps, spec.seed) : game;
}

// Keep playing until `playerId` must act (so the game screen opens on the
// human's move rather than mid-AI-turn). Gives up after `limit` moves.
function simulateUntilActor(
  start: GameState,
  playerId: string,
  seed: number,
  limit = 600,
  phase?: string,
): GameState {
  let s = start;
  for (let n = 0; n < limit && s.phase !== 'gameOver'; n++) {
    if (getActingPlayerId(s) === playerId && !s.pendingTrade && (!phase || s.phase === phase)) return s;
    const next = simulate(s, 1, seed + n);
    if (next === s) return s;
    s = next;
  }
  return s;
}

// Play `steps` heuristic-AI moves with seeded dice. Stops early on game over
// or if a move is rejected (the board so far is still worth looking at).
function simulate(start: GameState, steps: number, seed: number): GameState {
  let s = start;
  let dice = (seed * 2654435761) >>> 0;
  for (let n = 0; n < steps && s.phase !== 'gameOver'; n++) {
    try {
      let action: Action;
      if (s.pendingTrade) {
        action = pendingTradeStep(s, (id) => shouldAcceptTrade(s, id));
      } else {
        const acting = getActingPlayerId(s);
        action = chooseAction(s, acting) ?? { type: 'endTurn', playerId: acting };
      }
      if (action.type === 'rollDice') {
        const [d, next] = rollDice(dice);
        dice = next;
        action = { ...action, dice: d };
      }
      s = applyAction(s, action);
    } catch (err) {
      console.warn(`[preview] stopped after ${n} moves:`, (err as Error).message);
      break;
    }
  }
  return s;
}


function PreviewBoard({ spec }: { spec: PreviewSpec }) {
  const result = useMemo(() => {
    try {
      return { game: buildPreviewGame(spec), error: null as string | null };
    } catch (err) {
      return { game: null, error: (err as Error).message };
    }
  }, [spec]);

  if (result.error || !result.game) {
    return <div className="scenario-preview-error">Could not build board: {result.error}</div>;
  }
  const game = result.game;
  const z = spec.zoom;
  return (
    <div
      className="scenario-preview-board"
      data-ready="1"
      style={z ? { transform: `scale(${z.scale})`, transformOrigin: `${z.x * 100}% ${z.y * 100}%` } : undefined}
    >
      <BoardSVG
        game={game}
        className="scenario-preview-svg"
        overlay={spec.coords ? <CoordLabels game={game} /> : undefined}
      />
    </div>
  );
}

// Coordinate labels rendered inside the board SVG (so they share its
// viewBox): small dark text near the bottom of every hex.
function CoordLabels({ game }: { game: GameState }) {
  const board = game.board;
  return (
    <g className="scenario-preview-coord-labels" pointerEvents="none">
      {board.hexIds.map((hid) => {
        const hex = board.hexes[hid]!;
        return (
          <text
            key={hid}
            x={hex.center.x}
            y={hex.center.y + 32}
            textAnchor="middle"
            fontSize={11}
            fontWeight={700}
            fill="#111"
            stroke="#fff"
            strokeWidth={2.5}
            paintOrder="stroke"
          >
            {hid}
          </text>
        );
      })}
    </g>
  );
}

// The position for `view=game`: fast-forwarded by AIs, then seat 1 (the
// first player in seat order) becomes the human at this device.
export function buildPreviewGameForView(spec: PreviewSpec): GameState {
  const first = buildPreviewGame(spec);
  const humanId = first.players[0]!.id;
  const game = spec.stopAt
    ? simulateUntilActor(first, humanId, spec.seed + 7919, 3000, spec.stopAt)
    : simulateUntilActor(first, humanId, spec.seed + 7919);
  return {
    ...game,
    players: game.players.map((p) => (p.id === humanId ? { ...p, isAI: false } : p)),
  };
}

// Full-window board for `?preview=` URLs (headless screenshots).
export function ScenarioPreviewPage({ spec }: { spec: PreviewSpec }) {
  return (
    <div className="scenario-preview-page">
      <PreviewBoard spec={spec} />
      <div className="scenario-preview-caption">
        {spec.kind}:{spec.id} · {spec.players}p · seed {spec.seed}
        {spec.steps ? ` · ${spec.steps} AI moves` : ''}
      </div>
    </div>
  );
}

// Interactive picker shown from the map builder.
export function ScenarioPreviewScreen({ onBack }: { onBack: () => void }) {
  const [spec, setSpec] = useState<PreviewSpec>({
    kind: 'traders',
    id: TRADERS_SCENARIO_ORDER[0]?.id ?? 'riversOfCatan',
    players: 4,
    seed: 1,
    coords: true,
  });
  const options = previewOptions(spec.kind);
  return (
    <div className="scenario-preview-screen">
      <header className="scenario-preview-header">
        <button type="button" onClick={onBack}>
          ← Back
        </button>
        <label>
          Rules
          <select
            value={spec.kind}
            onChange={(e) => {
              const kind = e.target.value as PreviewKind;
              setSpec((s) => ({ ...s, kind, id: previewOptions(kind)[0]?.id ?? 'standard' }));
            }}
          >
            <option value="base">Base / Fun Maps</option>
            <option value="ck">Cities &amp; Knights</option>
            <option value="seafarers">Seafarers</option>
            <option value="traders">Traders &amp; Barbarians</option>
            <option value="ep">Explorers &amp; Pirates</option>
          </select>
        </label>
        <label>
          Map
          <select value={spec.id} onChange={(e) => setSpec((s) => ({ ...s, id: e.target.value }))}>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Players
          <select
            value={spec.players}
            onChange={(e) => setSpec((s) => ({ ...s, players: Number(e.target.value) }))}
          >
            {[3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label>
          Seed
          <input
            type="number"
            value={spec.seed}
            onChange={(e) => setSpec((s) => ({ ...s, seed: Number(e.target.value) || 1 }))}
          />
        </label>
        <button type="button" onClick={() => setSpec((s) => ({ ...s, seed: s.seed + 1 }))}>
          Reroll
        </button>
        <label>
          AI moves
          <input
            type="number"
            min={0}
            step={50}
            value={spec.steps ?? 0}
            onChange={(e) => setSpec((s) => ({ ...s, steps: Math.max(0, Number(e.target.value) || 0) }))}
          />
        </label>
        <label className="scenario-preview-check">
          <input
            type="checkbox"
            checked={spec.coords}
            onChange={(e) => setSpec((s) => ({ ...s, coords: e.target.checked }))}
          />
          Hex coords
        </label>
      </header>
      <PreviewBoard spec={spec} />
    </div>
  );
}
