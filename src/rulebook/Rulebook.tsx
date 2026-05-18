import { useMemo, useState } from 'react';
import { Button } from '@/ui/shared/Button';
import { TOPICS } from './topics';
import type { Topic } from './topics';
import { buildSearchIndex, searchTopics } from './search';
import './Rulebook.css';

interface Props {
  // 'page' renders as a full screen with its own back button.
  // 'embedded' renders without the outer chrome — caller wraps in a dialog.
  variant?: 'page' | 'embedded';
  onClose?: () => void;
}

// Section label for topics with no explicit `section` field — the leading
// base-game topics. Kept short so it doesn't crowd the TOC.
const BASE_SECTION = 'Base game';

interface Section {
  name: string;
  // Indices into TOPICS (preserving original ordering).
  topicIndices: number[];
}

function buildSections(topics: Topic[]): Section[] {
  const sections: Section[] = [];
  let current: Section = { name: BASE_SECTION, topicIndices: [] };
  topics.forEach((t, i) => {
    if (t.section && t.section !== current.name) {
      if (current.topicIndices.length > 0) sections.push(current);
      current = { name: t.section, topicIndices: [] };
    }
    current.topicIndices.push(i);
  });
  if (current.topicIndices.length > 0) sections.push(current);
  return sections;
}

export function Rulebook({ variant = 'page', onClose }: Props) {
  const [index, setIndex] = useState(0);
  const [query, setQuery] = useState('');
  const sections = useMemo(() => buildSections(TOPICS), []);
  // Search index: title + extracted body text per topic, built once per
  // Rulebook mount. The body walk is moderately expensive so memoise.
  const searchIndex = useMemo(() => buildSearchIndex(TOPICS), []);
  // Indices into TOPICS that match the current query (all topics when the
  // query is empty).
  const matchingIndices = useMemo(
    () => new Set(searchTopics(searchIndex, query)),
    [searchIndex, query],
  );
  // Sections default open if they contain the currently-selected topic,
  // else collapsed. Keep both base + the selected section open initially.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    const next = new Set<string>();
    for (const s of sections) {
      // Collapse expansions by default; keep base game open.
      if (s.name !== BASE_SECTION) next.add(s.name);
    }
    return next;
  });

  const topic = TOPICS[index]!;
  const goPrev = () => setIndex((i) => Math.max(0, i - 1));
  const goNext = () => setIndex((i) => Math.min(TOPICS.length - 1, i + 1));

  const toggleSection = (name: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  // If the user navigates to a topic inside a collapsed section (e.g. via
  // Next button), auto-expand that section so the active row is visible.
  const activeSectionName =
    sections.find((s) => s.topicIndices.includes(index))?.name ?? BASE_SECTION;
  const ensureActiveOpen = () => {
    if (collapsed.has(activeSectionName)) {
      setCollapsed((prev) => {
        const next = new Set(prev);
        next.delete(activeSectionName);
        return next;
      });
    }
  };

  // While the search box is non-empty, force every section open so the user
  // sees matches across the whole rulebook. Collapsed sections are restored
  // when the query is cleared.
  const isSearching = query.trim() !== '';
  const matchCount = matchingIndices.size;

  const body = (
    <div className="rb">
      <nav className="rb-toc" aria-label="Rulebook topics">
        <div className="rb-toc-search">
          <input
            type="search"
            placeholder="Search rules…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search rulebook"
          />
          {isSearching && (
            <span className="rb-toc-search-count" aria-live="polite">
              {matchCount} {matchCount === 1 ? 'match' : 'matches'}
            </span>
          )}
        </div>
        {sections.map((s) => {
          const visibleIndices = s.topicIndices.filter((i) =>
            matchingIndices.has(i),
          );
          // Hide whole sections that have zero hits when searching.
          if (isSearching && visibleIndices.length === 0) return null;
          const isCollapsed =
            !isSearching &&
            collapsed.has(s.name) &&
            s.name !== activeSectionName;
          return (
            <div key={s.name} className="rb-toc-group">
              <button
                type="button"
                className={`rb-toc-section-btn ${isCollapsed ? 'is-collapsed' : ''}`}
                onClick={() => toggleSection(s.name)}
                aria-expanded={!isCollapsed}
                disabled={isSearching}
              >
                <span className="rb-toc-section-chevron" aria-hidden>
                  {isCollapsed ? '▸' : '▾'}
                </span>
                <span className="rb-toc-section-name">{s.name}</span>
                <span className="rb-toc-section-count">
                  {isSearching ? visibleIndices.length : s.topicIndices.length}
                </span>
              </button>
              {!isCollapsed &&
                (isSearching ? visibleIndices : s.topicIndices).map((i) => {
                  const t = TOPICS[i]!;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className={`rb-toc-item ${i === index ? 'is-active' : ''}`}
                      onClick={() => setIndex(i)}
                    >
                      <span className="rb-toc-num">{i + 1}</span>
                      <span className="rb-toc-title">{t.title}</span>
                    </button>
                  );
                })}
            </div>
          );
        })}
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
          <Button
            size="sm"
            onClick={() => {
              goPrev();
              ensureActiveOpen();
            }}
            disabled={index === 0}
          >
            ← Previous
          </Button>
          <Button
            size="sm"
            onClick={() => {
              goNext();
              ensureActiveOpen();
            }}
            disabled={index === TOPICS.length - 1}
          >
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
