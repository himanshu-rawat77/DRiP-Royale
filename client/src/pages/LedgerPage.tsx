import { motion } from 'framer-motion';
import { useMemo } from 'react';
import TopBar from '@/components/TopBar';
import Footer from '@/components/Footer';
import { useLedgerStorage } from '@/hooks/useLocalStorage';
import { usePhantomWallet } from '@/contexts/PhantomWalletContext';

export default function LedgerPage() {
  const { publicKey } = usePhantomWallet();
  const [ledger] = useLedgerStorage(publicKey);
  const wonCount = useMemo(() => ledger.filter((e) => e.result === 'WIN').length, [ledger]);
  const lostCount = useMemo(() => ledger.filter((e) => e.result === 'LOSS').length, [ledger]);

  return (
    <div className="min-h-screen flex flex-col bg-black">
      <TopBar />
      <main className="flex-1">
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="relative py-24 px-6 md:px-16"
          style={{ background: '#07060F' }}
        >
          <div className="container">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="drip-panel-hot p-8 mb-12"
            >
              <p
                className="text-xs font-bold mb-2"
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  color: '#8B5CF6',
                  letterSpacing: '0.1em',
                }}
              >
                // MATCH HISTORY
              </p>
              <h1
                className="text-heading mb-4"
                style={{
                  fontSize: 'clamp(2rem, 6vw, 3.5rem)',
                  color: '#FFFFFF',
                  lineHeight: 1.2,
                }}
              >
                Your Ledger
              </h1>
              <p
                className="text-body"
                style={{
                  color: 'rgba(255, 255, 255, 0.55)',
                  fontSize: '1rem',
                }}
              >
                Track all your past matches, won assets, and on-chain transactions.
              </p>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12"
            >
              {[
                { label: 'TOTAL MATCHES', value: ledger.length, icon: '⚔️', color: '#A78BFA' },
                { label: 'WON', value: wonCount, icon: '✓', color: '#8B5CF6' },
                { label: 'LOST', value: lostCount, icon: '✗', color: '#F59E0B' },
              ].map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, delay: 0.1 + index * 0.1 }}
                  className="drip-panel p-6"
                >
                  <p
                    className="text-xs font-bold mb-3"
                    style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      color: stat.color,
                      letterSpacing: '0.05em',
                    }}
                  >
                    {stat.label}
                  </p>
                  <p
                    className="text-heading"
                    style={{
                      fontSize: '2.5rem',
                      color: '#FFFFFF',
                    }}
                  >
                    {stat.value}
                  </p>
                </motion.div>
              ))}
            </motion.div>

            {/* Ledger Entries */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="space-y-4"
            >
              {ledger.map((entry, index) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.2 + index * 0.05 }}
                  whileHover={{ scale: 1.02 }}
                  className="drip-panel p-6 rounded-lg transition-all duration-300"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                    {/* Match Info */}
                    <div className="flex items-center gap-4">
                      <div>
                        <p
                          className="text-sm font-bold mb-2"
                          style={{
                            fontFamily: "'Syne', sans-serif",
                            color: '#FFFFFF',
                          }}
                        >
                          vs {entry.opponent}
                        </p>
                        <p
                          className="text-xs"
                          style={{
                            fontFamily: "'IBM Plex Mono', monospace",
                            color: 'rgba(255, 255, 255, 0.4)',
                          }}
                        >
                          {entry.date}
                        </p>
                      </div>
                    </div>

                    {/* Outcome */}
                    <div className="flex items-center justify-between md:justify-end gap-6">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-12 h-12 rounded-lg flex items-center justify-center text-lg"
                          style={{
                            background:
                              entry.result === 'WIN'
                                ? 'rgba(139, 92, 246, 0.15)'
                                : 'rgba(245, 158, 11, 0.15)',
                          }}
                        >
                          {entry.result === 'WIN' ? '✓' : '✗'}
                        </div>
                        <div>
                          <p
                            className="text-xs font-bold"
                            style={{
                              fontFamily: "'IBM Plex Mono', monospace",
                              color: entry.result === 'WIN' ? '#8B5CF6' : '#F59E0B',
                              letterSpacing: '0.05em',
                            }}
                          >
                            {entry.result}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm font-bold" style={{ color: '#10B981' }}>
                        {entry.reward}
                      </p>
                    </div>
                  </div>

                  {entry.nftsWon.length > 0 && (
                    <p className="text-xs mt-4" style={{ color: 'rgba(255, 255, 255, 0.45)' }}>
                      NFTs won: {entry.nftsWon.length}
                    </p>
                  )}
                </motion.div>
              ))}
            </motion.div>

            {/* Empty State Message */}
            {ledger.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="drip-panel p-12 text-center"
              >
                <p
                  className="text-lg"
                  style={{
                    fontFamily: "'Syne', sans-serif",
                    color: 'rgba(255, 255, 255, 0.4)',
                  }}
                >
                  No matches yet. Start playing to build your ledger!
                </p>
              </motion.div>
            )}
          </div>
        </motion.section>
      </main>
      <Footer />
    </div>
  );
}
