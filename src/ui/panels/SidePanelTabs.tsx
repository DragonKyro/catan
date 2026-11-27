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

/** The log / chat box minimized to its tab bar (remembered on this device). */
const COLLAPSED_KEY = 'catan.sidePanelCollapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function SidePanelTabs({ showChat }: Props) {
  const game = useGameStore((s) => s.game);
  const showScenario = hasScenarioTracker(game);
  const showBarbarians = hasBarbariansTracker(game);
  const [tab, setTab] = useState<Tab>('log');
  const [collapsed, setCollapsedState] = useState(readCollapsed);
  const setCollapsed = (v: boolean) => {
    setCollapsedState(v);
    try {
      localStorage.setItem(COLLAPSED_KEY, v ? '1' : '0');
    } catch {
      // Private mode: just not remembered.
    }
  };
  // A tab click while minimized opens the box on that tab.
  const pick = (t: Tab) => {
    setTab(t);
    if (collapsed) setCollapsed(false);
  };
  const onlyLog = !showChat && !showScenario && !showBarbarians;

  // If the active tab disappears (e.g. an online game where Seafarers wasn't
  // selected), reset to log so we don't render an empty body.
  const activeTab: Tab =
    (tab === 'chat' && !showChat) ||
    (tab === 'scenario' && !showScenario) ||
    (tab === 'barbarians' && !showBarbarians)
      ? 'log'
      : tab;

  return (
    <section className={`sidetabs${collapsed ? ' is-collapsed' : ''}`}>
      <div className="sidetabs-bar" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'log'}
          className={`sidetabs-tab ${activeTab === 'log' && !collapsed ? 'is-active' : ''}`}
          onClick={() => pick('log')}
        >
          {onlyLog ? 'Game log' : 'Log'}
        </button>
        {showChat && (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'chat'}
            className={`sidetabs-tab ${activeTab === 'chat' && !collapsed ? 'is-active' : ''}`}
            onClick={() => pick('chat')}
          >
            Chat
          </button>
        )}
        {showScenario && (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'scenario'}
            className={`sidetabs-tab ${activeTab === 'scenario' && !collapsed ? 'is-active' : ''}`}
            onClick={() => pick('scenario')}
          >
            Scenario
          </button>
        )}
        {showBarbarians && (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'barbarians'}
            className={`sidetabs-tab ${activeTab === 'barbarians' && !collapsed ? 'is-active' : ''}`}
            onClick={() => pick('barbarians')}
          >
            Barbarians
          </button>
        )}
        <button
          type="button"
          className="sidetabs-min"
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Show the log' : 'Minimize the log'}
          title={collapsed ? 'Show' : 'Minimize (more room for the players)'}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? '▸' : '▾'}
        </button>
      </div>
      {!collapsed && (
        <div className="sidetabs-body">
          {activeTab === 'log' && <LogPanel embedded />}
          {activeTab === 'chat' && <ChatPanel compact />}
          {activeTab === 'scenario' && <ScenarioPanel />}
          {activeTab === 'barbarians' && <BarbariansPanel />}
        </div>
      )}
    </section>
  );
}
