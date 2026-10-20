import { useEffect, useRef, useState } from 'react';
import { Button } from '@/ui/shared/Button';
import { generateRoomCode } from '@/net';
import {
  deviceLabel,
  probeRoute,
  relayStates,
  startPairTest,
  type PairPeer,
  type PairTest,
  type RelayState,
  type RouteReport,
} from '@/net/diagnostics';
import './OnlineMenu.css';

// Network test: what this device's connection allows (relays reached, route
// type), and a pair test with another device on the same test code. Run it
// on both devices of a pairing that won't connect to see which side fails.

const ROUTE_TEXT: Record<RouteReport['kind'], { label: string; detail: string }> = {
  open: { label: 'Direct connections possible', detail: 'Other devices can reach this one.' },
  strict: {
    label: 'Strict NAT',
    detail: 'Common on mobile data. Connects to devices with an open route; two strict-NAT devices usually cannot connect.',
  },
  local: {
    label: 'Local network only',
    detail: 'No public route (STUN blocked or offline). Only devices on the same Wi-Fi can connect.',
  },
};

const STATE_DOT: Record<RelayState, string> = { open: 'online', connecting: 'pending', closed: 'offline' };

function shortHost(url: string): string {
  return url.replace(/^wss:\/\//, '').replace(/\/.*$/, '');
}

export function NetworkTest({ onBack }: { onBack: () => void }) {
  const [route, setRoute] = useState<RouteReport | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [probing, setProbing] = useState(false);
  const [relays, setRelays] = useState(relayStates);
  const [code, setCode] = useState(generateRoomCode);
  const [peers, setPeers] = useState<PairPeer[] | null>(null);
  const test = useRef<PairTest | null>(null);
  const label = deviceLabel();

  const runProbe = () => {
    setProbing(true);
    setRouteError(null);
    probeRoute()
      .then((r) => {
        setRoute(r);
        test.current?.share({ label, route: r.kind });
      })
      .catch((e: Error) => setRouteError(e.message))
      .finally(() => setProbing(false));
  };

  useEffect(() => {
    runProbe();
    const t = setInterval(() => setRelays(relayStates()), 1000);
    return () => {
      clearInterval(t);
      test.current?.leave();
      test.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startPair = () => {
    test.current?.leave();
    setPeers([]);
    test.current = startPairTest(code, { label, route: route?.kind ?? null }, setPeers);
  };
  const stopPair = () => {
    test.current?.leave();
    test.current = null;
    setPeers(null);
  };

  const openRelays = relays.filter((r) => r.state === 'open').length;

  return (
    <div className="online-wrap">
      <div className="online-card">
        <header className="online-header">
          <Button variant="ghost" size="sm" onClick={onBack}>← Back</Button>
          <h2 className="online-title">Network test</h2>
        </header>

        <section className="nettest-section">
          <h3>This device</h3>
          <p className="nettest-line">{label}</p>
          <p className="nettest-line">
            <strong>Route:</strong>{' '}
            {probing ? 'checking…' : routeError ? `check failed (${routeError})` : route ? ROUTE_TEXT[route.kind].label : '—'}
          </p>
          {route && !probing && (
            <p className="nettest-note">
              {ROUTE_TEXT[route.kind].detail} ({route.counts.host} local, {route.counts.srflx} public
              {route.ipv6 ? ', IPv6' : ''} candidates)
            </p>
          )}
          <p className="nettest-line">
            <strong>Relays:</strong>{' '}
            {relays.length === 0 ? 'not opened yet (start a pair test)' : `${openRelays} / ${relays.length} connected`}
          </p>
          {relays.length > 0 && (
            <ul className="nettest-relays">
              {relays.map((r) => (
                <li key={r.url}>
                  <span className={`nettest-dot ${STATE_DOT[r.state]}`} /> {shortHost(r.url)} <span className="nettest-soft">{r.state}</span>
                </li>
              ))}
            </ul>
          )}
          <Button size="sm" onClick={runProbe} disabled={probing}>Re-check route</Button>
        </section>

        <section className="nettest-section">
          <h3>Pair test</h3>
          <p className="nettest-note">
            Open this screen on another device, enter the same test code on both, and press Start. Each device
            should list the other with a ping time within a few seconds.
          </p>
          <label className="online-field">
            <span>Test code</span>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              maxLength={6}
              autoCapitalize="characters"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              disabled={peers !== null}
              style={{ letterSpacing: '0.3em', textTransform: 'uppercase' }}
            />
          </label>
          {peers === null ? (
            <Button variant="primary" fullWidth disabled={code.length < 3} onClick={startPair}>Start pair test</Button>
          ) : (
            <>
              {peers.length === 0 ? (
                <p className="nettest-line">Waiting for another device on code {code}…</p>
              ) : (
                <ul className="nettest-peers">
                  {peers.map((p) => (
                    <li key={p.peerId}>
                      <span className="nettest-dot online" /> <strong>{p.info?.label ?? 'device'}</strong>
                      {p.info?.route && <span className="nettest-soft"> · {ROUTE_TEXT[p.info.route].label}</span>}
                      <span className="nettest-soft"> · {p.pingMs === null ? 'pinging…' : `${p.pingMs} ms`}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Button fullWidth onClick={stopPair}>Stop</Button>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
