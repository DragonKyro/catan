import type { PlayerColor } from '@/game/types';
import { PLAYER_COLORS, PLAYER_COLOR_HEX, PLAYER_COLOR_LABEL } from './playerColors';
import './ColorPicker.css';

interface Props {
  value: PlayerColor;
  /** Colors other seats wear; picking one swaps it with that seat. */
  taken: readonly PlayerColor[];
  onPick: (color: PlayerColor) => void;
}

/** Popover grid of every player color. Place it inside a `position: relative` wrapper next to the swatch that opens it. */
export function ColorPicker({ value, taken, onPick }: Props) {
  return (
    <div className="color-picker" role="listbox">
      {PLAYER_COLORS.map((c) => {
        const isMine = value === c;
        const isTaken = !isMine && taken.includes(c);
        return (
          <button
            key={c}
            type="button"
            role="option"
            aria-selected={isMine}
            className={`color-picker-opt${isMine ? ' is-mine' : ''}${isTaken ? ' is-taken' : ''}`}
            style={{ background: PLAYER_COLOR_HEX[c] }}
            onClick={() => onPick(c)}
            title={isTaken ? `${PLAYER_COLOR_LABEL[c]} — taken (will swap)` : PLAYER_COLOR_LABEL[c]}
          >
            {isMine && <span className="color-picker-check">✓</span>}
          </button>
        );
      })}
    </div>
  );
}
