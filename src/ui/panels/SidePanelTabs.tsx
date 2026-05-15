import { useState } from 'react';
import { LogPanel } from './LogPanel';
import { ChatPanel } from '@/ui/chat/ChatPanel';
import './SidePanelTabs.css';

interface Props {
  // Whether chat is available at all (only in online sessions).
  showChat: boolean;
}

type Tab = 'log' | 'chat';

export function SidePanelTabs({ showChat }: Props) {
  const [tab, setTab] = useState<Tab>('log');

  if (!showChat) {
    return <LogPanel />;
  }

  return (
    <section className="sidetabs">
      <div className="sidetabs-bar" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'log'}
          className={`sidetabs-tab ${tab === 'log' ? 'is-active' : ''}`}
          onClick={() => setTab('log')}
        >
          Log
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'chat'}
          className={`sidetabs-tab ${tab === 'chat' ? 'is-active' : ''}`}
          onClick={() => setTab('chat')}
        >
          Chat
        </button>
      </div>
      <div className="sidetabs-body">
        {tab === 'log' ? <LogPanel embedded /> : <ChatPanel compact />}
      </div>
    </section>
  );
}
