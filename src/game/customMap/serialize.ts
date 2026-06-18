import type { CustomMap } from './types';

// Pretty-printed JSON so hand-editing diffs nicely.
export function serializeCustomMap(map: CustomMap): string {
  return JSON.stringify(map, null, 2);
}
