import { motion } from 'framer-motion';

const HERO_BG = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663486830791/WuCyWqVdFPbfCADWcJauKD/hero-bg-main-jomhEGLje5Zdnaj3XiQHsX.webp';

export default function Hero() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.3,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8 },
    },
  };

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
      className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20"
      style={{ background: '#07060F' }}
    >
      {/* Background Layers */}
      <div className="absolute inset-0 z-0">
        {/* Hero Background Image */}
        <img
          src={HERO_BG}
          alt="Hero Background"
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            filter: 'saturate(0.2) brightness(0.25)',
          }}
        />

        {/* Radial Gradient Blobs */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 80% 60% at 20% 50%, rgba(139, 92, 246, 0.12), transparent),
              radial-gradient(ellipse 60% 50% at 80% 60%, rgba(245, 158, 11, 0.08), transparent)
            `,
          }}
        />

        {/* Dot Grid Texture */}
        <svg
          className="absolute inset-0 w-full h-full"
          style={{ opacity: 0.5 }}
        >
          <defs>
            <pattern
              id="dots"
              x="24"
              y="24"
              width="24"
              height="24"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="12" cy="12" r="1" fill="rgba(255, 255, 255, 0.03)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>

        {/* Top & Bottom Fades */}
        <div
          className="absolute top-0 left-0 right-0 h-64 pointer-events-none"
          style={{
            background: 'linear-gradient(180deg, rgba(7, 6, 15, 0.8) 0%, transparent 100%)',
          }}
        />
        <div
          className="absolute bottom-0 left-0 right-0 h-64 pointer-events-none"
          style={{
            background: 'linear-gradient(0deg, rgba(7, 6, 15, 0.8) 0%, transparent 100%)',
          }}
        />
      </div>

      {/* Content */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 container text-center max-w-3xl mx-auto px-6"
      >
        {/* Badge */}
        <motion.div
          variants={itemVariants}
          className="drip-panel rounded-full inline-flex items-center gap-2 px-6 py-2 mb-8"
        >
          <span
            className="text-xs font-bold"
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              color: '#F59E0B',
            }}
          >
            ◆ SEASON 01 · BUILT ON SOLANA
          </span>
        </motion.div>

        {/* Main Heading */}
        <motion.h1
          variants={itemVariants}
          className="text-heading mb-6"
          style={{
            fontSize: 'clamp(3rem, 10vw, 8rem)',
            lineHeight: 0.82,
            letterSpacing: '-3px',
            color: '#FFFFFF',
            fontWeight: 800,
          }}
        >
          Stake Art.{' '}
          <span style={{ color: '#F59E0B' }}>Win</span>{' '}
          <span style={{ color: '#8B5CF6' }}>War.</span>
        </motion.h1>

        {/* Subtext */}
        <motion.p
          variants={itemVariants}
          className="text-body mb-12 max-w-md mx-auto"
          style={{
            color: 'rgba(255, 255, 255, 0.45)',
            fontSize: '1rem',
            lineHeight: 1.6,
          }}
        >
          52 DRiP cNFTs. One opponent. Real stakes. The smart contract takes the rest.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          {/* Primary Button */}
          <motion.button
            whileHover={{
              scale: 1.05,
              boxShadow: '0 0 30px rgba(139, 92, 246, 0.5)',
            }}
            whileTap={{ scale: 0.95 }}
            className="drip-panel-hot px-8 py-4 font-bold text-sm transition-all duration-300"
            style={{
              fontFamily: "'Syne', sans-serif",
              color: '#FFFFFF',
              letterSpacing: '0.1em',
            }}
          >
            ⚔ ENTER THE ARENA
          </motion.button>

          {/* Secondary Button */}
          <motion.button
            whileHover={{
              scale: 1.05,
              background: 'rgba(245, 158, 11, 0.15)',
              borderColor: '#F59E0B',
            }}
            whileTap={{ scale: 0.95 }}
            className="px-8 py-4 font-bold text-sm transition-all duration-300 border-2"
            style={{
              fontFamily: "'Syne', sans-serif",
              color: '#F59E0B',
              borderColor: 'rgba(245, 158, 11, 0.5)',
              background: 'transparent',
              letterSpacing: '0.1em',
            }}
          >
            ▷ HOW IT WORKS
          </motion.button>
        </motion.div>
      </motion.div>

      {/* Live Ticker Strip */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1, duration: 0.8 }}
        className="absolute bottom-0 left-0 right-0 z-20 drip-panel border-t border-b"
        style={{
          borderColor: 'rgba(139, 92, 246, 0.2)',
        }}
      >
        <div className="overflow-hidden">
          <motion.div
            animate={{ x: [0, -1000] }}
            transition={{ duration: 20, repeat: Infinity }}
            className="flex gap-8 px-8 py-3 whitespace-nowrap"
          >
            {[...Array(3)].map((_, i) => (
              <span
                key={i}
                className="text-xs font-bold"
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  color: '#A78BFA',
                }}
              >
                ◆ LIVE: @sol_reaper vs @nft_phantom — ROYALE WAR TRIGGERED · 14 cNFTs TRANSFERRED · @drip_monk WINS DECK ·
              </span>
            ))}
          </motion.div>
        </div>
      </motion.div>
    </motion.section>
  );
}
