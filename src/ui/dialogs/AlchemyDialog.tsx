import { useState } from 'react';
import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import { DialogShell } from '@/ui/shared/DialogShell';
import { Button } from '@/ui/shared/Button';

export function AlchemyDialog() {
  const { game, dialog, dispatch, closeDialog } = useGameStore();
  const [red, setRed] = useState(3);
  const [yellow, setYellow] = useState(4);
  if (!game || dialog !== 'alchemy') return null;
  const acting = getActingPlayerId(game);
  return (
    <DialogShell title="Alchemy — set the dice" variant="docked" onClose={closeDialog}>
      <p style={{ marginTop: 0, color: 'var(--text-soft)' }}>
        Choose values for the red and yellow production dice. The event die is
        still rolled normally.
      </p>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <DiePicker label="Red die" color="#c0533c" value={red} onChange={setRed} />
        <DiePicker label="Yellow die" color="#f0c449" value={yellow} onChange={setYellow} />
        <div style={{ fontWeight: 700, fontSize: '1.2em' }}>
          = {red + yellow}
        </div>
      </div>
      <Button
        variant="primary"
        onClick={() => {
          dispatch({
            type: 'playProgressCard',
            playerId: acting,
            card: 'alchemy',
            dice: [red, yellow],
          });
          closeDialog();
        }}
      >
        Confirm
      </Button>
    </DialogShell>
  );
}

function DiePicker({
  label,
  color,
  value,
  onChange,
}: {
  label: string;
  color: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div style={{ fontSize: '0.8em', color: 'var(--text-soft)' }}>{label}</div>
      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            style={{
              width: 24,
              height: 24,
              borderRadius: 4,
              border: '1px solid #1a1a1a',
              background: value === n ? color : '#fff',
              color: value === n ? '#fff' : '#1a1a1a',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
