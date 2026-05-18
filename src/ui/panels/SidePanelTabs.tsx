import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { LogPanel } from './LogPanel';
import { ChatPanel } from '@/ui/chat/ChatPanel';
import { ScenarioPanel, hasScenarioTracker } from './ScenarioPanel';
import './SidePanelTabs.css';

interface Props {
  // Whether chat is available at all (only in online sessions).
  showChat: boolean;
}

type Tab = 'log' | 'chat' | 'scenario';

export function SidePanelTabs({ showChat }: Props) {
  const game = useGameStore((s) => s.game);
  const showScenario = hasScenarioTracker(game);
  const [tab, setTab] = useState<Tab>('log');

  // Single-pane fallbacks when there's nothing to tab between.
  if (!showChat && !showScenario) {
    return <LogPanel />;
  }

  // If the active tab disappears (e.g. an online game where Seafarers wasn't
  // selected), reset to log so we don't render an empty body.
  const activeTab: Tab =
    (tab === 'chat' && !showChat) || (tab === 'scenario' && !showScenario) ? 'log' : tab;

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
      </div>
      <div className="sidetabs-body">
        {activeTab === 'log' && <LogPanel embedded />}
        {activeTab === 'chat' && <ChatPanel compact />}
        {activeTab === 'scenario' && <ScenarioPanel />}
      </div>
    </section>
  );
}
