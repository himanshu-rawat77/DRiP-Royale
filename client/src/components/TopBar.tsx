import { motion } from 'framer-motion';
import { useLocation } from 'wouter';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { usePhantomWallet } from '@/contexts/PhantomWalletContext';
import { airdropRoyale, fetchRoyaleWalletState } from '@/lib/tokenomicsClient';

export default function TopBar() {
  const [, navigate] = useLocation();
  const [activeNav, setActiveNav] = useState('');
  const { publicKey, connect, connecting, isPhantomAvailable } = usePhantomWallet();
  const [royaleBalance, setRoyaleBalance] = useState<number>(0);
  const [challengeTickets, setChallengeTickets] = useState<number>(0);
  const [showTokenDropdown, setShowTokenDropdown] = useState(false);

  const formatPk = (pk: string) =>
    pk.length > 10 ? `${pk.slice(0, 4)}…${pk.slice(-4)}` : pk;

  const handleWalletButton = async () => {
    if (publicKey) {
      navigate('/profile');
      return;
    }
    if (!isPhantomAvailable) {
      toast.error('Install Phantom from phantom.app');
      return;
    }
    try {
      await connect();
      toast.success('Wallet connected');
    } catch {
      toast.error('Could not connect wallet');
    }
  };

  const navItems = [
    { id: 'vault', label: 'THE VAULT', path: '/vault' },
    // { id: 'arena', label: 'THE ARENA', path: '/arena' },
    { id: 'campaigns', label: 'CAMPAIGNS', path: '/campaigns' },
    { id: 'profile', label: 'PROFILE', path: '/profile' },
  ];

  const handleNavClick = (item: typeof navItems[0]) => {
    setActiveNav(item.id);
    navigate(item.path);
  };

  useEffect(() => {
    if (!publicKey) {
      setRoyaleBalance(0);
      return;
    }
    void (async () => {
      try {
        const state = await fetchRoyaleWalletState(publicKey);
        setRoyaleBalance(state.royaleBalance);
        setChallengeTickets(state.challengeTickets);
      } catch {
        setRoyaleBalance(0);
        setChallengeTickets(0);
      }
    })();
  }, [publicKey]);

  const handleAirdrop = async () => {
    if (!publicKey) {
      toast.error('Connect wallet first');
      return;
    }
    try {
      const next = await airdropRoyale(publicKey);
      setRoyaleBalance(next.royaleBalance);
      setChallengeTickets(next.challengeTickets);
      setShowTokenDropdown(false);
      toast.success('+100 ROYALE airdropped');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Airdrop failed');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="fixed top-0 left-0 right-0 z-50 border-b"
      style={{
        background: 'rgba(7, 6, 15, 0.85)',
        backdropFilter: 'blur(20px)',
        borderColor: 'rgba(139, 92, 246, 0.10)',
      }}
    >
      {/* Top edge stripe */}
      <div
        className="h-0.5 w-full"
        style={{
          background: 'linear-gradient(90deg, transparent, #8B5CF6, #F59E0B, transparent)',
        }}
      />

      <div className="container flex items-center justify-between py-4">
        {/* Logo */}
        <motion.div
          whileHover={{ scale: 1.05 }}
          onClick={() => navigate('/')}
          className="flex items-center gap-2 cursor-pointer"
        >
          <span className="text-xl font-bold text-white" style={{ fontFamily: "'Syne', sans-serif" }}>
            <span style={{ color: '#F59E0B' }}>◆</span> DRIP ROYALE
          </span>
        </motion.div>

        {/* Center Navigation */}
        <div className="hidden md:flex items-center gap-8">
          {navItems.map((item) => (
            <motion.button
              key={item.id}
              onClick={() => handleNavClick(item)}
              whileHover={{ scale: 1.05 }}
              className="relative px-3 py-2 text-xs font-bold transition-all duration-300"
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                color: activeNav === item.id ? '#F59E0B' : 'rgba(255, 255, 255, 0.4)',
                letterSpacing: '0.05em',
              }}
            >
              {item.label}
              {activeNav === item.id && (
                <motion.div
                  layoutId="underline"
                  className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ background: '#F59E0B' }}
                />
              )}
            </motion.button>
          ))}
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-4">
          {/* ROYALE Token Counter */}
          <div className="relative hidden sm:block">
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={() => setShowTokenDropdown((v) => !v)}
              className="flex items-center gap-2 px-4 py-2 rounded-full"
              style={{
                background: 'rgba(139, 92, 246, 0.1)',
                border: '1px solid rgba(139, 92, 246, 0.2)',
              }}
            >
              <span className="text-xs" style={{ color: '#F59E0B' }}>◆</span>
              <span
                className="text-xs font-bold"
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  color: '#A78BFA',
                }}
              >
                ROYALE: {royaleBalance}
              </span>
            </motion.button>
            {showTokenDropdown && (
              <div
                className="absolute right-0 mt-2 w-56 rounded-lg p-3 z-50"
                style={{
                  background: 'rgba(7, 6, 15, 0.96)',
                  border: '1px solid rgba(139, 92, 246, 0.25)',
                  backdropFilter: 'blur(12px)',
                }}
              >
                <p className="text-xs mb-1" style={{ color: '#A78BFA', fontFamily: "'IBM Plex Mono', monospace" }}>
                  Balance: {royaleBalance} ROYALE
                </p>
                <p className="text-xs mb-3" style={{ color: 'rgba(255,255,255,0.55)', fontFamily: "'IBM Plex Mono', monospace" }}>
                  Tickets: {challengeTickets}
                </p>
                <button
                  onClick={() => void handleAirdrop()}
                  className="w-full text-xs font-bold py-2 rounded-lg"
                  style={{
                    background: 'rgba(16, 185, 129, 0.18)',
                    color: '#34D399',
                    fontFamily: "'Syne', sans-serif",
                  }}
                >
                  AIRDROP +100 ROYALE
                </button>
              </div>
            )}
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleWalletButton}
            disabled={connecting}
            className="px-4 py-2 rounded-lg font-bold text-xs transition-all duration-300 max-w-[140px] truncate"
            style={{
              fontFamily: "'Syne', sans-serif",
              background: publicKey
                ? 'rgba(139, 92, 246, 0.2)'
                : 'linear-gradient(135deg, #8B5CF6, #A78BFA)',
              color: '#FFFFFF',
              letterSpacing: '0.05em',
              border: publicKey ? '1px solid rgba(139, 92, 246, 0.35)' : 'none',
              opacity: connecting ? 0.65 : 1,
              cursor: connecting ? 'not-allowed' : 'pointer',
            }}
            title={publicKey ? `${publicKey} — open profile` : 'Connect Phantom'}
          >
            {connecting ? '…' : publicKey ? formatPk(publicKey) : 'CONNECT'}
          </motion.button>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden px-4 pb-4 flex gap-2 overflow-x-auto">
        {navItems.map((item) => (
          <motion.button
            key={item.id}
            onClick={() => handleNavClick(item)}
            whileHover={{ scale: 1.05 }}
            className="px-3 py-2 text-xs font-bold rounded-lg transition-all duration-300 flex-shrink-0"
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              background: activeNav === item.id ? 'rgba(139, 92, 246, 0.3)' : 'rgba(139, 92, 246, 0.1)',
              color: activeNav === item.id ? '#F59E0B' : 'rgba(255, 255, 255, 0.4)',
              letterSpacing: '0.05em',
            }}
          >
            {item.label}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
