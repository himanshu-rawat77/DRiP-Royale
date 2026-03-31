import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useWalletStorage } from '@/hooks/useLocalStorage';
import {
  connectPhantom,
  disconnectPhantom,
  getConnectedPhantomAddress,
  getPhantomProvider,
  isPhantomInstalled,
  onPhantomAccountChanged,
} from '@/lib/phantomWallet';

interface PhantomWalletContextValue {
  publicKey: string | null;
  connecting: boolean;
  error: string | null;
  isPhantomAvailable: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  clearError: () => void;
}

const PhantomWalletContext = createContext<PhantomWalletContextValue | undefined>(undefined);

export function PhantomWalletProvider({ children }: { children: ReactNode }) {
  const [stored, setStored, clearStored] = useWalletStorage();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phantomAvailable, setPhantomAvailable] = useState(() => isPhantomInstalled());

  const publicKey = stored ? stored : null;

  useEffect(() => {
    setPhantomAvailable(isPhantomInstalled());
  }, []);

  useEffect(() => {
    if (stored) return;
    const sessionAddr = getConnectedPhantomAddress();
    if (sessionAddr) setStored(sessionAddr);
  }, [stored, setStored]);

  const clearError = useCallback(() => setError(null), []);

  const connect = useCallback(async () => {
    setError(null);
    setConnecting(true);
    try {
      const address = await connectPhantom();
      setStored(address);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to connect wallet');
      throw e;
    } finally {
      setConnecting(false);
    }
  }, [setStored]);

  const disconnect = useCallback(async () => {
    setError(null);
    await disconnectPhantom();
    clearStored();
  }, [clearStored]);

  useEffect(() => {
    return onPhantomAccountChanged((next) => {
      if (next) setStored(next);
      else clearStored();
    });
  }, [setStored, clearStored]);

  useEffect(() => {
    const provider = getPhantomProvider();
    if (!provider?.on || !provider.removeListener) return;

    const onConnect = () => setPhantomAvailable(true);
    provider.on('connect', onConnect);
    return () => provider.removeListener!('connect', onConnect);
  }, []);

  const value = useMemo(
    (): PhantomWalletContextValue => ({
      publicKey,
      connecting,
      error,
      isPhantomAvailable: phantomAvailable,
      connect,
      disconnect,
      clearError,
    }),
    [publicKey, connecting, error, phantomAvailable, connect, disconnect, clearError]
  );

  return (
    <PhantomWalletContext.Provider value={value}>{children}</PhantomWalletContext.Provider>
  );
}

export function usePhantomWallet() {
  const ctx = useContext(PhantomWalletContext);
  if (!ctx) {
    throw new Error('usePhantomWallet must be used within PhantomWalletProvider');
  }
  return ctx;
}
