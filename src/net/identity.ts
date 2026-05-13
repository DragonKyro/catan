// Persistent player identity. The UUID lives in localStorage and is reused
// forever for this browser profile so a player can rejoin a game with the
// same seat after refresh / network drop.

const UUID_KEY = 'catan.uuid';
const NAME_KEY = 'catan.displayName';

export function getOrCreateUuid(): string {
  try {
    const existing = localStorage.getItem(UUID_KEY);
    if (existing) return existing;
    const fresh =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : fallbackUuid();
    localStorage.setItem(UUID_KEY, fresh);
    return fresh;
  } catch {
    // localStorage unavailable (SSR, restricted iframe). Generate ephemeral.
    return fallbackUuid();
  }
}

export function getSavedDisplayName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveDisplayName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* ignore */
  }
}

function fallbackUuid(): string {
  // Decent uniqueness without Web Crypto. Good enough for friends' rooms.
  const rand = () =>
    Math.floor(Math.random() * 0xffffffff)
      .toString(16)
      .padStart(8, '0');
  return `${rand()}-${rand()}-${rand()}-${rand()}`;
}

// Generate a short, friendly room code (4 uppercase letters/digits).
export function generateRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}
