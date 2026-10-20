// Connection diagnostics for the Network test screen (and the join-failure
// report): which relays this device reaches, what kind of route it can offer
// another device, and a pair test between two devices on the same test code.
//
// Whether two devices can connect depends on both of their networks, not on
// the app, so the useful per-device facts are:
//   relays   can it reach the Nostr relays at all (needed to find each other)
//   route    "open"    a public address mapping that stays the same for every
//                      destination: direct connections to other networks work
//            "strict"  the mapping changes per destination (symmetric NAT,
//                      common on mobile data): direct connections fail unless
//                      the other side is open; only a TURN relay fixes it
//            "local"   no public mapping at all (STUN blocked / offline):
//                      only devices on the same local network can connect
// Two "open" devices connect; "open" + "strict" usually does; two "strict"
// ones usually don't.

import { joinRoom } from '@trystero-p2p/nostr';
import { ROOM_CONFIG, relaySockets } from './room';

export type RelayState = 'open' | 'connecting' | 'closed';

export function relayStates(): Array<{ url: string; state: RelayState }> {
  return Object.entries(relaySockets()).map(([url, s]) => ({
    url,
    state: s.readyState === WebSocket.OPEN ? 'open' : s.readyState === WebSocket.CONNECTING ? 'connecting' : 'closed',
  }));
}

// ---------------------------------------------------------------- route probe

export interface IceCandidateInfo {
  type: 'host' | 'srflx' | 'prflx' | 'relay';
  protocol: string;
  address: string;
  port: number;
  /** The local address / port a reflexive candidate was mapped from. */
  relatedAddress?: string;
  relatedPort?: number;
}

/** Parse one `candidate:` line (RTCIceCandidate.candidate). */
export function parseCandidate(line: string): IceCandidateInfo | null {
  const parts = line.replace(/^a=/, '').trim().split(/\s+/);
  if (parts.length < 8 || !parts[0]!.startsWith('candidate:')) return null;
  const type = parts[parts.indexOf('typ') + 1];
  if (type !== 'host' && type !== 'srflx' && type !== 'prflx' && type !== 'relay') return null;
  const raddr = parts.indexOf('raddr');
  const rport = parts.indexOf('rport');
  return {
    type,
    protocol: parts[2]!.toLowerCase(),
    address: parts[4]!,
    port: Number(parts[5]),
    relatedAddress: raddr >= 0 ? parts[raddr + 1] : undefined,
    relatedPort: rport >= 0 ? Number(parts[rport + 1]) : undefined,
  };
}

export type RouteKind = 'open' | 'strict' | 'local';

export interface RouteReport {
  kind: RouteKind;
  /** Candidates seen, by type. */
  counts: Record<IceCandidateInfo['type'], number>;
  publicAddresses: string[];
  ipv6: boolean;
}

/** Classify a device from its gathered candidates. A local socket mapped to
 *  different public ports by different STUN servers = symmetric NAT. */
export function summarizeCandidates(candidates: readonly IceCandidateInfo[]): RouteReport {
  const counts = { host: 0, srflx: 0, prflx: 0, relay: 0 };
  const mapped = new Map<string, Set<string>>();
  const publicAddresses = new Set<string>();
  for (const c of candidates) {
    counts[c.type]++;
    if (c.type !== 'srflx' || c.protocol !== 'udp') continue;
    publicAddresses.add(c.address);
    const base = `${c.relatedAddress ?? '?'}:${c.relatedPort ?? '?'}`;
    if (!mapped.has(base)) mapped.set(base, new Set());
    mapped.get(base)!.add(`${c.address}:${c.port}`);
  }
  const symmetric = [...mapped.values()].some((ports) => ports.size > 1);
  const kind: RouteKind = counts.srflx === 0 ? 'local' : symmetric ? 'strict' : 'open';
  return {
    kind,
    counts,
    publicAddresses: [...publicAddresses],
    ipv6: candidates.some((c) => c.address.includes(':') && c.type !== 'host'),
  };
}

// Several independent STUN servers so a symmetric mapping shows up as
// different public ports for the same local socket.
const PROBE_STUN = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
  'stun:stun.cloudflare.com:3478',
];

/** Gather this device's ICE candidates (no connection is made) and classify its route. */
export async function probeRoute(timeoutMs = 6000): Promise<RouteReport> {
  if (typeof RTCPeerConnection === 'undefined') throw new Error('this browser has no WebRTC');
  const pc = new RTCPeerConnection({ iceServers: PROBE_STUN.map((urls) => ({ urls })) });
  const found: IceCandidateInfo[] = [];
  try {
    pc.createDataChannel('probe');
    const done = new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, timeoutMs);
      pc.onicecandidate = (e) => {
        if (!e.candidate) {
          clearTimeout(timer);
          resolve();
          return;
        }
        const c = parseCandidate(e.candidate.candidate);
        if (c) found.push(c);
      };
    });
    await pc.setLocalDescription(await pc.createOffer());
    await done;
  } finally {
    pc.close();
  }
  return summarizeCandidates(found);
}

// ---------------------------------------------------------------- device label

/** A short "iPhone · Safari" style label from the user agent. */
export function deviceLabel(ua = typeof navigator === 'undefined' ? '' : navigator.userAgent): string {
  const device = /iPhone/.test(ua) ? 'iPhone'
    : /iPad/.test(ua) || (/Macintosh/.test(ua) && /Mobile/.test(ua)) ? 'iPad'
      : /Android/.test(ua) ? (/Mobile/.test(ua) ? 'Android phone' : 'Android tablet')
        : /Windows/.test(ua) ? 'Windows'
          : /Macintosh/.test(ua) ? 'Mac'
            : /Linux/.test(ua) ? 'Linux' : 'Unknown device';
  const browser = /Edg\//.test(ua) ? 'Edge'
    : /(CriOS|Chrome)\//.test(ua) ? 'Chrome'
      : /(FxiOS|Firefox)\//.test(ua) ? 'Firefox'
        : /Safari\//.test(ua) ? 'Safari' : 'browser';
  return `${device} · ${browser}`;
}

// ---------------------------------------------------------------- pair test

export interface PairInfo {
  label: string;
  route: RouteKind | null;
}

export interface PairPeer {
  peerId: string;
  info: PairInfo | null;
  connectedAt: number;
  pingMs: number | null;
}

export interface PairTest {
  leave: () => void;
  /** Re-send this device's info (e.g. once its route probe finishes). */
  share: (info: PairInfo) => void;
}

const PING_EVERY_MS = 2000;

/** Join test room `code` (separate from game rooms) and report every device that shows up, with live ping times. */
export function startPairTest(code: string, info: PairInfo, onChange: (peers: PairPeer[]) => void): PairTest {
  const room = joinRoom({ ...ROOM_CONFIG, password: `nettest-${code}` }, `nettest-${code}`);
  const infoAction = room.makeAction<{ label: string; route: RouteKind | null }>('info');
  const peers = new Map<string, PairPeer>();
  let mine = info;
  const emit = () => onChange([...peers.values()]);
  const send = (target?: string) =>
    infoAction.send(mine, target ? { target } : undefined).catch(() => undefined);

  infoAction.onMessage = (data, ctx) => {
    const p = peers.get(ctx.peerId);
    if (p) {
      p.info = data;
      emit();
    }
  };
  room.onPeerJoin = (peerId) => {
    peers.set(peerId, { peerId, info: null, connectedAt: Date.now(), pingMs: null });
    send(peerId);
    emit();
  };
  room.onPeerLeave = (peerId) => {
    peers.delete(peerId);
    emit();
  };
  const pinger = setInterval(() => {
    for (const p of peers.values()) {
      room.ping(p.peerId).then((ms) => {
        if (peers.get(p.peerId) === p) {
          p.pingMs = Math.round(ms);
          emit();
        }
      }).catch(() => undefined);
    }
  }, PING_EVERY_MS);

  return {
    leave: () => {
      clearInterval(pinger);
      room.leave().catch(() => undefined);
    },
    share: (next) => {
      mine = next;
      send();
    },
  };
}
