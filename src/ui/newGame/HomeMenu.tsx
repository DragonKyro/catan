import { useState } from 'react';
import { Button } from '@/ui/shared/Button';
import { NewGame } from './NewGame';
import { OnlineMenu } from './OnlineMenu';
import './HomeMenu.css';

type Mode = 'choose' | 'local' | 'online';

export function HomeMenu() {
  const [mode, setMode] = useState<Mode>('choose');

  if (mode === 'local') {
    return <NewGame onBack={() => setMode('choose')} />;
  }
  if (mode === 'online') {
    return <OnlineMenu onBack={() => setMode('choose')} />;
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
        </div>
      </div>
    </div>
  );
}
