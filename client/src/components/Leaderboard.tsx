import { motion } from 'framer-motion';

const LEADERBOARD_BG = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663486830791/WuCyWqVdFPbfCADWcJauKD/leaderboard-accent-AQsGXVyfAtf9TQfgEfrDwT.webp';

export default function Leaderboard() {
  const leaderboardData = [
    { rank: 1, name: '@drip_oracle', wins: 247, losses: 12, winRate: 95.4, trophy: '👑' },
    { rank: 2, name: '@sol_reaper', wins: 189, losses: 28, winRate: 87.1, trophy: '🥇' },
    { rank: 3, name: '@nft_phantom', wins: 156, losses: 41, winRate: 79.2, trophy: '🥈' },
    { rank: 4, name: '@vault_master', wins: 142, losses: 53, winRate: 72.8, trophy: '🥉' },
    { rank: 5, name: '@drip_monk', wins: 128, losses: 67, winRate: 65.6, trophy: '⭐' },
    { rank: 6, name: '@card_slinger', wins: 115, losses: 79, winRate: 59.3, trophy: '⭐' },
    { rank: 7, name: '@arena_king', wins: 98, losses: 94, winRate: 51.0, trophy: '⭐' },
    { rank: 8, name: '@lucky_strike', wins: 87, losses: 105, winRate: 45.3, trophy: '⭐' },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4 },
    },
  };

  return (
    <motion.section
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
      viewport={{ once: true }}
      className="relative py-28 px-6 md:px-16"
      style={{ background: '#07060F' }}
    >
      {/* Background Accent */}
      <div className="absolute inset-0 z-0 opacity-20">
        <img
          src={LEADERBOARD_BG}
          alt="Leaderboard Background"
          className="w-full h-full object-cover"
        />
      </div>

      <div className="container relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p
            className="text-xs font-bold mb-4"
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              color: '#F59E0B',
              letterSpacing: '0.1em',
            }}
          >
            // CHAMPIONS
          </p>
          <h2
            className="text-heading mb-4"
            style={{
              fontSize: 'clamp(2rem, 6vw, 3.5rem)',
              color: '#FFFFFF',
            }}
          >
            The Leaderboard
          </h2>
          <p
            className="text-body max-w-2xl mx-auto"
            style={{
              color: 'rgba(255, 255, 255, 0.55)',
              fontSize: '1rem',
              lineHeight: 1.6,
            }}
          >
            Rise through the ranks and claim your place among the elite. Every duel counts. Every victory matters.
          </p>
        </motion.div>

        {/* Leaderboard Table */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="space-y-3"
        >
          {leaderboardData.map((player, index) => (
            <motion.div
              key={player.rank}
              variants={itemVariants}
              whileHover={{ scale: 1.02, x: 8 }}
              className="drip-panel p-4 md:p-6 flex items-center justify-between gap-4 transition-all duration-300"
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
                {/* Rank Badge */}
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 font-bold"
                  style={{
                    background: index < 3
                      ? index === 0
                        ? 'linear-gradient(135deg, #F59E0B, #FCD34D)'
                        : index === 1
                        ? 'linear-gradient(135deg, #A0AEC0, #D1D5DB)'
                        : 'linear-gradient(135deg, #CD7F32, #D4A574)'
                      : 'rgba(139, 92, 246, 0.1)',
                    color: index < 3 ? '#07060F' : '#A78BFA',
                  }}
                >
                  {player.rank}
                </div>

                {/* Player Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{player.trophy}</span>
                    <p
                      className="text-heading truncate"
                      style={{
                        fontSize: '1rem',
                        color: '#FFFFFF',
                      }}
                    >
                      {player.name}
                    </p>
                  </div>
                  <p
                    className="text-xs"
                    style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      color: 'rgba(255, 255, 255, 0.4)',
                    }}
                  >
                    {player.wins} Wins · {player.losses} Losses
                  </p>
                </div>
              </div>

              {/* Win Rate */}
              <div className="flex flex-col items-end gap-2">
                <p
                  className="text-heading"
                  style={{
                    fontSize: '1.25rem',
                    color: '#F59E0B',
                  }}
                >
                  {player.winRate}%
                </p>
                <div
                  className="w-24 h-1.5 rounded-full overflow-hidden"
                  style={{ background: 'rgba(255, 255, 255, 0.05)' }}
                >
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${player.winRate}%` }}
                    transition={{ duration: 0.8, delay: index * 0.05 }}
                    viewport={{ once: true }}
                    className="h-full"
                    style={{
                      background: `linear-gradient(90deg, #8B5CF6, #F59E0B)`,
                    }}
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* View More Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          viewport={{ once: true }}
          className="text-center mt-12"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-8 py-3 font-bold text-sm rounded-lg transition-all duration-300"
            style={{
              fontFamily: "'Syne', sans-serif",
              color: '#F59E0B',
              border: '2px solid rgba(245, 158, 11, 0.5)',
              background: 'transparent',
              letterSpacing: '0.1em',
            }}
          >
            VIEW FULL LEADERBOARD
          </motion.button>
        </motion.div>
      </div>
    </motion.section>
  );
}
