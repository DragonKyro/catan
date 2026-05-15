import { useRef, useState } from 'react';
import { Button } from '@/ui/shared/Button';
import { NewGame } from './NewGame';
import { OnlineMenu } from './OnlineMenu';
import { Rulebook } from '@/rulebook/Rulebook';
import { useReplayStore, parseReplay } from '@/store/replayStore';
import './HomeMenu.css';

type Mode = 'choose' | 'local' | 'online' | 'rules';

export function HomeMenu() {
  const [mode, setMode] = useState<Mode>('choose');
  const [replayError, setReplayError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const loadReplay = useReplayStore((s) => s.load);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    setReplayError(null);
    file
      .text()
      .then((text) => {
        const data = parseReplay(text);
        loadReplay(data);
      })
      .catch((err: Error) => {
        setReplayError(err.message);
      });
  };

  if (mode === 'local') {
    return <NewGame onBack={() => setMode('choose')} />;
  }
  if (mode === 'online') {
    return <OnlineMenu onBack={() => setMode('choose')} />;
  }
  if (mode === 'rules') {
    return <Rulebook onClose={() => setMode('choose')} />;
  }

  return (
    <div className="home-wrap">
      <div className="home-card">
        <h1 className="home-title">Catan</h1>
        <p className="home-subtitle">Settle. Build. Trade. Conquer.</p>
        <div className="home-buttons">
          <Button variant="primary" size="lg" fullWidth onClick={() => setMode('local')}>
            🏠 Local hot-seat
          </Button>
          <Button size="lg" fullWidth onClick={() => setMode('online')}>
            🌐 Play online
          </Button>
          <Button size="lg" fullWidth onClick={() => setMode('rules')}>
            📖 Rulebook
          </Button>
          <Button size="lg" fullWidth onClick={() => fileInputRef.current?.click()}>
            🎞 Load replay…
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={onFile}
          />
          {replayError && (
            <div className="home-replay-error" role="alert">
              {replayError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
