import { useEffect, useMemo, useRef, useState } from 'react';
import type { Action, GameState, Player, Resource } from '@/game/types';
import { RESOURCES } from '@/game/types';
import { applyAction } from '@/game/engine';
import { calculateVictoryPoints } from '@/game/scoring/points';
import { BoardSVG } from '@/ui/game/BoardSVG';
import { Button } from '@/ui/shared/Button';
import { RESOURCE_ICON, RESOURCE_LABEL } from '@/ui/shared/ResourceChip';
import { playerColorVar } from '@/ui/shared/playerColors';
import { DEV_ICON, DEV_LABEL } from '@/ui/shared/DevCardChip';
import { useReplayStore, downloadReplay } from '@/store/replayStore';
import './ReplayScreen.css';

// Stops we render slider notches for. proposeTrade / cancelTrade /
// rejectTrade / counterTrade are in-flight offers that get folded into
// completed actions; we skip them so the slider isn't dominated by trade
// chatter. State reconstruction still applies every action — just the
// step indexing is filtered.
const MEANINGFUL_ACTIONS = new Set<Action['type']>([
  'placeInitialSettlement',
  'placeInitialRoad',
  'rollDice',
  'buildSettlement',
  'buildCity',
  'buildRoad',
  'buildShip',
  'moveShip',
  'buyDevCard',
  'playKnight',
  'playRoadBuilding',
  'playYearOfPlenty',
  'playMonopoly',
  'moveRobber',
  'movePirate',
  'discard',
  'bankTrade',
  'acceptTrade',
  'endTurn',
  'chooseGoldResource',
]);

const SPEED_PRESETS: Array<{ label: string; ms: number }> = [
  { label: '0.5×', ms: 1500 },
  { label: '1×', ms: 750 },
  { label: '2×', ms: 375 },
  { label: '4×', ms: 180 },
];

export function ReplayScreen() {
  const data = useReplayStore((s) => s.data);
  const clear = useReplayStore((s) => s.clear);

  if (!data) return null;

  return (
    <div className="rscreen">
      <header className="rscreen-head">
        <Button variant="ghost" size="sm" onClick={clear}>
          ← Exit replay
        </Button>
        <div className="rscreen-head-title">
          <span className="rscreen-head-eyebrow">Replay</span>
          <h1>
            {data.label ?? 'Game replay'}
            {data.winner && (
              <span className="rscreen-head-winner">
                {' '}
                · winner: {playerNameFromState(data.initialState, data.winner)}
              </span>
            )}
          </h1>
        </div>
        <Button size="sm" onClick={() => downloadReplay(data)}>
          💾 Save .json
        </Button>
      </header>

      <ReplayBody data={data.initialState} actions={data.actions} />
    </div>
  );
}

function playerNameFromState(state: GameState, id: string): string {
  return state.players.find((p) => p.id === id)?.name ?? id;
}

function ReplayBody({
  data: initialState,
  actions,
}: {
  data: GameState;
  actions: Action[];
}) {
  // Build the filtered slider index. step 0 = initial state. step N (1+)
  // = state after applying actions[0..rawIdx+1] where rawIdx =
  // stepRawIndices[N-1].
  const stepRawIndices = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < actions.length; i++) {
      if (MEANINGFUL_ACTIONS.has(actions[i]!.type)) out.push(i);
    }
    return out;
  }, [actions]);

  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState(SPEED_PRESETS[1]!.ms);

  // Replay state at the current step. Cheap to recompute (single-digit ms
  // for a typical game) — cached via useMemo on (step, actions).
  const replayState = useMemo(() => {
    let s = initialState;
    const rawCut = step <= 0 ? 0 : (stepRawIndices[step - 1] ?? -1) + 1;
    for (let i = 0; i < rawCut && i < actions.length; i++) {
      try {
        s = applyAction(s, actions[i]!);
      } catch {
        return s;
      }
    }
    return s;
  }, [initialState, actions, step, stepRawIndices]);

  useEffect(() => {
    if (!playing) return;
    if (step >= stepRawIndices.length) {
      setPlaying(false);
      return;
    }
    const id = window.setTimeout(() => setStep((s) => s + 1), speedMs);
    return () => window.clearTimeout(id);
  }, [playing, step, stepRawIndices.length, speedMs]);

  const maxStep = stepRawIndices.length;
  const atEnd = step >= maxStep;
  const currentAction =
    step > 0 && stepRawIndices[step - 1] != null
      ? actions[stepRawIndices[step - 1]!]
      : null;

  // Keyboard nav: ←/→ step, space = play/pause. Don't fire inside inputs.
  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
      ) {
        return;
      }
      if (e.key === 'ArrowRight') {
        setPlaying(false);
        setStep((s) => Math.min(maxStep, s + 1));
        e.preventDefault();
      } else if (e.key === 'ArrowLeft') {
        setPlaying(false);
        setStep((s) => Math.max(0, s - 1));
        e.preventDefault();
      } else if (e.key === ' ') {
        setPlaying((p) => !p);
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [maxStep]);

  return (
    <div className="rscreen-body" ref={containerRef}>
      <div className="rscreen-board">
        <BoardSVG game={replayState} className="rscreen-boardwrap" />
      </div>

      <div className="rscreen-players">
        {replayState.players.map((p) => (
          <PlayerCard
            key={p.id}
            player={p}
            game={replayState}
            isActing={getActingPlayerId(replayState) === p.id}
          />
        ))}
      </div>

      <div className="rscreen-status">
        <span className="rscreen-stepcount">
          Step {step} / {maxStep}
        </span>
        <span className="rscreen-actionlabel">
          {currentAction
            ? actionDescription(currentAction, replayState.players)
            : 'Initial board — pre-setup'}
        </span>
      </div>

      <input
        type="range"
        className="rscreen-slider"
        min={0}
        max={maxStep}
        value={step}
        onChange={(e) => {
          setPlaying(false);
          setStep(Number(e.target.value));
        }}
        aria-label="Replay step"
      />

      <div className="rscreen-controls">
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
          title="Step back (←)"
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
          title={playing ? 'Pause (space)' : atEnd ? 'Restart and play' : 'Play (space)'}
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
          title="Step forward (→)"
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
        <div className="rscreen-speedgroup">
          {SPEED_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className={`rscreen-speedbtn${speedMs === preset.ms ? ' is-active' : ''}`}
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

function getActingPlayerId(state: GameState): string | null {
  const idx = state.turnHolderIndex ?? state.currentPlayerIndex;
  return state.playerOrder[idx] ?? null;
}

// Per-player card showing VP, hand resources (per-resource counts),
// known dev cards (split into in-hand vs played-knights vs hidden VP),
// and remaining pieces. Acting-player gets a subtle highlight band.
function PlayerCard({
  player,
  game,
  isActing,
}: {
  player: Player;
  game: GameState;
  isActing: boolean;
}) {
  const vp = calculateVictoryPoints(game, player.id, true);
  const visibleVp = calculateVictoryPoints(game, player.id, false);
  const hiddenVp = vp - visibleVp;
  let handTotal = 0;
  for (const r of RESOURCES) handTotal += player.resources[r];

  // Count unplayed dev cards by type. boughtThisTurn cards are included
  // (they're still in hand, just not playable this turn). Hidden VP
  // cards are not lumped here — they're shown separately so a viewer can
  // see "this player has N face-down cards" without revealing types.
  const devCountByType: Record<string, number> = {};
  for (const c of player.devCards.unplayed) {
    if (c !== 'victoryPoint') {
      devCountByType[c] = (devCountByType[c] ?? 0) + 1;
    }
  }
  for (const c of player.devCards.boughtThisTurn) {
    if (c !== 'victoryPoint') {
      devCountByType[c] = (devCountByType[c] ?? 0) + 1;
    }
  }
  const hiddenVpCount = player.devCards.victoryPoints;
  const playedKnights = player.devCards.playedKnights;

  return (
    <div
      className={`rscreen-pcard${isActing ? ' is-acting' : ''}`}
      style={{ borderColor: playerColorVar(player.color) }}
    >
      <div className="rscreen-pcard-head">
        <span
          className="rscreen-pcard-swatch"
          style={{ background: playerColorVar(player.color) }}
        />
        <span className="rscreen-pcard-name">{player.name}</span>
        <span className="rscreen-pcard-vp" title="Victory points (incl. hidden)">
          {vp}{' '}
          <span className="rscreen-pcard-vplabel">VP</span>
        </span>
      </div>

      <div className="rscreen-pcard-row" title={`Hand: ${handTotal} cards total`}>
        {RESOURCES.map((r: Resource) => (
          <span
            key={r}
            className={`rscreen-pcard-cell${player.resources[r] > 0 ? '' : ' is-zero'}`}
            title={`${player.resources[r]} ${RESOURCE_LABEL[r]}`}
          >
            <span aria-hidden>{RESOURCE_ICON[r]}</span>
            <span className="rscreen-pcard-count">{player.resources[r]}</span>
          </span>
        ))}
      </div>

      <div className="rscreen-pcard-row rscreen-pcard-devrow">
        {(['knight', 'roadBuilding', 'yearOfPlenty', 'monopoly'] as const).map(
          (t) => {
            const c = devCountByType[t] ?? 0;
            return (
              <span
                key={t}
                className={`rscreen-pcard-cell${c > 0 ? '' : ' is-zero'}`}
                title={`${c} ${DEV_LABEL[t]} in hand`}
              >
                <span aria-hidden>{DEV_ICON[t]}</span>
                <span className="rscreen-pcard-count">{c}</span>
              </span>
            );
          },
        )}
        <span
          className={`rscreen-pcard-cell${hiddenVpCount > 0 ? '' : ' is-zero'}`}
          title={`${hiddenVpCount} hidden VP cards`}
        >
          <span aria-hidden>🏆</span>
          <span className="rscreen-pcard-count">{hiddenVpCount}</span>
        </span>
        <span
          className={`rscreen-pcard-cell${playedKnights > 0 ? '' : ' is-zero'}`}
          title={`${playedKnights} knights played`}
        >
          <span aria-hidden>⚔️</span>
          <span className="rscreen-pcard-count rscreen-pcard-playedlabel">
            {playedKnights}
          </span>
        </span>
      </div>

      <div className="rscreen-pcard-pieces" aria-label="Pieces remaining">
        <span title="Settlements left">
          🏠 {5 - player.settlements.length}
        </span>
        <span title="Cities left">
          🏛 {4 - player.cities.length}
        </span>
        <span title="Roads left">
          🛣 {15 - player.roads.length}
        </span>
        {hiddenVp > 0 && (
          <span title={`${hiddenVp} hidden VP revealed at game end`}>
            (hidden +{hiddenVp})
          </span>
        )}
      </div>
    </div>
  );
}

function actionDescription(action: Action, players: Player[]): string {
  const name = (id: string) =>
    players.find((p) => p.id === id)?.name ?? id;
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
      return `${who} monopolises ${action.resource}`;
    case 'placeInitialSettlement':
      return `${who} places initial settlement`;
    case 'placeInitialRoad':
      return `${who} places initial road`;
    case 'acceptTrade':
      return `${who} accepts the trade`;
    case 'chooseGoldResource':
      return `${who} picks gold resources`;
    case 'moveShip':
      return `${who} moves a ship`;
    default:
      return `${who} — ${(action as Action).type}`;
  }
}
