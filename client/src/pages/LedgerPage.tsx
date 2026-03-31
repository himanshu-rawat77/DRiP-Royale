import { motion } from 'framer-motion';
import TopBar from '@/components/TopBar';
import Footer from '@/components/Footer';
import type { LedgerEntry } from '@/lib/types';

// Dummy ledger data
const DUMMY_LEDGER: LedgerEntry[] = [
  {
    id: '1',
    assetId: 'drip-001',
    imageUri: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663486830791/WuCyWqVdFPbfCADWcJauKD/nft-card-1-shadow-oracle-By5zBsUSv6CrFLKpdTgQ8r.webp',
    name: 'Shadow Oracle',
    outcome: 'won',
    txSignature: '5Yz3vZ9kL2mN8pQ1rT4uV5wX6yA7bC8dE9fG0hI1jK2lM3nO4pQ5rS6tU7vW8xY9z',
    timestamp: '2026-03-28T10:30:00Z',
    solscanUrl: 'https://solscan.io/tx/5Yz3vZ9kL2mN8pQ1rT4uV5wX6yA7bC8dE9fG0hI1jK2lM3nO4pQ5rS6tU7vW8xY9z',
  },
  {
    id: '2',
    assetId: 'drip-002',
    imageUri: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663486830791/WuCyWqVdFPbfCADWcJauKD/nft-card-2-golden-phoenix-By5zBsUSv6CrFLKpdTgQ8r.webp',
    name: 'Golden Phoenix',
    outcome: 'lost',
    txSignature: '4Xy2uW8jK1lM7oP0qR3sT4uV5wX6yA7bC8dE9fG0hI1jK2lM3nO4pQ5rS6tU7vW8x',
    timestamp: '2026-03-28T09:15:00Z',
    solscanUrl: 'https://solscan.io/tx/4Xy2uW8jK1lM7oP0qR3sT4uV5wX6yA7bC8dE9fG0hI1jK2lM3nO4pQ5rS6tU7vW8x',
  },
  {
    id: '3',
    assetId: 'drip-003',
    imageUri: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663486830791/WuCyWqVdFPbfCADWcJauKD/nft-card-3-void-sentinel-By5zBsUSv6CrFLKpdTgQ8r.webp',
    name: 'Void Sentinel',
    outcome: 'won',
    txSignature: '3Wx1tV7iJ0kL6nO9pQ2rS3tU4vW5xY6zA7bC8dE9fG0hI1jK2lM3nO4pQ5rS6tU7v',
    timestamp: '2026-03-28T08:45:00Z',
    solscanUrl: 'https://solscan.io/tx/3Wx1tV7iJ0kL6nO9pQ2rS3tU4vW5xY6zA7bC8dE9fG0hI1jK2lM3nO4pQ5rS6tU7v',
  },
  {
    id: '4',
    assetId: 'drip-004',
    imageUri: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663486830791/WuCyWqVdFPbfCADWcJauKD/nft-card-4-crystal-guardian-By5zBsUSv6CrFLKpdTgQ8r.webp',
    name: 'Crystal Guardian',
    outcome: 'won',
    txSignature: '2Vu0sU6hI9jK5mN8oP1qR2sT3uV4wX5yZ6aB7cD8eE9fG0hI1jK2lM3nO4pQ5rS6t',
    timestamp: '2026-03-28T07:20:00Z',
    solscanUrl: 'https://solscan.io/tx/2Vu0sU6hI9jK5mN8oP1qR2sT3uV4wX5yZ6aB7cD8eE9fG0hI1jK2lM3nO4pQ5rS6t',
  },
  {
    id: '5',
    assetId: 'drip-005',
    imageUri: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663486830791/WuCyWqVdFPbfCADWcJauKD/nft-card-5-inferno-dragon-By5zBsUSv6CrFLKpdTgQ8r.webp',
    name: 'Inferno Dragon',
    outcome: 'lost',
    txSignature: '1Ut9rT5gH8iJ4lM7nO0pQ1rS2tU3vW4xY5zA6bB7cC8dD9eE0fF1gG2hH3iI4jJ5k',
    timestamp: '2026-03-28T06:00:00Z',
    solscanUrl: 'https://solscan.io/tx/1Ut9rT5gH8iJ4lM7nO0pQ1rS2tU3vW4xY5zA6bB7cC8dD9eE0fF1gG2hH3iI4jJ5k',
  },
];

export default function LedgerPage() {
  const wonCount = DUMMY_LEDGER.filter((e) => e.outcome === 'won').length;
  const lostCount = DUMMY_LEDGER.filter((e) => e.outcome === 'lost').length;

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
                { label: 'TOTAL MATCHES', value: DUMMY_LEDGER.length, icon: '⚔️', color: '#A78BFA' },
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
              {DUMMY_LEDGER.map((entry, index) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.2 + index * 0.05 }}
                  whileHover={{ scale: 1.02 }}
                  className="drip-panel p-6 rounded-lg cursor-pointer transition-all duration-300"
                  onClick={() => window.open(entry.solscanUrl, '_blank')}
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                    {/* Card Info */}
                    <div className="flex items-center gap-4">
                      {/* Card Image */}
                      <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                        <img
                          src={entry.imageUri}
                          alt={entry.name}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {/* Card Details */}
                      <div>
                        <p
                          className="text-sm font-bold mb-2"
                          style={{
                            fontFamily: "'Syne', sans-serif",
                            color: '#FFFFFF',
                          }}
                        >
                          {entry.name}
                        </p>
                        <p
                          className="text-xs"
                          style={{
                            fontFamily: "'IBM Plex Mono', monospace",
                            color: 'rgba(255, 255, 255, 0.4)',
                          }}
                        >
                          {new Date(entry.timestamp).toLocaleDateString()} at{' '}
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>

                    {/* Outcome & Link */}
                    <div className="flex items-center justify-between md:justify-end gap-6">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-12 h-12 rounded-lg flex items-center justify-center text-lg"
                          style={{
                            background:
                              entry.outcome === 'won'
                                ? 'rgba(139, 92, 246, 0.15)'
                                : 'rgba(245, 158, 11, 0.15)',
                          }}
                        >
                          {entry.outcome === 'won' ? '✓' : '✗'}
                        </div>
                        <div>
                          <p
                            className="text-xs font-bold"
                            style={{
                              fontFamily: "'IBM Plex Mono', monospace",
                              color: entry.outcome === 'won' ? '#8B5CF6' : '#F59E0B',
                              letterSpacing: '0.05em',
                            }}
                          >
                            {entry.outcome === 'won' ? 'WON' : 'LOST'}
                          </p>
                        </div>
                      </div>

                      {/* External Link */}
                      <motion.div
                        whileHover={{ scale: 1.1 }}
                        className="text-xl"
                      >
                        🔗
                      </motion.div>
                    </div>
                  </div>

                  {/* Transaction ID */}
                  {entry.txSignature && (
                    <p
                      className="text-xs mt-4 truncate"
                      style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        color: 'rgba(255, 255, 255, 0.3)',
                      }}
                    >
                      TX: {entry.txSignature}
                    </p>
                  )}
                </motion.div>
              ))}
            </motion.div>

            {/* Empty State Message */}
            {DUMMY_LEDGER.length === 0 && (
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
