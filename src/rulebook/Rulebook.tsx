import { useState } from 'react';
import { Button } from '@/ui/shared/Button';
import { TOPICS } from './topics';
import './Rulebook.css';

interface Props {
  // 'page' renders as a full screen with its own back button.
  // 'embedded' renders without the outer chrome — caller wraps in a dialog.
  variant?: 'page' | 'embedded';
  onClose?: () => void;
}

export function Rulebook({ variant = 'page', onClose }: Props) {
  const [index, setIndex] = useState(0);
  const topic = TOPICS[index]!;
  const goPrev = () => setIndex((i) => Math.max(0, i - 1));
  const goNext = () => setIndex((i) => Math.min(TOPICS.length - 1, i + 1));

  const body = (
    <div className="rb">
      <nav className="rb-toc" aria-label="Rulebook topics">
        {TOPICS.map((t, i) => (
          <button
            key={t.id}
            type="button"
            className={`rb-toc-item ${i === index ? 'is-active' : ''}`}
            onClick={() => setIndex(i)}
          >
            <span className="rb-toc-num">{i + 1}</span>
            <span className="rb-toc-title">{t.title}</span>
          </button>
        ))}
      </nav>
      <article className="rb-article">
        <header className="rb-article-head">
          <span className="rb-article-eyebrow">
            {index + 1} / {TOPICS.length}
          </span>
          <h2 className="rb-article-title">{topic.title}</h2>
        </header>
        <div className="rb-article-body">{topic.body}</div>
        <footer className="rb-article-foot">
          <Button size="sm" onClick={goPrev} disabled={index === 0}>
            ← Previous
          </Button>
          <Button size="sm" onClick={goNext} disabled={index === TOPICS.length - 1}>
            Next →
          </Button>
        </footer>
      </article>
    </div>
  );

  if (variant === 'embedded') return body;

  return (
    <div className="rb-page">
      <header className="rb-page-head">
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            ← Back
          </Button>
        )}
        <h1 className="rb-page-title">Rulebook</h1>
        <div style={{ width: 60 }} />
      </header>
      {body}
    </div>
  );
}
