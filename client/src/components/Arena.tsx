import { motion } from 'framer-motion';
import { useState, useRef } from 'react';
import { NFT_CARDS, RARITY_COLORS } from '@/lib/cardData';
import CardDisplay from './CardDisplay';
import ParticleEffect, { GlowEffect, playSound } from './ParticleEffect';

const ARENA_BG = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663486830791/WuCyWqVdFPbfCADWcJauKD/arena-split-bg-By5zBsUSv6CrFLKpdTgQ8r.webp';

// Sound effect URLs
const SOUND_FLIP = '/card-flip-sound.wav';
const SOUND_REVEAL = '/card-reveal-sound.wav';
const SOUND_WAR = '/royale-war-sound.wav';

export default function Arena() {
  const [isFlipped, setIsFlipped] = useState(false);
  const [royaleWar, setRoyaleWar] = useState(false);
  const [showParticles, setShowParticles] = useState(false);
  const [showGlow, setShowGlow] = useState(false);
  const [particlePosition, setParticlePosition] = useState({ x: 0, y: 0 });
  const [glowPosition, setGlowPosition] = useState({ x: 0, y: 0 });
  const leftCardRef = useRef<HTMLDivElement>(null);
  const rightCardRef = useRef<HTMLDivElement>(null);

  // Dummy card selections for each player
  const leftPlayerCard = NFT_CARDS[0]; // Shadow Oracle
  const rightPlayerCard = NFT_CARDS[4]; // Inferno Dragon

  const playerLeft = {
    name: '@sol_reaper',
    cardsRemaining: 28,
    pileCards: 6,
    card: leftPlayerCard,
  };

  const playerRight = {
    name: '@nft_phantom',
    cardsRemaining: 24,
    pileCards: 6,
    card: rightPlayerCard,
  };

  const handleFlipCards = () => {
    // Play flip sound
    playSound(SOUND_FLIP, 0.6);

    // Trigger particles from both cards
    if (leftCardRef.current) {
      const rect = leftCardRef.current.getBoundingClientRect();
      setParticlePosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    }

    setShowParticles(true);

    // Flip cards
    setIsFlipped(!isFlipped);

    // Play reveal sound after flip completes
    setTimeout(() => {
      playSound(SOUND_REVEAL, 0.5);
      setShowGlow(true);

      if (leftCardRef.current) {
        const rect = leftCardRef.current.getBoundingClientRect();
        setGlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
      }

      setTimeout(() => setShowGlow(false), 600);
    }, 300);

    setTimeout(() => setShowParticles(false), 800);
  };

  const handleRoyaleWar = () => {
    // Play war sound
    playSound(SOUND_WAR, 0.7);

    // Trigger intense particles
    if (leftCardRef.current) {
      const rect = leftCardRef.current.getBoundingClientRect();
      setParticlePosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    }

    setShowParticles(true);
    setRoyaleWar(!royaleWar);

    setTimeout(() => setShowParticles(false), 1000);
  };

  return (
    <motion.section
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
      viewport={{ once: true }}
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden py-20"
      style={{ background: '#07060F' }}
    >
      {/* Particle Effects */}
      <ParticleEffect
        trigger={showParticles}
        position={particlePosition}
        particleCount={royaleWar ? 20 : 12}
        colors={royaleWar ? ['#EF4444', '#8B5CF6', '#F59E0B'] : ['#8B5CF6', '#F59E0B', '#A78BFA']}
        type={royaleWar ? 'war' : 'flip'}
      />

      {/* Glow Effects */}
      <GlowEffect
        trigger={showGlow}
        position={glowPosition}
        duration={0.6}
        color={royaleWar ? '#EF4444' : '#8B5CF6'}
      />

      {/* Background */}
      <div className="absolute inset-0 z-0">
        <img
          src={ARENA_BG}
          alt="Arena Background"
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            filter: 'saturate(0.3) brightness(0.4)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 60% 50% at 20% 50%, rgba(139, 92, 246, 0.1), transparent),
              radial-gradient(ellipse 60% 50% at 80% 50%, rgba(245, 158, 11, 0.1), transparent)
            `,
          }}
        />
      </div>

      <div className="container relative z-10">
        {/* Match Status Bar */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="drip-panel p-4 mb-12 text-center"
        >
          <p
            className="text-xs font-bold"
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              color: '#A78BFA',
              letterSpacing: '0.1em',
            }}
          >
            ROUND 14 OF ∞ · PILE: {playerLeft.pileCards} CARDS · {playerLeft.name}: {playerLeft.cardsRemaining} CARDS · {playerRight.name}: {playerRight.cardsRemaining} CARDS
          </p>
        </motion.div>

        {/* Main Arena */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
          {/* Left Player */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="drip-panel p-6 flex flex-col items-center"
          >
            {/* Avatar */}
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
              style={{
                border: '3px solid #8B5CF6',
                background: 'linear-gradient(135deg, #8B5CF6, #A78BFA)',
              }}
            >
              <span className="text-2xl">🎭</span>
            </div>

            {/* Wallet Address */}
            <p
              className="text-xs mb-6"
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                color: '#A78BFA',
              }}
            >
              {playerLeft.name}
            </p>

            {/* Cards Remaining */}
            <p
              className="text-heading mb-8"
              style={{
                fontSize: '3.5rem',
                color: '#FFFFFF',
              }}
            >
              {playerLeft.cardsRemaining}
            </p>

            {/* Deck Stack */}
            <div className="relative w-24 h-32">
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  animate={{ y: i * 8, rotate: (i - 1) * 5 }}
                  className="card-back absolute w-full h-full"
                  style={{
                    zIndex: 3 - i,
                  }}
                />
              ))}
            </div>
          </motion.div>

          {/* Center Combat Zone */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-col items-center justify-center gap-8"
          >
            {/* Cards */}
            <div className="flex gap-8 items-center justify-center">
              {/* Left Card */}
              <motion.div
                ref={leftCardRef}
                whileHover={{ scale: 1.08 }}
                onClick={handleFlipCards}
                className="cursor-pointer"
              >
                <CardDisplay
                  name={playerLeft.card.name}
                  image={playerLeft.card.image}
                  power={playerLeft.card.power}
                  rarity={playerLeft.card.rarity}
                  size="medium"
                  isFlipped={isFlipped}
                />
              </motion.div>

              {/* VS Divider */}
              <p
                className="text-heading"
                style={{
                  fontSize: '2rem',
                  color: 'rgba(255, 255, 255, 0.1)',
                  letterSpacing: '1em',
                }}
              >
                VS
              </p>

              {/* Right Card */}
              <motion.div
                ref={rightCardRef}
                whileHover={{ scale: 1.08 }}
                onClick={handleFlipCards}
                className="cursor-pointer"
              >
                <CardDisplay
                  name={playerRight.card.name}
                  image={playerRight.card.image}
                  power={playerRight.card.power}
                  rarity={playerRight.card.rarity}
                  size="medium"
                  isFlipped={isFlipped}
                />
              </motion.div>
            </div>

            {/* Pile Count */}
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="drip-panel-hot px-6 py-3 rounded-full"
            >
              <p
                className="text-xs font-bold text-center"
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  color: '#F59E0B',
                }}
              >
                {playerLeft.pileCards} CARDS IN PILE
              </p>
            </motion.div>

            {/* Royale War Indicator */}
            {royaleWar && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="text-center"
              >
                <motion.p
                  animate={{ color: ['#8B5CF6', '#F59E0B', '#8B5CF6'] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="text-heading"
                  style={{
                    fontSize: 'clamp(2rem, 6vw, 5rem)',
                    textShadow: '-2px 0 #EF4444, 2px 0 #8B5CF6',
                  }}
                >
                  ⚠ ROYALE WAR
                </motion.p>
              </motion.div>
            )}
          </motion.div>

          {/* Right Player */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="drip-panel p-6 flex flex-col items-center"
          >
            {/* Avatar */}
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
              style={{
                border: '3px solid #F59E0B',
                background: 'linear-gradient(135deg, #F59E0B, #FCD34D)',
              }}
            >
              <span className="text-2xl">👻</span>
            </div>

            {/* Wallet Address */}
            <p
              className="text-xs mb-6"
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                color: '#F59E0B',
              }}
            >
              {playerRight.name}
            </p>

            {/* Cards Remaining */}
            <p
              className="text-heading mb-8"
              style={{
                fontSize: '3.5rem',
                color: '#FFFFFF',
              }}
            >
              {playerRight.cardsRemaining}
            </p>

            {/* Deck Stack */}
            <div className="relative w-24 h-32">
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  animate={{ y: i * 8, rotate: (i - 1) * -5 }}
                  className="card-back absolute w-full h-full"
                  style={{
                    zIndex: 3 - i,
                    background: 'repeating-conic-gradient(#0E0B1E 0% 25%, #15112B 0% 50%) 0 0 / 12px 12px',
                    borderColor: 'rgba(245, 158, 11, 0.2)',
                  }}
                />
              ))}
            </div>
          </motion.div>
        </div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-16"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleFlipCards}
            className="drip-panel-hot px-8 py-3 font-bold text-sm"
            style={{
              fontFamily: "'Syne', sans-serif",
              color: '#FFFFFF',
              letterSpacing: '0.1em',
            }}
          >
            FLIP CARDS
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRoyaleWar}
            className="px-8 py-3 font-bold text-sm rounded-lg transition-all duration-300"
            style={{
              fontFamily: "'Syne', sans-serif",
              color: '#F59E0B',
              border: '2px solid rgba(245, 158, 11, 0.5)',
              background: 'transparent',
              letterSpacing: '0.1em',
            }}
          >
            TRIGGER ROYALE WAR
          </motion.button>
        </motion.div>
      </div>
    </motion.section>
  );
}
