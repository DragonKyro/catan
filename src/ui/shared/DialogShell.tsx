import type { ReactNode } from 'react';
import './DialogShell.css';

interface Props {
  title: string;
  onClose?: () => void;
  children: ReactNode;
  footer?: ReactNode;
  // If true, clicking the backdrop does not close the dialog (mandatory choice).
  blocking?: boolean;
}

export function DialogShell({ title, onClose, children, footer, blocking }: Props) {
  return (
    <div
      className="dialog-backdrop"
      onClick={() => {
        if (!blocking && onClose) onClose();
      }}
    >
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="dialog-header">
          <h3 className="dialog-title">{title}</h3>
          {onClose && !blocking && (
            <button
              type="button"
              className="dialog-close"
              onClick={onClose}
              aria-label="Close"
            >
              ×
            </button>
          )}
        </header>
        <div className="dialog-body">{children}</div>
        {footer && <footer className="dialog-footer">{footer}</footer>}
      </div>
    </div>
  );
}
