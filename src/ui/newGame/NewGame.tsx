import { useEffect, useState } from 'react';
import { Button } from '@/ui/shared/Button';
import { useGameStore } from '@/store/gameStore';
import type { PlayerKind } from '@/game/createGame';
import type { PlayerColor } from '@/game/types';
import {
  PLAYER_COLORS,
  PLAYER_COLOR_HEX,
  PLAYER_COLOR_LABEL,
} from '@/ui/shared/playerColors';
import {
  ExpansionPicker,
  DEFAULT_EXPANSIONS,
  expansionListFrom,
  activeScenario,
  type ExpansionPickerValue,
} from './ExpansionPicker';
import { ScenarioPreview } from './ScenarioPreview';
import './NewGame.css';

const DEFAULT_NAMES = ['You', 'AI 1', 'AI 2', 'AI 3', 'AI 4', 'AI 5', 'AI 6', 'AI 7'];
const DEFAULT_TYPES: PlayerKind[] = ['human', 'ai', 'ai', 'ai', 'ai', 'ai', 'ai', 'ai'];
const DEFAULT_COLORS: PlayerColor[] = ['red', 'blue', 'orange', 'white', 'purple', 'pink', 'teal', 'gold'];

// Recommended VP target. Base game uses 10 VP for all player counts (the
// official rule — more players don't change the goal, only the wait time).
// Seafarers scenarios override this via their own defaultVpToWin, with a
// separate defaultVpToWin5_6 for the larger 5-6 player layout.
function recommendedVp(numPlayers: number, expansions: ExpansionPickerValue): number {
  const scenario = activeScenario(expansions);
  if (numPlayers >= 5 && scenario.defaultVpToWin5_6 != null) {
    return scenario.defaultVpToWin5_6;
  }
  return scenario.defaultVpToWin;
}

interface Props {
  onBack?: () => void;
}

export function NewGame({ onBack }: Props = {}) {
  const [numPlayers, setNumPlayers] = useState(4);
  const [names, setNames] = useState(DEFAULT_NAMES);
  const [types, setTypes] = useState<PlayerKind[]>(DEFAULT_TYPES);
  const [colors, setColors] = useState<PlayerColor[]>(DEFAULT_COLORS);
  const [openPicker, setOpenPicker] = useState<number | null>(null);
  // null = follow the recommended default for the current player count; a
  // number means the user explicitly chose this VP. Lets the visible default
  // track the segmented picker (10 → 12 when crossing into 7-8p) while still
  // respecting an explicit override.
  const [vpOverride, setVpOverride] = useState<number | null>(null);
  const [turnTimer, setTurnTimer] = useState(0); // seconds; 0 = off
  const [seed, setSeed] = useState('');
  const [expansions, setExpansions] = useState<ExpansionPickerValue>(DEFAULT_EXPANSIONS);
  const newGame = useGameStore((s) => s.newGame);

  const scenario = activeScenario(expansions);
  const isFunMap = scenario.kind === 'base' && expansions.baseScenarioId !== 'standard';
  // Standard's player window covers 2-8 but the lobby still defaults to 3-8.
  const minPlayers = isFunMap ? scenario.minPlayers : scenario.kind === 'seafarers' ? scenario.minPlayers : 3;
  const maxPlayers = isFunMap ? scenario.maxPlayers : scenario.kind === 'seafarers' ? scenario.maxPlayers : 8;
  const recommendedVpValue = recommendedVp(numPlayers, expansions);
  const vp = vpOverride ?? recommendedVpValue;

  // Auto-bump the seat count when the active scenario doesn't support it
  // (e.g. switching from 6-player base to a 3-4-only Seafarers scenario).
  useEffect(() => {
    if (numPlayers < minPlayers) setNumPlayers(minPlayers);
    else if (numPlayers > maxPlayers) setNumPlayers(maxPlayers);
  }, [minPlayers, maxPlayers, numPlayers]);

  const start = () => {
    const finalSeed = seed ? hashSeed(seed) : Math.floor(Math.random() * 0xffffffff);
    newGame({
      playerNames: names.slice(0, numPlayers),
      playerTypes: types.slice(0, numPlayers),
      playerColors: colors.slice(0, numPlayers),
      seed: finalSeed,
      settings: {
        victoryPointsToWin: vp,
        expansions: expansionListFrom(expansions),
        scenarioId: expansions.seafarers ? expansions.scenarioId : undefined,
        baseScenarioId:
          !expansions.seafarers && !expansions.traders
            ? expansions.baseScenarioId
            : undefined,
        tradersScenarioId: expansions.traders
          ? expansions.tradersScenarioId
          : undefined,
        tradersVariants: expansions.traders
          ? expansions.tradersVariants
          : undefined,
        turnTimerSec: turnTimer > 0 ? turnTimer : undefined,
      },
    });
  };

  const setType = (i: number, kind: PlayerKind) => {
    const next = [...types];
    next[i] = kind;
    setTypes(next);
  };

  const setColor = (i: number, color: PlayerColor) => {
    const next = [...colors];
    // If another seat already had this color, swap so all seats remain unique.
    const taker = next.findIndex((c, j) => c === color && j !== i);
    if (taker !== -1) next[taker] = next[i]!;
    next[i] = color;
    setColors(next);
    setOpenPicker(null);
  };

  // Expansions / scenario for the live preview. Computed from the current
  // form state so the preview tracks every setting change.
  const previewExpansions = expansionListFrom(expansions);
  const previewScenarioId = expansions.seafarers ? expansions.scenarioId : undefined;
  const previewBaseScenarioId =
    !expansions.seafarers && !expansions.traders
      ? expansions.baseScenarioId
      : undefined;
  const previewCaption =
    scenario.kind === 'traders'
      ? `${scenario.name} (${numPlayers}p)`
      : isFunMap
        ? `${scenario.name} (${numPlayers}p)`
        : scenario.kind === 'seafarers'
          ? `${scenario.name} (${numPlayers}p)`
          : numPlayers >= 7
            ? `Base game 7-8p extension (${numPlayers}p)`
            : numPlayers >= 5
              ? `Base game 5-6p extension (${numPlayers}p)`
              : `Base game (${numPlayers}p)`;

  return (
    <div className="newgame-wrap">
      <div className="newgame-card">
        {onBack && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <Button variant="ghost" size="sm" onClick={onBack}>← Back</Button>
          </div>
        )}
        <h1 className="newgame-title">Local hot-seat</h1>
        <p className="newgame-subtitle">All players on one device</p>

        <label className="newgame-field">
          <span>Players</span>
          <div className="newgame-segmented">
            {[3, 4, 5, 6, 7, 8].map((n) => {
              const disabled = n < minPlayers || n > maxPlayers;
              return (
                <button
                  key={n}
                  type="button"
                  disabled={disabled}
                  className={`newgame-seg${numPlayers === n ? ' active' : ''}`}
                  onClick={() => setNumPlayers(n)}
                  title={
                    disabled && scenario
                      ? `${scenario.name} supports ${minPlayers}-${maxPlayers} players`
                      : undefined
                  }
                >
                  {n}
                </button>
              );
            })}
          </div>
        </label>

        <div className="newgame-players">
          {Array.from({ length: numPlayers }).map((_, i) => {
            const color = colors[i] ?? DEFAULT_COLORS[i]!;
            const isPickerOpen = openPicker === i;
            return (
              <div key={i} className="newgame-player">
                <div className="newgame-swatch-wrap">
                  <button
                    type="button"
                    className="newgame-swatch newgame-swatch-btn"
                    style={{ background: PLAYER_COLOR_HEX[color] }}
                    onClick={() =>
                      setOpenPicker(isPickerOpen ? null : i)
                    }
                    aria-label={`Player ${i + 1} color (${PLAYER_COLOR_LABEL[color]})`}
                    aria-expanded={isPickerOpen}
                    title={`${PLAYER_COLOR_LABEL[color]} — click to change`}
                  />
                  {isPickerOpen && (
                    <div className="newgame-colorpicker" role="listbox">
                      {PLAYER_COLORS.map((c) => {
                        const takenByOther = colors
                          .slice(0, numPlayers)
                          .some((cc, j) => cc === c && j !== i);
                        const isMine = color === c;
                        return (
                          <button
                            key={c}
                            type="button"
                            role="option"
                            aria-selected={isMine}
                            className={`newgame-colorpicker-opt${isMine ? ' is-mine' : ''}${takenByOther ? ' is-taken' : ''}`}
                            style={{ background: PLAYER_COLOR_HEX[c] }}
                            onClick={() => setColor(i, c)}
                            title={
                              takenByOther
                                ? `${PLAYER_COLOR_LABEL[c]} — taken (will swap)`
                                : PLAYER_COLOR_LABEL[c]
                            }
                          >
                            {isMine && <span className="newgame-colorpicker-check">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <input
                  type="text"
                  value={names[i] ?? ''}
                  onChange={(e) => {
                    const next = [...names];
                    next[i] = e.target.value;
                    setNames(next);
                  }}
                  maxLength={20}
                />
                <div className="newgame-segmented newgame-segmented-sm">
                  <button
                    type="button"
                    className={`newgame-seg${types[i] === 'human' ? ' active' : ''}`}
                    onClick={() => setType(i, 'human')}
                  >
                    Human
                  </button>
                  <button
                    type="button"
                    className={`newgame-seg${types[i] === 'ai' ? ' active' : ''}`}
                    onClick={() => setType(i, 'ai')}
                  >
                    AI
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <label className="newgame-field">
          <span>
            Victory points to win
            <span className="newgame-vp-hint">
              {' '}(default: {recommendedVpValue}
              {scenario ? ` — ${scenario.name} rules` : ''})
            </span>
          </span>
          <input
            type="number"
            min={3}
            max={20}
            value={vp}
            onChange={(e) =>
              setVpOverride(
                Math.max(3, Math.min(20, Number(e.target.value) || recommendedVpValue)),
              )
            }
          />
        </label>

        <ExpansionPicker value={expansions} onChange={setExpansions} />

        <label className="newgame-field">
          <span>Turn timer</span>
          <div className="newgame-segmented">
            {[
              { v: 0, label: 'Off' },
              { v: 30, label: '30s' },
              { v: 60, label: '1m' },
              { v: 90, label: '90s' },
              { v: 180, label: '3m' },
            ].map((opt) => (
              <button
                key={opt.v}
                type="button"
                className={`newgame-seg${turnTimer === opt.v ? ' active' : ''}`}
                onClick={() => setTurnTimer(opt.v)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </label>

        <label className="newgame-field">
          <span>Seed (optional)</span>
          <input
            type="text"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            placeholder="leave blank for random"
          />
        </label>

        <Button variant="primary" size="lg" fullWidth onClick={start}>
          Start game
        </Button>
      </div>
      <aside className="newgame-preview-pane">
        <h3 className="newgame-preview-heading">Map preview</h3>
        <ScenarioPreview
          numPlayers={numPlayers}
          expansions={previewExpansions}
          scenarioId={previewScenarioId}
          baseScenarioId={previewBaseScenarioId}
          tradersScenarioId={
            expansions.traders ? expansions.tradersScenarioId : undefined
          }
          caption={previewCaption}
        />
        <p className="newgame-preview-note">
          Sample layout for the chosen settings. Terrain, number tokens, and
          harbor types are randomized at game start; the shape stays the same
          for a given scenario + player count.
        </p>
      </aside>
    </div>
  );
}

function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
