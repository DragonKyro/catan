import { useState } from 'react';
import { Button } from '@/ui/shared/Button';
import { useGameStore } from '@/store/gameStore';
import type { PlayerKind } from '@/game/createGame';
import './NewGame.css';

const DEFAULT_NAMES = ['You', 'AI 1', 'AI 2', 'AI 3'];
const DEFAULT_TYPES: PlayerKind[] = ['human', 'ai', 'ai', 'ai'];
const PLAYER_COLOR_HEX = ['#d94545', '#3a6ec9', '#e08b3c', '#efefef'];

interface Props {
  onBack?: () => void;
}

export function NewGame({ onBack }: Props = {}) {
  const [numPlayers, setNumPlayers] = useState(3);
  const [names, setNames] = useState(DEFAULT_NAMES);
  const [types, setTypes] = useState<PlayerKind[]>(DEFAULT_TYPES);
  const [vp, setVp] = useState(10);
  const [seed, setSeed] = useState('');
  const newGame = useGameStore((s) => s.newGame);

  const start = () => {
    const finalSeed = seed ? hashSeed(seed) : Math.floor(Math.random() * 0xffffffff);
    newGame({
      playerNames: names.slice(0, numPlayers),
      playerTypes: types.slice(0, numPlayers),
      seed: finalSeed,
      settings: { victoryPointsToWin: vp },
    });
  };

  const setType = (i: number, kind: PlayerKind) => {
    const next = [...types];
    next[i] = kind;
    setTypes(next);
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
            {[2, 3, 4].map((n) => (
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
          {Array.from({ length: numPlayers }).map((_, i) => (
            <div key={i} className="newgame-player">
              <span
                className="newgame-swatch"
                style={{ background: PLAYER_COLOR_HEX[i] }}
                aria-hidden
              />
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
          ))}
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
