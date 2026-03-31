import { motion } from 'framer-motion';
import TopBar from '@/components/TopBar';
import Footer from '@/components/Footer';

interface LeaderboardEntry {
  rank: number;
  name: string;
  wins: number;
  losses: number;
  winRate: number;
  totalMatches: number;
  earnings: number;
}

// Dummy leaderboard data
const LEADERBOARD_DATA: LeaderboardEntry[] = [
  { rank: 1, name: '@sol_reaper', wins: 156, losses: 24, winRate: 86.7, totalMatches: 180, earnings: 2450 },
  { rank: 2, name: '@nft_phantom', wins: 142, losses: 38, winRate: 78.9, totalMatches: 180, earnings: 2100 },
  { rank: 3, name: '@crypto_warrior', wins: 128, losses: 52, winRate: 71.1, totalMatches: 180, earnings: 1850 },
  { rank: 4, name: '@drip_collector', wins: 115, losses: 65, winRate: 63.9, totalMatches: 180, earnings: 1600 },
  { rank: 5, name: '@art_of_war', wins: 102, losses: 78, winRate: 56.7, totalMatches: 180, earnings: 1350 },
  { rank: 6, name: '@solana_sage', wins: 98, losses: 82, winRate: 54.4, totalMatches: 180, earnings: 1250 },
  { rank: 7, name: '@nft_trader', wins: 87, losses: 93, winRate: 48.3, totalMatches: 180, earnings: 1050 },
  { rank: 8, name: '@blockchain_pro', wins: 76, losses: 104, winRate: 42.2, totalMatches: 180, earnings: 850 },
  { rank: 9, name: '@web3_enthusiast', wins: 65, losses: 115, winRate: 36.1, totalMatches: 180, earnings: 650 },
  { rank: 10, name: '@rookie_player', wins: 52, losses: 128, winRate: 28.9, totalMatches: 180, earnings: 450 },
];

export default function LeaderboardPage() {
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
                // THE LEADERBOARD
              </p>
              <h1
                className="text-heading mb-4"
                style={{
                  fontSize: 'clamp(2rem, 6vw, 3.5rem)',
                  color: '#FFFFFF',
                  lineHeight: 1.2,
                }}
              >
                Global Rankings
              </h1>
              <p
                className="text-body"
                style={{
                  color: 'rgba(255, 255, 255, 0.55)',
                  fontSize: '1rem',
                }}
              >
                The elite warriors of DRiP Royale. Compete, climb, and claim your place at the top.
              </p>
            </motion.div>

            {/* Leaderboard Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="drip-panel rounded-lg overflow-hidden"
            >
              {/* Desktop View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr
                      style={{
                        borderBottom: '1px solid rgba(139, 92, 246, 0.14)',
                        background: 'rgba(139, 92, 246, 0.05)',
                      }}
                    >
                      <th
                        className="px-6 py-4 text-left text-xs font-bold"
                        style={{
                          fontFamily: "'IBM Plex Mono', monospace",
                          color: '#8B5CF6',
                          letterSpacing: '0.05em',
                        }}
                      >
                        RANK
                      </th>
                      <th
                        className="px-6 py-4 text-left text-xs font-bold"
                        style={{
                          fontFamily: "'IBM Plex Mono', monospace",
                          color: '#8B5CF6',
                          letterSpacing: '0.05em',
                        }}
                      >
                        PLAYER
                      </th>
                      <th
                        className="px-6 py-4 text-center text-xs font-bold"
                        style={{
                          fontFamily: "'IBM Plex Mono', monospace",
                          color: '#8B5CF6',
                          letterSpacing: '0.05em',
                        }}
                      >
                        WINS
                      </th>
                      <th
                        className="px-6 py-4 text-center text-xs font-bold"
                        style={{
                          fontFamily: "'IBM Plex Mono', monospace",
                          color: '#8B5CF6',
                          letterSpacing: '0.05em',
                        }}
                      >
                        LOSSES
                      </th>
                      <th
                        className="px-6 py-4 text-center text-xs font-bold"
                        style={{
                          fontFamily: "'IBM Plex Mono', monospace",
                          color: '#8B5CF6',
                          letterSpacing: '0.05em',
                        }}
                      >
                        WIN RATE
                      </th>
                      <th
                        className="px-6 py-4 text-center text-xs font-bold"
                        style={{
                          fontFamily: "'IBM Plex Mono', monospace",
                          color: '#F59E0B',
                          letterSpacing: '0.05em',
                        }}
                      >
                        EARNINGS
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {LEADERBOARD_DATA.map((entry, index) => (
                      <motion.tr
                        key={entry.rank}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        whileHover={{ background: 'rgba(139, 92, 246, 0.05)' }}
                        style={{
                          borderBottom: '1px solid rgba(139, 92, 246, 0.08)',
                          cursor: 'pointer',
                        }}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {entry.rank <= 3 ? (
                              <span className="text-2xl">
                                {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉'}
                              </span>
                            ) : (
                              <span
                                className="w-8 h-8 flex items-center justify-center rounded-full text-xs font-bold"
                                style={{
                                  background: 'rgba(139, 92, 246, 0.2)',
                                  color: '#A78BFA',
                                }}
                              >
                                {entry.rank}
                              </span>
                            )}
                          </div>
                        </td>
                        <td
                          className="px-6 py-4 text-sm font-bold"
                          style={{
                            fontFamily: "'Syne', sans-serif",
                            color: '#FFFFFF',
                          }}
                        >
                          {entry.name}
                        </td>
                        <td
                          className="px-6 py-4 text-center text-sm font-bold"
                          style={{
                            fontFamily: "'IBM Plex Mono', monospace",
                            color: '#8B5CF6',
                          }}
                        >
                          {entry.wins}
                        </td>
                        <td
                          className="px-6 py-4 text-center text-sm font-bold"
                          style={{
                            fontFamily: "'IBM Plex Mono', monospace",
                            color: '#F59E0B',
                          }}
                        >
                          {entry.losses}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div
                              className="w-16 h-2 rounded-full overflow-hidden"
                              style={{ background: 'rgba(255, 255, 255, 0.05)' }}
                            >
                              <motion.div
                                animate={{ width: `${entry.winRate}%` }}
                                transition={{ duration: 0.5 }}
                                className="h-full"
                                style={{ background: '#8B5CF6' }}
                              />
                            </div>
                            <span
                              className="text-xs font-bold"
                              style={{
                                fontFamily: "'IBM Plex Mono', monospace",
                                color: '#A78BFA',
                              }}
                            >
                              {entry.winRate.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td
                          className="px-6 py-4 text-center text-sm font-bold"
                          style={{
                            fontFamily: "'IBM Plex Mono', monospace",
                            color: '#F59E0B',
                          }}
                        >
                          ◆ {entry.earnings}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile View */}
              <div className="md:hidden">
                {LEADERBOARD_DATA.map((entry, index) => (
                  <motion.div
                    key={entry.rank}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className="p-4 border-b"
                    style={{
                      borderColor: 'rgba(139, 92, 246, 0.08)',
                    }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {entry.rank <= 3 ? (
                          <span className="text-2xl">
                            {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉'}
                          </span>
                        ) : (
                          <span
                            className="w-8 h-8 flex items-center justify-center rounded-full text-xs font-bold"
                            style={{
                              background: 'rgba(139, 92, 246, 0.2)',
                              color: '#A78BFA',
                            }}
                          >
                            {entry.rank}
                          </span>
                        )}
                        <div>
                          <p
                            className="text-sm font-bold"
                            style={{
                              fontFamily: "'Syne', sans-serif",
                              color: '#FFFFFF',
                            }}
                          >
                            {entry.name}
                          </p>
                        </div>
                      </div>
                      <p
                        className="text-xs font-bold"
                        style={{
                          fontFamily: "'IBM Plex Mono', monospace",
                          color: '#F59E0B',
                        }}
                      >
                        ◆ {entry.earnings}
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <p
                          className="text-xs"
                          style={{
                            fontFamily: "'IBM Plex Mono', monospace",
                            color: '#A78BFA',
                          }}
                        >
                          WINS
                        </p>
                        <p
                          className="text-sm font-bold"
                          style={{
                            fontFamily: "'IBM Plex Mono', monospace",
                            color: '#8B5CF6',
                          }}
                        >
                          {entry.wins}
                        </p>
                      </div>
                      <div>
                        <p
                          className="text-xs"
                          style={{
                            fontFamily: "'IBM Plex Mono', monospace",
                            color: '#A78BFA',
                          }}
                        >
                          LOSSES
                        </p>
                        <p
                          className="text-sm font-bold"
                          style={{
                            fontFamily: "'IBM Plex Mono', monospace",
                            color: '#F59E0B',
                          }}
                        >
                          {entry.losses}
                        </p>
                      </div>
                      <div>
                        <p
                          className="text-xs"
                          style={{
                            fontFamily: "'IBM Plex Mono', monospace",
                            color: '#A78BFA',
                          }}
                        >
                          WIN RATE
                        </p>
                        <p
                          className="text-sm font-bold"
                          style={{
                            fontFamily: "'IBM Plex Mono', monospace",
                            color: '#8B5CF6',
                          }}
                        >
                          {entry.winRate.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Stats Summary */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12"
            >
              {[
                { label: 'TOTAL MATCHES', value: '1,800', icon: '⚔️' },
                { label: 'TOTAL EARNINGS', value: '◆ 14,600', icon: '💰' },
                { label: 'AVG WIN RATE', value: '56.8%', icon: '📈' },
              ].map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, delay: 0.2 + index * 0.1 }}
                  className="drip-panel p-6 text-center"
                >
                  <p className="text-3xl mb-3">{stat.icon}</p>
                  <p
                    className="text-xs font-bold mb-2"
                    style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      color: '#A78BFA',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {stat.label}
                  </p>
                  <p
                    className="text-heading"
                    style={{
                      fontSize: '1.875rem',
                      color: '#F59E0B',
                    }}
                  >
                    {stat.value}
                  </p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </motion.section>
      </main>
      <Footer />
    </div>
  );
}
