import { motion } from 'framer-motion';
import type { AIDifficulty } from '@/lib/aiStrategy';
import { createAIStrategy } from '@/lib/aiStrategy';

interface DifficultySelectorProps {
  selectedDifficulty: AIDifficulty;
  onSelectDifficulty: (difficulty: AIDifficulty) => void;
  onStart: () => void;
  onBack?: () => void;
}

const difficulties: AIDifficulty[] = ['easy', 'medium', 'hard'];

export default function DifficultySelector({
  selectedDifficulty,
  onSelectDifficulty,
  onStart,
  onBack,
}: DifficultySelectorProps) {
  const getDifficultyColor = (difficulty: AIDifficulty): string => {
    switch (difficulty) {
      case 'easy':
        return '#10B981'; // Green
      case 'medium':
        return '#F59E0B'; // Gold
      case 'hard':
        return '#EF4444'; // Red
      default:
        return '#8B5CF6';
    }
  };

  const getDifficultyBgColor = (difficulty: AIDifficulty): string => {
    switch (difficulty) {
      case 'easy':
        return 'rgba(16, 185, 129, 0.1)';
      case 'medium':
        return 'rgba(245, 158, 11, 0.1)';
      case 'hard':
        return 'rgba(239, 68, 68, 0.1)';
      default:
        return 'rgba(139, 92, 246, 0.1)';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: 'rgba(0, 0, 0, 0.9)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="drip-panel-hot p-12 max-w-3xl w-full rounded-lg"
      >
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-center mb-12"
        >
          <p
            className="text-xs font-bold mb-2"
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              color: '#8B5CF6',
              letterSpacing: '0.1em',
            }}
          >
            // SELECT OPPONENT
          </p>
          <h2
            className="text-4xl font-bold"
            style={{
              fontFamily: "'Syne', sans-serif",
              color: '#FFFFFF',
            }}
          >
            Choose Your Challenge
          </h2>
          <p
            className="text-sm mt-4"
            style={{
              fontFamily: "'Outfit', sans-serif",
              color: 'rgba(255, 255, 255, 0.6)',
            }}
          >
            Select a difficulty level to face different AI strategies
          </p>
        </motion.div>

        {/* Difficulty Options */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {difficulties.map((difficulty, index) => {
            const strategy = createAIStrategy(difficulty);
            const color = getDifficultyColor(difficulty);
            const bgColor = getDifficultyBgColor(difficulty);
            const isSelected = selectedDifficulty === difficulty;

            return (
              <motion.button
                key={difficulty}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + index * 0.1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onSelectDifficulty(difficulty)}
                className="relative p-6 rounded-lg transition-all duration-300"
                style={{
                  background: isSelected ? bgColor : 'rgba(0, 0, 0, 0.3)',
                  border: `2px solid ${isSelected ? color : 'rgba(139, 92, 246, 0.2)'}`,
                  boxShadow: isSelected ? `0 0 20px ${color}40` : 'none',
                }}
              >
                {/* Selection Indicator */}
                {isSelected && (
                  <motion.div
                    layoutId="difficultyIndicator"
                    className="absolute inset-0 rounded-lg"
                    style={{
                      background: `${color}20`,
                      border: `2px solid ${color}`,
                    }}
                  />
                )}

                <div className="relative z-10">
                  {/* Difficulty Label */}
                  <p
                    className="text-xs font-bold mb-2"
                    style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      color: color,
                      letterSpacing: '0.1em',
                    }}
                  >
                    {strategy.getDifficultyLabel()}
                  </p>

                  {/* Opponent Name */}
                  <p
                    className="text-lg font-bold mb-3"
                    style={{
                      fontFamily: "'Syne', sans-serif",
                      color: '#FFFFFF',
                    }}
                  >
                    {strategy.getOpponentName()}
                  </p>

                  {/* Description */}
                  <p
                    className="text-xs"
                    style={{
                      fontFamily: "'Outfit', sans-serif",
                      color: 'rgba(255, 255, 255, 0.6)',
                      lineHeight: 1.5,
                    }}
                  >
                    {strategy.getDifficultyDescription()}
                  </p>

                  {/* Stats */}
                  <div className="mt-4 pt-4 border-t" style={{ borderColor: `${color}40` }}>
                    <div className="flex justify-between text-xs">
                      <span
                        style={{
                          fontFamily: "'IBM Plex Mono', monospace",
                          color: 'rgba(255, 255, 255, 0.4)',
                        }}
                      >
                        Difficulty:
                      </span>
                      <span
                        style={{
                          fontFamily: "'IBM Plex Mono', monospace",
                          color: color,
                          fontWeight: 'bold',
                        }}
                      >
                        {difficulty === 'easy' ? '⭐' : difficulty === 'medium' ? '⭐⭐' : '⭐⭐⭐'}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Start Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col sm:flex-row gap-4"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onStart}
            className="flex-1 px-8 py-4 font-bold text-lg rounded-lg"
            style={{
              fontFamily: "'Syne', sans-serif",
              background: 'linear-gradient(135deg, #8B5CF6, #A78BFA)',
              color: '#FFFFFF',
              letterSpacing: '0.1em',
            }}
          >
            START MATCH
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelectDifficulty('medium')}
            className="px-6 py-4 font-bold text-sm rounded-lg"
            style={{
              fontFamily: "'Syne', sans-serif",
              background: 'rgba(139, 92, 246, 0.1)',
              color: '#8B5CF6',
              border: '2px solid rgba(139, 92, 246, 0.3)',
              letterSpacing: '0.05em',
            }}
          >
            RESET
          </motion.button>

          {onBack && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onBack}
              className="px-6 py-4 font-bold text-sm rounded-lg"
              style={{
                fontFamily: "'Syne', sans-serif",
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#EF4444',
                border: '2px solid rgba(239, 68, 68, 0.3)',
                letterSpacing: '0.05em',
              }}
            >
              ← BACK
            </motion.button>
          )}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
