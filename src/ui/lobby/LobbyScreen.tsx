import { useState } from 'react';
import { useNetworkStore } from '@/store/networkStore';
import { Button } from '@/ui/shared/Button';
import { ChatPanel } from '@/ui/chat/ChatPanel';
import { playerColorVar } from '@/ui/shared/playerColors';
import './LobbyScreen.css';

export function LobbyScreen() {
  const {
    role,
    roomCode,
    lobby,
    onlineUuids,
    hostAddAISeat,
    hostRemoveSeat,
    hostSetVP,
    hostStartGame,
    leaveRoom,
    connection,
  } = useNetworkStore();
  const [copied, setCopied] = useState(false);

  const isHost = role === 'host';
  const canStart = lobby.seats.length >= 3 && lobby.seats.length <= 8;

  const copyCode = async () => {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="lobby-wrap">
      <div className="lobby-card">
        <header className="lobby-header">
          <Button variant="ghost" size="sm" onClick={leaveRoom}>← Leave</Button>
          <div className="lobby-roomcode-wrap">
            <span className="lobby-roomcode-label">Room</span>
            <button type="button" className="lobby-roomcode" onClick={copyCode}>
              {roomCode}
              <span className="lobby-roomcode-copy">{copied ? '✓ copied' : 'click to copy'}</span>
            </button>
          </div>
          <div style={{ width: 60 }} />
        </header>

        {connection === 'connecting' && (
          <div className="lobby-status">Connecting to room…</div>
        )}

        <div className="lobby-seats">
          <h3>Players ({lobby.seats.length} / 8)</h3>
          {lobby.seats.map((seat, i) => {
            const online = seat.isAI || (seat.uuid !== null && onlineUuids.has(seat.uuid));
            return (
              <div key={i} className="lobby-seat">
                <span
                  className="lobby-seat-swatch"
                  style={{ background: playerColorVar(seat.color) }}
                />
                <span className="lobby-seat-name">
                  {seat.name}
                  {seat.isAI && <span className="lobby-seat-tag">AI</span>}
                  {!seat.isAI && (
                    <span className={`lobby-seat-dot ${online ? 'online' : 'offline'}`} />
                  )}
                </span>
                {isHost && i > 0 && (
                  <Button size="sm" variant="ghost" onClick={() => hostRemoveSeat(i)}>
                    ×
                  </Button>
                )}
              </div>
            );
          })}
          {isHost && lobby.seats.length < 8 && (
            <Button size="sm" onClick={hostAddAISeat}>+ Add AI seat</Button>
          )}
        </div>

        {isHost && (
          <label className="lobby-vp">
            <span>Victory points to win</span>
            <input
              type="number"
              min={3}
              max={20}
              value={lobby.victoryPointsToWin}
              onChange={(e) =>
                hostSetVP(Math.max(3, Math.min(20, Number(e.target.value) || 10)))
              }
            />
          </label>
        )}

        {!isHost && <p className="lobby-status">Waiting for host to start…</p>}

        {isHost && (
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={!canStart}
            onClick={hostStartGame}
          >
            Start game
          </Button>
        )}
      </div>

      <div className="lobby-chat-wrap">
        <ChatPanel />
      </div>
    </div>
  );
}
