import { motion } from 'framer-motion';
import { useState } from 'react';
import {
  Achievement,
  PlayerStats,
  getUnlockedAchievements,
  getAchievementProgress,
  getRarityColor,
  getRarityGlow,
} from '@/lib/achievements';

interface AchievementBadgesProps {
  stats: PlayerStats;
}

// Achievement badge image URLs
const ACHIEVEMENT_IMAGES: Record<string, string> = {
  'first-blood': 'https://d2xsxph8kpxj0f.cloudfront.net/310519663486830791/WuCyWqVdFPbfCADWcJauKD/achievement-first-blood-MYpvHcbVryKHdtnv5hRB6v.webp',
  'warrior': 'https://d2xsxph8kpxj0f.cloudfront.net/310519663486830791/WuCyWqVdFPbfCADWcJauKD/achievement-warrior-dEcAuRrh3aDsDQCN3T7gZT.webp',
  'champion': 'https://d2xsxph8kpxj0f.cloudfront.net/310519663486830791/WuCyWqVdFPbfCADWcJauKD/achievement-champion-WXWHmBF9N8LrgdEdqxWgvt.webp',
  'legend': 'https://d2xsxph8kpxj0f.cloudfront.net/310519663486830791/WuCyWqVdFPbfCADWcJauKD/achievement-legend-FLGrZD2VrEEFknJ4JgSqHZ.webp',
  'immortal': 'https://d2xsxph8kpxj0f.cloudfront.net/310519663486830791/WuCyWqVdFPbfCADWcJauKD/achievement-immortal-LJUdu8rZcChH6Sw8JwVPxJ.webp',
};

export default function AchievementBadges({ stats }: AchievementBadgesProps) {
  const unlockedAchievements = getUnlockedAchievements(stats);
  const allAchievementsProgress = getAchievementProgress(stats);
  const [selectedAchievement, setSelectedAchievement] = useState<(Achievement & { progress: number }) | null>(null);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const badgeVariants = {
    hidden: { opacity: 0, scale: 0.5, y: 20 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        duration: 0.5,
      },
    },
  };

  const unlockVariants = {
    hidden: { opacity: 0, scale: 0 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.4,
      },
    },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="mb-12"
    >
      {/* Section Header */}
      <div className="drip-panel p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p
              className="text-sm font-bold"
              style={{
                fontFamily: "'Syne', sans-serif",
                color: '#FFFFFF',
              }}
            >
              Achievements
            </p>
            <p
              className="text-xs mt-1"
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                color: 'rgba(255, 255, 255, 0.4)',
              }}
            >
              {unlockedAchievements.length} of {allAchievementsProgress.length} unlocked
            </p>
          </div>
          <div className="text-right">
            <p
              className="text-2xl font-bold"
              style={{
                fontFamily: "'Syne', sans-serif",
                color: '#8B5CF6',
              }}
            >
              {Math.round((unlockedAchievements.length / allAchievementsProgress.length) * 100)}%
            </p>
            <p
              className="text-xs"
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                color: 'rgba(255, 255, 255, 0.4)',
              }}
            >
              COMPLETE
            </p>
          </div>
        </div>
      </div>

      {/* Achievement Grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6"
      >
        {allAchievementsProgress.map((achievement) => {
          const isUnlocked = unlockedAchievements.some((a) => a.id === achievement.id);
          const progress = achievement.progress || 0;

          return (
            <motion.div
              key={achievement.id}
              variants={badgeVariants}
              whileHover={{ scale: 1.1 }}
              onClick={() => setSelectedAchievement(achievement)}
              className="cursor-pointer relative"
            >
              <div
                className="relative rounded-lg overflow-hidden p-3 text-center"
                style={{
                  background: isUnlocked
                    ? `linear-gradient(135deg, ${getRarityGlow(achievement.rarity)}, transparent)`
                    : 'rgba(255, 255, 255, 0.05)',
                  border: `2px solid ${
                    isUnlocked
                      ? getRarityColor(achievement.rarity)
                      : 'rgba(255, 255, 255, 0.1)'
                  }`,
                  boxShadow: isUnlocked
                    ? `0 0 20px ${getRarityGlow(achievement.rarity)}`
                    : 'none',
                }}
              >
                {/* Badge Image or Icon */}
                {isUnlocked ? (
                  <motion.img
                    variants={unlockVariants}
                    src={ACHIEVEMENT_IMAGES[achievement.id] || ''}
                    alt={achievement.name}
                    className="w-full h-16 object-cover rounded mb-2"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-16 flex items-center justify-center mb-2">
                    <span
                      className="text-3xl opacity-30"
                      style={{
                        filter: 'grayscale(100%)',
                      }}
                    >
                      {achievement.icon}
                    </span>
                  </div>
                )}

                {/* Badge Name */}
                <p
                  className="text-xs font-bold line-clamp-2 mb-2"
                  style={{
                    fontFamily: "'Syne', sans-serif",
                    color: isUnlocked ? '#FFFFFF' : 'rgba(255, 255, 255, 0.4)',
                  }}
                >
                  {achievement.name}
                </p>

                {/* Progress Bar */}
                {!isUnlocked && progress > 0 && (
                  <div
                    className="w-full h-1 rounded-full overflow-hidden"
                    style={{
                      background: 'rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.8 }}
                      className="h-full"
                      style={{
                        background: `linear-gradient(90deg, #8B5CF6, #A78BFA)`,
                      }}
                    />
                  </div>
                )}

                {/* Unlock Badge */}
                {isUnlocked && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 }}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{
                      background: getRarityColor(achievement.rarity),
                    }}
                  >
                    <span
                      className="text-xs font-bold"
                      style={{
                        color: '#FFFFFF',
                      }}
                    >
                      ✓
                    </span>
                  </motion.div>
                )}
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Achievement Details Modal */}
      {selectedAchievement && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setSelectedAchievement(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="drip-panel p-8 max-w-md w-full rounded-lg"
          >
            <div className="text-center mb-6">
              {/* Achievement Icon/Image */}
              <div className="mb-4 flex justify-center">
                {ACHIEVEMENT_IMAGES[selectedAchievement.id] ? (
                  <img
                    src={ACHIEVEMENT_IMAGES[selectedAchievement.id]}
                    alt={selectedAchievement.name}
                    className="w-24 h-24 rounded-lg"
                  />
                ) : (
                  <span className="text-6xl">{selectedAchievement.icon}</span>
                )}
              </div>

              {/* Achievement Name */}
              <h3
                className="text-xl font-bold mb-2"
                style={{
                  fontFamily: "'Syne', sans-serif",
                  color: '#FFFFFF',
                }}
              >
                {selectedAchievement.name}
              </h3>

              {/* Rarity Badge */}
              <span
                className="inline-block text-xs font-bold px-3 py-1 rounded-full mb-4"
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  background: getRarityColor(selectedAchievement.rarity),
                  color: '#FFFFFF',
                  textTransform: 'uppercase',
                }}
              >
                {selectedAchievement.rarity}
              </span>

              {/* Description */}
              <p
                className="text-sm mb-4"
                style={{
                  fontFamily: "'Outfit', sans-serif",
                  color: 'rgba(255, 255, 255, 0.7)',
                }}
              >
                {selectedAchievement.description}
              </p>

              {/* Progress */}
              {selectedAchievement.progress < 100 && (
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <p
                      className="text-xs"
                      style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        color: 'rgba(255, 255, 255, 0.5)',
                      }}
                    >
                      PROGRESS
                    </p>
                    <p
                      className="text-xs font-bold"
                      style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        color: '#8B5CF6',
                      }}
                    >
                      {Math.round(selectedAchievement.progress)}%
                    </p>
                  </div>
                  <div
                    className="w-full h-2 rounded-full overflow-hidden"
                    style={{
                      background: 'rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${selectedAchievement.progress}%` }}
                      transition={{ duration: 0.8 }}
                      className="h-full"
                      style={{
                        background: `linear-gradient(90deg, #8B5CF6, #A78BFA)`,
                      }}
                    />
                  </div>
                </div>
              )}

              {selectedAchievement.progress === 100 && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm font-bold"
                  style={{
                    fontFamily: "'Syne', sans-serif",
                    color: '#10B981',
                  }}
                >
                  ✓ UNLOCKED
                </motion.p>
              )}
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedAchievement(null)}
              className="w-full px-4 py-2 font-bold text-sm rounded-lg"
              style={{
                fontFamily: "'Syne', sans-serif",
                background: 'rgba(139, 92, 246, 0.1)',
                color: '#8B5CF6',
                border: '1px solid rgba(139, 92, 246, 0.2)',
              }}
            >
              CLOSE
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
}
