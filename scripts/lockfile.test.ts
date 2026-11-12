// @vitest-environment node
//
// CI (GitHub Actions) runs `npm ci`, which downloads every package from the
// exact URL in package-lock.json. A machine whose npm is configured to use a
// private registry mirror writes that mirror's URLs into the lockfile on
// `npm install`, and the runner can't reach them (the build fails with
// ENOTFOUND). Every package must resolve to the public registry. To fix a
// stray entry, replace the mirror's URL prefix with https://registry.npmjs.org/
// (same path after it; the integrity hash is unchanged).

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PUBLIC = 'https://registry.npmjs.org/';

describe('package-lock.json', () => {
  it('resolves every package from the public npm registry', () => {
    const lock = JSON.parse(readFileSync(resolve(__dirname, '..', 'package-lock.json'), 'utf8')) as {
      packages: Record<string, { resolved?: string }>;
    };
    const stray = Object.entries(lock.packages)
      .filter(([, p]) => p.resolved && !p.resolved.startsWith(PUBLIC))
      .map(([name, p]) => `${name} → ${p.resolved}`);
    expect(stray).toEqual([]);
  });
});
