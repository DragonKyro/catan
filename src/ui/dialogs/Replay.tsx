import { useEffect, useMemo, useState } from 'react';
import type { Action, GameState, Player } from '@/game/types';
import { applyAction } from '@/game/engine';
import { BoardSVG } from '@/ui/game/BoardSVG';
import { Button } from '@/ui/shared/Button';
import './Replay.css';

interface Props {
  initialState: GameState;
  actions: Action[];
}

const SPEED_PRESETS: Array<{ label: string; ms: number }> = [
  { label: '0.5×', ms: 1500 },
  { label: '1×', ms: 750 },
  { label: '2×', ms: 375 },
  { label: '4×', ms: 180 },
];

// Step + slider + auto-play replay. Renders the board at any historical
// step by re-applying actions[0..step] from the initial state.
export function Replay({ initialState, actions }: Props) {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState(SPEED_PRESETS[1]!.ms);

  // Recompute the historical game state at `step`. For typical games
  // (a few hundred actions) this is sub-millisecond per step, so we don't
  // bother with memoized incremental application.
  const replayState = useMemo(() => {
    let s = initialState;
    for (let i = 0; i < step && i < actions.length; i++) {
      try {
        s = applyAction(s, actions[i]!);
      } catch {
        // Shouldn't happen — actions were validated when originally
        // dispatched. Bail out and show the latest good state.
        return s;
      }
    }
    return s;
  }, [initialState, actions, step]);

  // Auto-advance step while playing.
  useEffect(() => {
    if (!playing) return;
    if (step >= actions.length) {
      setPlaying(false);
      return;
    }
    const id = window.setTimeout(() => setStep((s) => s + 1), speedMs);
    return () => window.clearTimeout(id);
  }, [playing, step, actions.length, speedMs]);

  const maxStep = actions.length;
  const atEnd = step >= maxStep;
  const currentAction = step > 0 ? actions[step - 1] : null;

  return (
    <div className="replay">
      <div className="replay-board">
        <BoardSVG game={replayState} className="replay-boardwrap" />
      </div>

      <div className="replay-status">
        <span className="replay-stepcount">
          Step {step} / {maxStep}
        </span>
        <span className="replay-actionlabel">
          {currentAction
            ? actionDescription(currentAction, replayState.players)
            : 'Initial board'}
        </span>
      </div>

      <input
        type="range"
        className="replay-slider"
        min={0}
        max={maxStep}
        value={step}
        onChange={(e) => {
          setPlaying(false);
          setStep(Number(e.target.value));
        }}
      />

      <div className="replay-controls">
        <Button
          size="sm"
          onClick={() => {
            setPlaying(false);
            setStep(0);
          }}
          disabled={step === 0}
          title="Restart"
        >
          ⏮
        </Button>
        <Button
          size="sm"
          onClick={() => {
            setPlaying(false);
            setStep((s) => Math.max(0, s - 1));
          }}
          disabled={step === 0}
          title="Step back"
        >
          ◀
        </Button>
        <Button
          size="sm"
          variant="primary"
          onClick={() => {
            if (atEnd) {
              setStep(0);
              setPlaying(true);
            } else {
              setPlaying((p) => !p);
            }
          }}
          title={playing ? 'Pause' : atEnd ? 'Restart and play' : 'Play'}
        >
          {playing ? '⏸' : atEnd ? '↻ ▶' : '▶'}
        </Button>
        <Button
          size="sm"
          onClick={() => {
            setPlaying(false);
            setStep((s) => Math.min(maxStep, s + 1));
          }}
          disabled={atEnd}
          title="Step forward"
        >
          ▶
        </Button>
        <Button
          size="sm"
          onClick={() => {
            setPlaying(false);
            setStep(maxStep);
          }}
          disabled={atEnd}
          title="Skip to end"
        >
          ⏭
        </Button>
        <div className="replay-speedgroup">
          {SPEED_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className={`replay-speedbtn${speedMs === preset.ms ? ' is-active' : ''}`}
              onClick={() => setSpeedMs(preset.ms)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function actionDescription(action: Action, players: Player[]): string {
  const name = (id: string) =>
    players.find((p) => p.id === id)?.name ?? id;
  // playerId exists on every action variant the engine accepts.
  const who = name((action as { playerId: string }).playerId);
  switch (action.type) {
    case 'rollDice':
      return `${who} rolls ${action.dice[0] + action.dice[1]} (${action.dice[0]}+${action.dice[1]})`;
    case 'buildSettlement':
      return `${who} builds a settlement`;
    case 'buildCity':
      return `${who} upgrades to a city`;
    case 'buildRoad':
      return `${who} builds a road`;
    case 'buildShip':
      return `${who} builds a ship`;
    case 'buyDevCard':
      return `${who} buys a dev card`;
    case 'endTurn':
      return `${who} ends their turn`;
    case 'bankTrade':
      return `${who} bank-trades ${action.give} for ${action.receive}`;
    case 'moveRobber':
      return `${who} moves the robber${action.stealFrom ? ` and steals from ${name(action.stealFrom)}` : ''}`;
    case 'movePirate':
      return `${who} moves the pirate${action.stealFrom ? ` and steals from ${name(action.stealFrom)}` : ''}`;
    case 'discard':
      return `${who} discards`;
    case 'playKnight':
      return `${who} plays a knight`;
    case 'playRoadBuilding':
      return `${who} plays road-building`;
    case 'playYearOfPlenty':
      return `${who} plays year-of-plenty`;
    case 'playMonopoly':
      return `${who} monopolizes ${action.resource}`;
    case 'placeInitialSettlement':
      return `${who} places initial settlement`;
    case 'placeInitialRoad':
      return `${who} places initial road`;
    case 'proposeTrade':
      return `${who} proposes a trade`;
    case 'acceptTrade':
      return `${who} accepts the trade`;
    case 'cancelTrade':
      return `${who} cancels the trade`;
    case 'rejectTrade':
      return `${who} rejects the trade`;
    case 'counterTrade':
      return `${who} counters the trade`;
    case 'chooseGoldResource':
      return `${who} picks gold resources`;
    case 'moveShip':
      return `${who} moves a ship`;
    default:
      return `${who} — ${(action as Action).type}`;
  }
}

