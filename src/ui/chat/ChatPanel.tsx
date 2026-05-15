import { useEffect, useRef, useState } from 'react';
import { useNetworkStore } from '@/store/networkStore';
import { playerColorVar } from '@/ui/shared/playerColors';
import type { PlayerColor } from '@/game/types';
import './ChatPanel.css';

interface Props {
  compact?: boolean;
}

export function ChatPanel({ compact }: Props) {
  const chat = useNetworkStore((s) => s.chat);
  const sendChat = useNetworkStore((s) => s.sendChat);
  const lobby = useNetworkStore((s) => s.lobby);
  const [text, setText] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new message
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.length]);

  const colorFor = (uuid: string): string | null => {
    const seat = lobby.seats.find((s) => s.uuid === uuid);
    return seat ? playerColorVar(seat.color as PlayerColor) : null;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      sendChat(text);
      setText('');
    }
  };

  return (
    <section className={`chat ${compact ? 'chat-compact' : ''}`}>
      <div className="chat-log" ref={logRef}>
        {chat.length === 0 && (
          <div className="chat-empty">No messages yet — say hi!</div>
        )}
        {chat.map((msg) => {
          if (msg.kind === 'system') {
            return (
              <div key={msg.id} className="chat-msg chat-system">
                {msg.text}
              </div>
            );
          }
          const color = colorFor(msg.senderUuid);
          return (
            <div key={msg.id} className="chat-msg">
              <span
                className="chat-name"
                style={{ color: color || 'var(--text-soft)' }}
              >
                {msg.senderName}
              </span>
              <span className="chat-text">{msg.text}</span>
            </div>
          );
        })}
      </div>
      <form className="chat-input" onSubmit={submit}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          maxLength={200}
        />
        <button type="submit" disabled={!text.trim()}>↵</button>
      </form>
    </section>
  );
}
