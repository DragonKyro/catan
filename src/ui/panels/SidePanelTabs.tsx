import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { LogPanel } from './LogPanel';
import { ChatPanel } from '@/ui/chat/ChatPanel';
import { ScenarioPanel, hasScenarioTracker } from './ScenarioPanel';
import { BarbariansPanel, hasBarbariansTracker } from './BarbariansPanel';
import './SidePanelTabs.css';

interface Props {
  // Whether chat is available at all (only in online sessions).
  showChat: boolean;
}

type Tab = 'log' | 'chat' | 'scenario' | 'barbarians';

export function SidePanelTabs({ showChat }: Props) {
  const game = useGameStore((s) => s.game);
  const showScenario = hasScenarioTracker(game);
  const showBarbarians = hasBarbariansTracker(game);
  const [tab, setTab] = useState<Tab>('log');

  // Single-pane fallbacks when there's nothing to tab between.
  if (!showChat && !showScenario && !showBarbarians) {
    return <LogPanel />;
  }

  // If the active tab disappears (e.g. an online game where Seafarers wasn't
  // selected), reset to log so we don't render an empty body.
  const activeTab: Tab =
    (tab === 'chat' && !showChat) ||
    (tab === 'scenario' && !showScenario) ||
    (tab === 'barbarians' && !showBarbarians)
      ? 'log'
      : tab;

  return (
    <section className="sidetabs">
      <div className="sidetabs-bar" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'log'}
          className={`sidetabs-tab ${activeTab === 'log' ? 'is-active' : ''}`}
          onClick={() => setTab('log')}
        >
          Log
        </button>
        {showChat && (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'chat'}
            className={`sidetabs-tab ${activeTab === 'chat' ? 'is-active' : ''}`}
            onClick={() => setTab('chat')}
          >
            Chat
          </button>
        )}
        {showScenario && (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'scenario'}
            className={`sidetabs-tab ${activeTab === 'scenario' ? 'is-active' : ''}`}
            onClick={() => setTab('scenario')}
          >
            Scenario
          </button>
        )}
        {showBarbarians && (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'barbarians'}
            className={`sidetabs-tab ${activeTab === 'barbarians' ? 'is-active' : ''}`}
            onClick={() => setTab('barbarians')}
          >
            Barbarians
          </button>
        )}
      </div>
      <div className="sidetabs-body">
        {activeTab === 'log' && <LogPanel embedded />}
        {activeTab === 'chat' && <ChatPanel compact />}
        {activeTab === 'scenario' && <ScenarioPanel />}
        {activeTab === 'barbarians' && <BarbariansPanel />}
      </div>
    </section>
  );
}
