export interface SolanaWalletProvider {
  isPhantom?: boolean;
  connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toBase58(): string } }>;
  disconnect(): Promise<void>;
  publicKey: { toBase58(): string } | null;
  isConnected: boolean;
  signTransaction?(transaction: unknown): Promise<unknown>;
  signAllTransactions?(transactions: unknown[]): Promise<unknown[]>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  removeListener?(event: string, handler: (...args: unknown[]) => void): void;
}

declare global {
  interface Window {
    solana?: SolanaWalletProvider;
  }
}

function toBase58(publicKey: unknown): string {
  if (
    publicKey &&
    typeof publicKey === 'object' &&
    'toBase58' in publicKey &&
    typeof (publicKey as { toBase58: unknown }).toBase58 === 'function'
  ) {
    return (publicKey as { toBase58: () => string }).toBase58();
  }
  if (
    publicKey &&
    typeof publicKey === 'object' &&
    'toString' in publicKey &&
    typeof (publicKey as { toString: unknown }).toString === 'function'
  ) {
    return (publicKey as { toString: () => string }).toString();
  }
  throw new Error('Unexpected public key format from wallet');
}

/**
 * Phantom injects `window.solana` when the extension is installed.
 */
export function getPhantomProvider(): SolanaWalletProvider | null {
  if (typeof window === 'undefined') return null;
  const provider = window.solana;
  if (provider?.isPhantom) return provider;
  return null;
}

export function isPhantomInstalled(): boolean {
  return getPhantomProvider() !== null;
}

/** If Phantom is already connected (e.g. after refresh), returns the active address. */
export function getConnectedPhantomAddress(): string | null {
  const provider = getPhantomProvider();
  if (!provider?.isConnected || !provider.publicKey) return null;
  try {
    return toBase58(provider.publicKey);
  } catch {
    return null;
  }
}

export async function connectPhantom(): Promise<string> {
  const provider = getPhantomProvider();
  if (!provider) {
    throw new Error(
      'Phantom wallet is not installed. Install it from https://phantom.app/ and refresh this page.'
    );
  }
  const { publicKey } = await provider.connect();
  return toBase58(publicKey);
}

export async function disconnectPhantom(): Promise<void> {
  const provider = getPhantomProvider();
  if (!provider?.disconnect) return;
  try {
    await provider.disconnect();
  } catch {
    /* user may have already disconnected */
  }
}

export function onPhantomAccountChanged(
  handler: (publicKeyBase58: string | null) => void
): () => void {
  const provider = getPhantomProvider();
  if (!provider?.on || !provider.removeListener) {
    return () => {};
  }

  const wrapped = (..._args: unknown[]) => {
    const pk = provider.publicKey;
    handler(pk ? toBase58(pk) : null);
  };

  provider.on('accountChanged', wrapped);
  return () => provider.removeListener!('accountChanged', wrapped);
}
