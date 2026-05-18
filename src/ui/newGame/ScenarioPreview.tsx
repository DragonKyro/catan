import { useMemo } from 'react';
import { createGame } from '@/game/createGame';
import { BoardSVG } from '@/ui/game/BoardSVG';
import './ScenarioPreview.css';

interface Props {
  numPlayers: number;
  expansions: string[];
  scenarioId?: string;
  baseScenarioId?: string;
  tradersScenarioId?: string;
  // Optional caption shown under the preview. Defaults to "<scenario name>
  // (<n> players)" when a scenario is selected, otherwise "Base game
  // (<n> players)".
  caption?: string;
  // Optional fixed seed for the preview generator — keeps the rendered board
  // stable so users compare layouts across player counts / scenarios without
  // the contents jumping around. Defaults to a hard-coded value.
  seed?: number;
}

// Small read-only board preview shown during scenario setup. Generates a
// deterministic GameState with the chosen player count + scenario + a fixed
// seed and renders it via the same BoardSVG the live game uses.
//
// Visible for every player-count / expansion combination — including base
// game — so the same component can power a future custom-map browser.
export function ScenarioPreview({
  numPlayers,
  expansions,
  scenarioId,
  baseScenarioId,
  caption,
  seed = 12345,
}: Props) {
  // Generate the preview state. Wrapped in try/catch because `createGame`
  // throws for invalid combinations (e.g. Seafarers + >6 players) — we'd
  // rather show a friendly placeholder than crash the picker.
  const result = useMemo(() => {
    try {
      const game = createGame({
        playerNames: Array.from({ length: numPlayers }, (_, i) => `P${i + 1}`),
        seed,
        settings: {
          expansions,
          scenarioId,
          baseScenarioId,
        },
        randomizeTurnOrder: false,
      });
      return { game, error: null as string | null };
    } catch (e) {
      return { game: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [numPlayers, expansions, scenarioId, baseScenarioId, seed]);

  const defaultCaption = scenarioId
    ? `${scenarioId} (${numPlayers}p)`
    : baseScenarioId && baseScenarioId !== 'standard'
      ? `${baseScenarioId} (${numPlayers}p)`
      : `Base game (${numPlayers}p)`;

  return (
    <div className="scenario-preview">
      <div className="scenario-preview-frame">
        {result.error ? (
          <div className="scenario-preview-error">{result.error}</div>
        ) : (
          <BoardSVG game={result.game!} className="scenario-preview-board" />
        )}
      </div>
      <div className="scenario-preview-caption">{caption ?? defaultCaption}</div>
    </div>
  );
}
