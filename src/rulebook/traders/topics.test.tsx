// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { TRADERS_TOPICS } from './topics';

describe('Traders & Barbarians rulebook topics', () => {
  it('render, with the Rivers / Fishing diagrams', () => {
    for (const t of TRADERS_TOPICS) {
      const { container, unmount } = render(<>{t.body}</>);
      expect(container.textContent?.length).toBeGreaterThan(20);
      if (t.id === 'traders-rivers' || t.id === 'traders-fishing') {
        expect(container.querySelector('svg.rb-diagram')).not.toBeNull();
      }
      unmount();
    }
  });
});
