import { useEffect, useState } from 'react';
import { useNetworkStore, type JoinFailure } from '@/store/networkStore';
import type { RelayStatus } from '@/net';
import { deviceLabel } from '@/net/diagnostics';
import { Button } from '@/ui/shared/Button';
import { ChatPanel } from '@/ui/chat/ChatPanel';
import { playerColorVar } from '@/ui/shared/playerColors';
import { AI_LEVELS, AI_LEVEL_IDS, DEFAULT_AI_LEVEL } from '@/ai/nn';
import './LobbyScreen.css';

/** The relay connections, re-read every second (the store's value isn't reactive). */
function useRelayStatus(): RelayStatus {
  const read = useNetworkStore((s) => s.relayStatus);
  const [status, setStatus] = useState(read);
  useEffect(() => {
    const t = setInterval(() => setStatus(read()), 1000);
    return () => clearInterval(t);
  }, [read]);
  return status;
}

const relaysText = (r: RelayStatus) => `relays ${r.connected}/${r.total} connected · ${deviceLabel()}`;

function failureDetails(f: JoinFailure): string {
  return `code ${f.code} · relays ${f.relays.connected}/${f.relays.total} · other devices seen ${f.peersSeen}`
    + ` · waited ${Math.round(f.waitedMs / 1000)}s · ${deviceLabel()}`;
}

/** A guest looking for the host — never shown as an (empty) lobby. */
function SearchingCard() {
  const { roomCode, joinStartedAt, leaveRoom } = useNetworkStore();
  const relays = useRelayStatus();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const waited = joinStartedAt ? Math.max(0, Math.floor((now - joinStartedAt) / 1000)) : 0;
  return (
    <div className="lobby-wrap lobby-wrap-single">
      <div className="lobby-card">
        <header className="lobby-header">
          <Button variant="ghost" size="sm" onClick={leaveRoom}>← Cancel</Button>
          <div className="lobby-roomcode-wrap">
            <span className="lobby-roomcode-label">Looking for room</span>
            <div className="lobby-roomcode lobby-roomcode-static">{roomCode}</div>
          </div>
          <div style={{ width: 60 }} />
        </header>
        <div className="lobby-status">Waiting for the host's device to answer… {waited}s</div>
        <p className="lobby-debug">{relaysText(relays)}</p>
      </div>
    </div>
  );
}

function ErrorCard() {
  const { errorMessage, joinFailure, clearError, retryJoin } = useNetworkStore();
  return (
    <div className="lobby-wrap lobby-wrap-single">
      <div className="lobby-card">
        <header className="lobby-header">
          <Button variant="ghost" size="sm" onClick={clearError}>
            ← Back
          </Button>
          <div className="lobby-roomcode-wrap" />
          <div style={{ width: 60 }} />
        </header>
        {joinFailure && (
          <h3 className="lobby-error-title">
            {joinFailure.reason === 'noRelays' ? "Can't reach the matchmaking relays" : `Room ${joinFailure.code} not found`}
          </h3>
        )}
        <div className="lobby-status" style={{ whiteSpace: 'pre-wrap' }}>
          {errorMessage ?? 'Connection error.'}
        </div>
        {joinFailure && <p className="lobby-debug">{failureDetails(joinFailure)}</p>}
        <Button variant="primary" size="lg" fullWidth onClick={joinFailure ? retryJoin : clearError}>
          Try again
        </Button>
      </div>
    </div>
  );
}

export function LobbyScreen() {
  const {
    role,
    roomCode,
    lobby,
    onlineUuids,
    hostAddAISeat,
    hostRemoveSeat,
    hostSetVP,
    hostSetAiLevel,
    hostStartGame,
    leaveRoom,
    connection,
  } = useNetworkStore();
  const [copied, setCopied] = useState(false);
  const relays = useRelayStatus();

  if (connection === 'error') return <ErrorCard />;
  if (connection === 'connecting') return <SearchingCard />;

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

        {lobby.seats.some((s) => s.isAI) && (isHost ? (
          <label className="lobby-vp">
            <span>AI difficulty</span>
            <select
              value={lobby.aiLevel ?? DEFAULT_AI_LEVEL}
              onChange={(e) => hostSetAiLevel(e.target.value as keyof typeof AI_LEVELS)}
            >
              {AI_LEVEL_IDS.map((id) => (
                <option key={id} value={id}>
                  {AI_LEVELS[id].label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="lobby-status">AI difficulty: {AI_LEVELS[lobby.aiLevel ?? DEFAULT_AI_LEVEL].label}</p>
        ))}

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

        <p className="lobby-debug">{relaysText(relays)}</p>
      </div>

      <div className="lobby-chat-wrap">
        <ChatPanel />
      </div>
    </div>
  );
}
