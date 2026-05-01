import { useState, useEffect } from 'react';

/**
 * Custom hook for managing localStorage with React state
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void, () => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading from localStorage (${key}):`, error);
      return initialValue;
    }
  });

  const setValue = (value: T) => {
    try {
      setStoredValue(value);
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error writing to localStorage (${key}):`, error);
    }
  };

  const clearValue = () => {
    try {
      setStoredValue(initialValue);
      window.localStorage.removeItem(key);
    } catch (error) {
      console.error(`Error clearing localStorage (${key}):`, error);
    }
  };

  return [storedValue, setValue, clearValue];
}

/**
 * Hook for managing wallet address persistence
 */
export function useWalletStorage() {
  return useLocalStorage<string>('drip-wallet-address', '');
}

/**
 * Hook for managing user profile persistence
 */
type StoredProfile = {
  username: string;
  bio: string;
  profileImage: string;
  joinDate: string;
  totalWins: number;
  totalLosses: number;
  winRate: number;
};

type StoredLedgerEntry = {
  id: string;
  opponent: string;
  result: 'WIN' | 'LOSS';
  date: string;
  reward: string;
  nftsWon: string[];
};

type ProfileStoreV2 = {
  version: 2;
  profileByWallet: Record<string, StoredProfile>;
};

type LedgerStoreV2 = {
  version: 2;
  historyByWallet: Record<string, StoredLedgerEntry[]>;
};

const PROFILE_STORE_KEY = 'drip-user-profile-v1';
const LEDGER_STORE_KEY = 'drip-ledger-v1';
const LEGACY_PROFILE_KEY = 'drip-user-profile';
const LEGACY_LEDGER_KEY = 'drip-ledger';
const LEGACY_WALLET_KEY = 'drip-wallet-address';
const FALLBACK_WALLET_KEY = '__default__';

const defaultProfile: StoredProfile = {
  username: 'Player',
  bio: 'A skilled DRiP Royale warrior',
  profileImage: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Player',
  joinDate: new Date().toLocaleDateString(),
  totalWins: 0,
  totalLosses: 0,
  winRate: 0,
};

function walletKey(walletAddress?: string | null): string {
  const normalized = (walletAddress ?? '').trim();
  return normalized.length > 0 ? normalized : FALLBACK_WALLET_KEY;
}

function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function readProfileStore(): ProfileStoreV2 {
  const store = readJson<ProfileStoreV2>(PROFILE_STORE_KEY);
  if (store?.version === 2 && store.profileByWallet) return store;
  return { version: 2, profileByWallet: {} };
}

function readLedgerStore(): LedgerStoreV2 {
  const store = readJson<LedgerStoreV2>(LEDGER_STORE_KEY);
  if (store?.version === 2 && store.historyByWallet) return store;
  return { version: 2, historyByWallet: {} };
}

function migrateLegacyStorageIfNeeded(): void {
  if (typeof window === 'undefined') return;
  const profileStore = readJson<ProfileStoreV2>(PROFILE_STORE_KEY);
  const ledgerStore = readJson<LedgerStoreV2>(LEDGER_STORE_KEY);
  if (profileStore?.version === 2 && ledgerStore?.version === 2) return;

  const fallbackWallet = walletKey(window.localStorage.getItem(LEGACY_WALLET_KEY));

  const nextProfileStore = readProfileStore();
  if (!nextProfileStore.profileByWallet[fallbackWallet]) {
    const legacyProfile = readJson<StoredProfile>(LEGACY_PROFILE_KEY);
    if (legacyProfile) {
      nextProfileStore.profileByWallet[fallbackWallet] = legacyProfile;
    }
  }
  writeJson(PROFILE_STORE_KEY, nextProfileStore);

  const nextLedgerStore = readLedgerStore();
  if (!nextLedgerStore.historyByWallet[fallbackWallet]) {
    const legacyLedger = readJson<StoredLedgerEntry[]>(LEGACY_LEDGER_KEY);
    if (Array.isArray(legacyLedger)) {
      nextLedgerStore.historyByWallet[fallbackWallet] = legacyLedger;
    }
  }
  writeJson(LEDGER_STORE_KEY, nextLedgerStore);
}

if (typeof window !== 'undefined') {
  migrateLegacyStorageIfNeeded();
}

export function useProfileStorage(walletAddress?: string | null) {
  const defaultProfile = {
    username: 'Player',
    bio: 'A skilled DRiP Royale warrior',
    profileImage: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Player',
    joinDate: new Date().toLocaleDateString(),
    totalWins: 0,
    totalLosses: 0,
    winRate: 0,
  };
  const key = walletKey(walletAddress);
  const [profile, setProfile] = useState<StoredProfile>(() => {
    const store = readProfileStore();
    return store.profileByWallet[key] ?? defaultProfile;
  });

  useEffect(() => {
    const store = readProfileStore();
    setProfile(store.profileByWallet[key] ?? defaultProfile);
  }, [key]);

  const updateProfile = (value: StoredProfile) => {
    const store = readProfileStore();
    store.profileByWallet[key] = value;
    writeJson(PROFILE_STORE_KEY, store);
    setProfile(value);
  };

  const clearProfile = () => {
    const store = readProfileStore();
    delete store.profileByWallet[key];
    writeJson(PROFILE_STORE_KEY, store);
    setProfile(defaultProfile);
  };

  return [profile, updateProfile, clearProfile] as const;
}

/**
 * Hook for managing selected deck (wallet NFTs or dummy)
 */
export function useDeckStorage() {
  return useLocalStorage<string[]>('drip-selected-deck', []);
}

/**
 * Hook for managing match state during gameplay
 */
export function useMatchStorage() {
  const defaultMatch = {
    isActive: false,
    isDummy: false,
    player1Deck: [] as string[],
    player2Deck: [] as string[],
    player1Hand: [] as string[],
    player2Hand: [] as string[],
    player1Won: [] as string[],
    player2Won: [] as string[],
    currentRound: 0,
    winner: null as string | null,
  };
  return useLocalStorage('drip-match-state', defaultMatch);
}

/**
 * Hook for managing ledger entries
 */
export function useLedgerStorage(walletAddress?: string | null) {
  const defaultLedger: Array<{
    id: string;
    opponent: string;
    result: 'WIN' | 'LOSS';
    date: string;
    reward: string;
    nftsWon: string[];
  }> = [];
  const key = walletKey(walletAddress);
  const [ledger, setLedger] = useState<StoredLedgerEntry[]>(() => {
    const store = readLedgerStore();
    return store.historyByWallet[key] ?? defaultLedger;
  });

  useEffect(() => {
    const store = readLedgerStore();
    setLedger(store.historyByWallet[key] ?? defaultLedger);
  }, [key]);

  const updateLedger = (value: StoredLedgerEntry[]) => {
    const store = readLedgerStore();
    store.historyByWallet[key] = value;
    writeJson(LEDGER_STORE_KEY, store);
    setLedger(value);
  };

  const clearLedger = () => {
    const store = readLedgerStore();
    delete store.historyByWallet[key];
    writeJson(LEDGER_STORE_KEY, store);
    setLedger(defaultLedger);
  };

  return [ledger, updateLedger, clearLedger] as const;
}

export function exportWalletBackup(walletAddress?: string | null): string {
  const key = walletKey(walletAddress);
  const profiles = readProfileStore();
  const ledgers = readLedgerStore();
  return JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      wallet: key,
      profile: profiles.profileByWallet[key] ?? null,
      history: ledgers.historyByWallet[key] ?? [],
    },
    null,
    2
  );
}

export function importWalletBackup(raw: string, walletAddress?: string | null): { ok: true } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(raw) as {
      version?: number;
      wallet?: string;
      profile?: StoredProfile | null;
      history?: StoredLedgerEntry[];
    };
    const key = walletKey(walletAddress || parsed.wallet);
    const profiles = readProfileStore();
    const ledgers = readLedgerStore();

    if (parsed.profile) {
      profiles.profileByWallet[key] = parsed.profile;
      writeJson(PROFILE_STORE_KEY, profiles);
    }

    if (Array.isArray(parsed.history)) {
      ledgers.historyByWallet[key] = parsed.history;
      writeJson(LEDGER_STORE_KEY, ledgers);
    }

    return { ok: true };
  } catch {
    return { ok: false, error: 'Invalid backup JSON file' };
  }
}
