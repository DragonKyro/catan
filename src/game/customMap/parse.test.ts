import { describe, expect, it } from 'vitest';
import { parseCustomMap, validateLayout } from './parse';
import { serializeCustomMap } from './serialize';
import { sampleCustomMap } from './sample';

describe('parseCustomMap', () => {
  it('round-trips the sample map', () => {
    const original = sampleCustomMap();
    const text = serializeCustomMap(original);
    const parsed = parseCustomMap(text);
    expect(parsed.id).toBe(original.id);
    expect(parsed.name).toBe(original.name);
    expect(parsed.layout.positions.length).toBe(original.layout.positions.length);
    expect(parsed.layout.portAnchors.length).toBe(original.layout.portAnchors.length);
    expect(parsed.layout.pools.tokens.length).toBe(original.layout.pools.tokens.length);
  });

  it('rejects non-Catan JSON', () => {
    expect(() => parseCustomMap(JSON.stringify({ foo: 'bar' }))).toThrowError(
      /Not a Catan custom map/,
    );
  });

  it('rejects malformed JSON', () => {
    expect(() => parseCustomMap('not json {{{')).toThrowError(/not valid JSON/);
  });

  it('rejects mismatched terrain pool', () => {
    const map = sampleCustomMap();
    map.layout.pools.terrainCounts = { wood: 99 };
    expect(() => parseCustomMap(serializeCustomMap(map))).toThrowError(
      /Terrain pool/,
    );
  });

  it('rejects mismatched token pool', () => {
    const map = sampleCustomMap();
    map.layout.pools.tokens = [6];
    expect(() => parseCustomMap(serializeCustomMap(map))).toThrowError(
      /Token pool/,
    );
  });

  it('rejects mismatched port pool', () => {
    const map = sampleCustomMap();
    map.layout.pools.portTypes = ['generic'];
    expect(() => parseCustomMap(serializeCustomMap(map))).toThrowError(
      /Port type pool/,
    );
  });

  it('rejects a duplicate hex coordinate', () => {
    const map = sampleCustomMap();
    map.layout.positions.push({ ...map.layout.positions[0]! });
    expect(() => parseCustomMap(serializeCustomMap(map))).toThrowError(
      /Duplicate position/,
    );
  });

  it('rejects a port anchor that is not on land', () => {
    const map = sampleCustomMap();
    map.layout.portAnchors[0] = { q: 99, r: 99, direction: 0 };
    expect(() => parseCustomMap(serializeCustomMap(map))).toThrowError(
      /not on a land hex/,
    );
  });

  it('rejects fog hexes that are not land', () => {
    const map = sampleCustomMap();
    map.seafarers = true;
    map.fogHexes = [{ q: 99, r: 99 }];
    expect(() => parseCustomMap(serializeCustomMap(map))).toThrowError(
      /not on a land position/,
    );
  });
});

describe('validateLayout', () => {
  it('passes for a valid layout', () => {
    expect(() => validateLayout(sampleCustomMap().layout)).not.toThrow();
  });
});
