import { useMemo, useState } from 'react';
import { createGame } from '@/game/createGame';
import type { Action, GameState, GameSettings } from '@/game/types';
import { applyAction } from '@/game/engine';
import { getActingPlayerId } from '@/game/helpers';
import { rollDice } from '@/game/rng';
import { chooseAction, shouldAcceptTrade } from '@/ai';
import { BoardSVG } from '@/ui/game/BoardSVG';
import { BASE_SCENARIO_ORDER } from '@/game/modules/base/scenarios';
import { SCENARIO_ORDER } from '@/game/modules/seafarers/board/scenarios';
import { TRADERS_SCENARIO_ORDER } from '@/game/modules/traders/board/scenarios';
import { SEAFARERS_EXPANSION_ID } from '@/game/modules/seafarers/constants';
import { TRADERS_EXPANSION_ID } from '@/game/modules/traders/constants';
import { CITIES_AND_KNIGHTS_EXPANSION_ID } from '@/game/modules/citiesAndKnights/constants';
import './ScenarioPreview.css';

// Scenario preview: renders the board a scenario generates, so a map can be
// checked against the rulebook picture side by side. Reachable two ways:
//   - Map builder → "Preview scenarios" (interactive pickers).
//   - URL `?preview=<kind>:<id>&players=4&seed=1&coords=1&steps=0` — renders only
//     the board, full-window, for headless screenshots
//     (`scripts/render-board.sh` drives Chrome with these URLs).
// <kind> is base | seafarers | traders | ck. `coords=1` overlays each hex's
// axial (q, r), the coordinates scenario files are written in. `steps=N`
// lets heuristic AIs play N moves first (seeded dice), to see pieces
// (roads, knights, wagons, barbarians…) on a mid-game board.

export type PreviewKind = 'base' | 'seafarers' | 'traders' | 'ck';

export interface PreviewSpec {
  kind: PreviewKind;
  id: string;
  players: number;
  seed: number;
  coords: boolean;
  // Heuristic-AI moves to play before rendering (0 = the fresh board).
  steps?: number;
}

export function previewOptions(kind: PreviewKind): { id: string; label: string }[] {
  switch (kind) {
    case 'base':
    case 'ck':
      return BASE_SCENARIO_ORDER;
    case 'seafarers':
      return SCENARIO_ORDER;
    case 'traders':
      return TRADERS_SCENARIO_ORDER;
  }
}

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
  }
}

export function buildPreviewGame(spec: PreviewSpec): GameState {
  const names = Array.from({ length: spec.players }, (_, i) => `P${i + 1}`);
  const game = createGame({
    playerNames: names,
    playerTypes: names.map(() => 'ai' as const),
    seed: spec.seed,
    settings: previewSettings(spec),
    randomizeTurnOrder: false,
  });
  return spec.steps ? simulate(game, spec.steps, spec.seed) : game;
}

// Play `steps` heuristic-AI moves with seeded dice. Stops early on game over
// or if a move is rejected (the board so far is still worth looking at).
function simulate(start: GameState, steps: number, seed: number): GameState {
  let s = start;
  let dice = (seed * 2654435761) >>> 0;
  for (let n = 0; n < steps && s.phase !== 'gameOver'; n++) {
    try {
      let action: Action;
      const pt = s.pendingTrade;
      if (pt) {
        const acceptor = s.players.find((p) => p.id !== pt.proposerId && shouldAcceptTrade(s, p.id));
        action = acceptor
          ? { type: 'acceptTrade', playerId: acceptor.id }
          : { type: 'cancelTrade', playerId: pt.proposerId };
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

// Parse `?preview=...` from a query string. Returns null when absent.
export function parsePreviewQuery(search: string): PreviewSpec | null {
  const params = new URLSearchParams(search);
  const raw = params.get('preview');
  if (!raw) return null;
  const [kindRaw, idRaw] = raw.split(':');
  const kind = (['base', 'seafarers', 'traders', 'ck'] as const).find((k) => k === kindRaw) ?? 'base';
  const id = idRaw || previewOptions(kind)[0]?.id || 'standard';
  const players = Number(params.get('players') ?? 4) || 4;
  const seed = Number(params.get('seed') ?? 1) || 1;
  const coords = params.get('coords') === '1';
  const steps = Number(params.get('steps') ?? 0) || 0;
  return { kind, id, players, seed, coords, steps };
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
  return (
    <div className="scenario-preview-board" data-ready="1">
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
