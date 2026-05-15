import type { ReactNode } from 'react';
import './DialogShell.css';

interface Props {
  title: string;
  onClose?: () => void;
  children: ReactNode;
  footer?: ReactNode;
  // If true, clicking outside does not close the dialog (mandatory choice).
  blocking?: boolean;
  // Visual style: 'modal' (default, with backdrop) or 'docked' (anchored to
  // the bottom of the board, no backdrop — board stays visible).
  variant?: 'modal' | 'docked';
}

export function DialogShell({
  title,
  onClose,
  children,
  footer,
  blocking,
  variant = 'docked',
}: Props) {
  if (variant === 'docked') {
    return (
      <div className="dialog-dock" role="dialog" aria-modal="false">
        <div className="dialog dialog-docked">
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
