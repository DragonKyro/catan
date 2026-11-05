// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { EXPLORERS_PIRATES_TOPICS } from './topics';
import { TOPICS } from '../topics';

describe('Explorers & Pirates rulebook topics', () => {
  it('render, in their own section, with the mission track table', () => {
    expect(TOPICS.find((t) => t.id === 'ep-overview')?.section).toBe('Explorers & Pirates');
    for (const t of EXPLORERS_PIRATES_TOPICS) {
      const { container, unmount } = render(<>{t.body}</>);
      expect(container.textContent?.length).toBeGreaterThan(40);
      if (t.id === 'ep-scoring') {
        expect(container.querySelectorAll('table.rb-table tbody tr').length).toBe(3);
        expect(container.textContent).toContain('Greatest Pirate Scourge');
      }
      unmount();
    }
  });
});
