import { useState } from 'react';
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
  type ExpansionPickerValue,
} from './ExpansionPicker';
import './NewGame.css';

const DEFAULT_NAMES = ['You', 'AI 1', 'AI 2', 'AI 3', 'AI 4', 'AI 5'];
const DEFAULT_TYPES: PlayerKind[] = ['human', 'ai', 'ai', 'ai', 'ai', 'ai'];
const DEFAULT_COLORS: PlayerColor[] = ['red', 'blue', 'orange', 'white', 'purple', 'pink'];

interface Props {
  onBack?: () => void;
}

export function NewGame({ onBack }: Props = {}) {
  const [numPlayers, setNumPlayers] = useState(4);
  const [names, setNames] = useState(DEFAULT_NAMES);
  const [types, setTypes] = useState<PlayerKind[]>(DEFAULT_TYPES);
  const [colors, setColors] = useState<PlayerColor[]>(DEFAULT_COLORS);
  const [openPicker, setOpenPicker] = useState<number | null>(null);
  const [vp, setVp] = useState(10);
  const [turnTimer, setTurnTimer] = useState(0); // seconds; 0 = off
  const [seed, setSeed] = useState('');
  const [expansions, setExpansions] = useState<ExpansionPickerValue>(DEFAULT_EXPANSIONS);
  const newGame = useGameStore((s) => s.newGame);

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
            {[3, 4, 5, 6].map((n) => (
              <button
                key={n}
                type="button"
                className={`newgame-seg${numPlayers === n ? ' active' : ''}`}
                onClick={() => setNumPlayers(n)}
              >
                {n}
              </button>
            ))}
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
          <span>Victory points to win</span>
          <input
            type="number"
            min={3}
            max={20}
            value={vp}
            onChange={(e) => setVp(Math.max(3, Math.min(20, Number(e.target.value) || 10)))}
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
