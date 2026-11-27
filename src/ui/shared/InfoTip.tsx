import './InfoTip.css';

/**
 * A small circled "i" that explains a setting: hover it (or tap it on a
 * phone — it takes focus) to read `text`. Safe inside a <label>: clicking it
 * doesn't toggle the label's checkbox.
 */
export function InfoTip({ text, label = 'More info' }: { text: string; label?: string }) {
  return (
    <span
      className="info-tip"
      tabIndex={0}
      role="button"
      aria-label={`${label}: ${text}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.focus();
      }}
    >
      <span className="info-tip-i" aria-hidden>
        i
      </span>
      <span className="info-tip-bubble" role="tooltip" aria-hidden>
        {text}
      </span>
    </span>
  );
}
