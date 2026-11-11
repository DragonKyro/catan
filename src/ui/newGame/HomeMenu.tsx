import { useRef, useState, type CSSProperties } from 'react';
import { NewGame } from './NewGame';
import { OnlineMenu } from './OnlineMenu';
import { Rulebook } from '@/rulebook/Rulebook';
import { MapBuilderScreen } from '@/ui/mapBuilder/MapBuilderScreen';
import { useReplayStore, parseReplay } from '@/store/replayStore';
import { roomCodeFromUrl } from '@/net';
import { MenuBadge, type MenuBadgeKind } from '@/ui/menu/MenuBadge';
import { RULE_SETS } from '@/ui/menu/ruleSets';
import { ScreenTitle } from '@/ui/menu/ScreenTitle';
import { HomeIsland } from './home/HomeIsland';
import { Wordmark } from './home/Wordmark';
import './HomeMenu.css';

type Mode = 'choose' | 'local' | 'online' | 'rules' | 'builder';

export function HomeMenu() {
  // An invite link (?room=ABCD) opens the online menu on that room.
  const [mode, setMode] = useState<Mode>(() => (roomCodeFromUrl() ? 'online' : 'choose'));
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
    return <Rulebook onClose={() => setMode('choose')} heading={<ScreenTitle badge="rules" title="Rulebook" />} />;
  }
  if (mode === 'builder') {
    return <MapBuilderScreen onBack={() => setMode('choose')} />;
  }

  return (
    <div className="home-root">
      <div className="home-layout">
        <header className="home-brand">
          <h1 className="home-title">
            <Wordmark />
          </h1>
          <p className="home-tagline">Settle the island, trade with friends, and build your way to victory.</p>
          <ul className="home-sets" aria-label="Rule sets">
            {RULE_SETS.map((s, i) => (
              <li key={s.name} style={{ '--c': s.color, '--d': `${0.5 + i * 0.05}s` } as CSSProperties}>
                {s.name}
              </li>
            ))}
          </ul>
        </header>

        <div className="home-hero">
          <HomeIsland />
        </div>

        <nav className="home-menu" aria-label="Main menu">
          <MenuButton
            primary
            badge="local"
            title="Play on this device"
            sub="Hot-seat with friends, or take on the AI"
            index={0}
            onClick={() => setMode('local')}
          />
          <MenuButton
            badge="online"
            title="Play online"
            sub="Host a room, or join one with a code"
            index={1}
            onClick={() => setMode('online')}
          />
          <MenuButton
            badge="rules"
            title="Rulebook"
            sub="Every rule set, with diagrams"
            index={2}
            onClick={() => setMode('rules')}
          />
          <MenuButton
            badge="builder"
            title="Map builder"
            sub="Design an island and preview the scenarios"
            index={3}
            onClick={() => setMode('builder')}
          />
          <MenuButton
            badge="replay"
            title="Load replay…"
            sub="Watch a saved game play out"
            index={4}
            onClick={() => fileInputRef.current?.click()}
          />
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
        </nav>

        <footer className="home-foot">
          A fan-made table for playing CATAN (by Klaus Teuber) with friends. All art drawn for this project.
        </footer>
      </div>
    </div>
  );
}

function MenuButton({
  badge,
  title,
  sub,
  index,
  primary,
  onClick,
}: {
  badge: MenuBadgeKind;
  title: string;
  sub: string;
  index: number;
  primary?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`home-btn${primary ? ' home-btn-primary' : ''}`}
      style={{ '--d': `${0.3 + index * 0.07}s` } as CSSProperties}
      onClick={onClick}
    >
      <span className="home-btn-badge">
        <MenuBadge kind={badge} />
      </span>
      <span className="home-btn-text">
        <span className="home-btn-title">{title}</span>
        <span className="home-btn-sub">{sub}</span>
      </span>
      <span className="home-btn-arrow" aria-hidden>
        ›
      </span>
    </button>
  );
}
