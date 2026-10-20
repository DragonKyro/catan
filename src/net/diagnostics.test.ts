import { describe, expect, it, vi } from 'vitest';
import { deviceLabel, parseCandidate, summarizeCandidates } from './diagnostics';

// The pure parts only; nothing here touches the network.
vi.mock('@trystero-p2p/nostr', () => ({
  joinRoom: vi.fn(),
  getRelaySockets: () => ({}),
  pauseRelayReconnection: vi.fn(),
  resumeRelayReconnection: vi.fn(),
}));

const host = 'candidate:1 1 udp 2122260223 192.168.1.20 54400 typ host generation 0';
const srflx = (ip: string, port: number, base = 54400) =>
  `candidate:2 1 udp 1686052607 ${ip} ${port} typ srflx raddr 192.168.1.20 rport ${base} generation 0`;

describe('parseCandidate', () => {
  it('reads host and server-reflexive candidates', () => {
    expect(parseCandidate(host)).toEqual({
      type: 'host', protocol: 'udp', address: '192.168.1.20', port: 54400, relatedAddress: undefined, relatedPort: undefined,
    });
    expect(parseCandidate(`a=${srflx('203.0.113.7', 61000)}`)).toMatchObject({
      type: 'srflx', address: '203.0.113.7', port: 61000, relatedAddress: '192.168.1.20', relatedPort: 54400,
    });
  });

  it('ignores what is not a candidate', () => {
    expect(parseCandidate('')).toBeNull();
    expect(parseCandidate('a=end-of-candidates')).toBeNull();
  });
});

describe('summarizeCandidates', () => {
  const parse = (lines: string[]) => lines.map((l) => parseCandidate(l)!);

  it('same public mapping from every STUN server: open', () => {
    const r = summarizeCandidates(parse([host, srflx('203.0.113.7', 61000), srflx('203.0.113.7', 61000)]));
    expect(r.kind).toBe('open');
    expect(r.counts).toMatchObject({ host: 1, srflx: 2 });
    expect(r.publicAddresses).toEqual(['203.0.113.7']);
  });

  it('a different public port per STUN server for one local socket: strict (symmetric NAT)', () => {
    expect(summarizeCandidates(parse([host, srflx('203.0.113.7', 61000), srflx('203.0.113.7', 61544)])).kind).toBe('strict');
  });

  it('different local sockets mapping differently is still open', () => {
    expect(summarizeCandidates(parse([srflx('203.0.113.7', 61000, 54400), srflx('203.0.113.7', 62000, 54401)])).kind).toBe('open');
  });

  it('no public mapping at all: local only', () => {
    expect(summarizeCandidates(parse([host])).kind).toBe('local');
    expect(summarizeCandidates([]).kind).toBe('local');
  });

  it('notices a public IPv6 route', () => {
    const v6 = 'candidate:3 1 udp 1686052607 2001:db8::5 61000 typ srflx raddr 2001:db8::5 rport 61000 generation 0';
    expect(summarizeCandidates(parse([v6])).ipv6).toBe(true);
    expect(summarizeCandidates(parse([host, srflx('203.0.113.7', 61000)])).ipv6).toBe(false);
  });
});

describe('deviceLabel', () => {
  it.each([
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', 'iPhone · Safari'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1', 'iPhone · Chrome'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', 'iPad · Safari'],
    ['Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36', 'Android phone · Chrome'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0', 'Windows · Edge'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15', 'Mac · Safari'],
  ])('%s', (ua, label) => {
    expect(deviceLabel(ua)).toBe(label);
  });
});
