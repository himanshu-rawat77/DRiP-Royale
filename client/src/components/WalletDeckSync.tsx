import { useEffect } from 'react';
import { useDeck } from '@/contexts/DeckContext';
import { usePhantomWallet } from '@/contexts/PhantomWalletContext';

/** Keeps DeckContext wallet in sync with Phantom / persisted address. */
export default function WalletDeckSync() {
  const { publicKey } = usePhantomWallet();
  const { setWalletAddress } = useDeck();

  useEffect(() => {
    setWalletAddress(publicKey);
  }, [publicKey, setWalletAddress]);

  return null;
}
