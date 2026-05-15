import { useState } from 'react';
import { Button } from '@/ui/shared/Button';
import { useNetworkStore } from '@/store/networkStore';
import './OnlineMenu.css';

interface Props {
  onBack: () => void;
}

export function OnlineMenu({ onBack }: Props) {
  const myDisplayName = useNetworkStore((s) => s.myDisplayName);
  const createRoom = useNetworkStore((s) => s.createRoom);
  const joinRoom = useNetworkStore((s) => s.joinRoom);

  const [name, setName] = useState(myDisplayName || '');
  const [code, setCode] = useState('');
  const [view, setView] = useState<'choose' | 'join'>('choose');

  const nameOk = name.trim().length > 0;
  const codeOk = code.trim().length >= 3;

  return (
    <div className="online-wrap">
      <div className="online-card">
        <header className="online-header">
          <Button variant="ghost" size="sm" onClick={onBack}>← Back</Button>
          <h2 className="online-title">Play online</h2>
        </header>

        <label className="online-field">
          <span>Your name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            maxLength={20}
            autoFocus
          />
        </label>

        {view === 'choose' && (
          <div className="online-buttons">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              disabled={!nameOk}
              onClick={() => createRoom(name.trim())}
            >
              Create a new room
            </Button>
            <div className="online-divider"><span>or</span></div>
            <Button size="lg" fullWidth disabled={!nameOk} onClick={() => setView('join')}>
              Join with a code
            </Button>
          </div>
        )}

        {view === 'join' && (
          <>
            <label className="online-field">
              <span>Room code</span>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="e.g. ABCD"
                maxLength={6}
                style={{ letterSpacing: '0.3em', textTransform: 'uppercase' }}
              />
            </label>
            <div className="online-buttons">
              <Button
                variant="primary"
                size="lg"
                fullWidth
                disabled={!nameOk || !codeOk}
                onClick={() => joinRoom(code.trim(), name.trim())}
              >
                Join room
              </Button>
              <Button variant="ghost" size="sm" fullWidth onClick={() => setView('choose')}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
