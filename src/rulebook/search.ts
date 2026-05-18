import type { ReactNode, ReactElement } from 'react';
import type { Topic } from './topics';

// Walk a React subtree and concatenate every string / number child it finds.
// Used to build a haystack for rulebook search — JSX content (paragraphs,
// list items, etc.) all unwraps to plain text.
//
// Doesn't render anything; pure inspection of the JSX tree.
export function extractText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join(' ');
  if (typeof node === 'object' && node !== null && 'props' in node) {
    const el = node as ReactElement;
    const props = el.props as { children?: ReactNode };
    return extractText(props.children);
  }
  return '';
}

export interface IndexedTopic {
  topic: Topic;
  // Lowercased title + body text, used for substring matching.
  haystack: string;
}

// Pre-index topics for search. The body text walk is moderately expensive
// (recurses through every JSX child), so callers should memo this — typically
// once per Rulebook mount.
export function buildSearchIndex(topics: readonly Topic[]): IndexedTopic[] {
  return topics.map((t) => ({
    topic: t,
    haystack: `${t.title} ${extractText(t.body)}`.toLowerCase(),
  }));
}

// Returns the topic indices (into the original TOPICS array) that match the
// query. Empty query returns ALL indices in order. Case-insensitive
// substring match.
export function searchTopics(
  index: readonly IndexedTopic[],
  query: string,
): number[] {
  const q = query.trim().toLowerCase();
  if (q === '') return index.map((_, i) => i);
  const out: number[] = [];
  for (let i = 0; i < index.length; i++) {
    if (index[i]!.haystack.includes(q)) out.push(i);
  }
  return out;
}
