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

        {/* Animated Gradient Orbs */}
        <motion.div
          animate={{
            x: [0, 100, -50, 0],
            y: [0, -50, 100, 0],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(139, 92, 246, 0.25) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />

        <motion.div
          animate={{
            x: [0, -80, 60, 0],
            y: [0, 80, -60, 0],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 2,
          }}
          className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(245, 158, 11, 0.2) 0%, transparent 70%)',
            filter: 'blur(50px)',
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

        {/* Animated Floating Particles */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(15)].map((_, i) => (
            <motion.div
              key={`particle-${i}`}
              className="absolute rounded-full"
              style={{
                width: Math.random() * 6 + 2,
                height: Math.random() * 6 + 2,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                background: i % 2 === 0 ? 'rgba(139, 92, 246, 0.6)' : 'rgba(245, 158, 11, 0.5)',
              }}
              animate={{
                y: [0, Math.random() * 200 - 100],
                x: [0, Math.random() * 100 - 50],
                opacity: [0.3, 1, 0.3],
              }}
              transition={{
                duration: Math.random() * 8 + 6,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: Math.random() * 2,
              }}
            />
          ))}
        </div>

        {/* Animated Vector Graphics - Enhanced */}
        <motion.svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ opacity: 0.3 }}
          viewBox="0 0 1000 1000"
          preserveAspectRatio="xMidYMid slice"
        >
          {/* Left Sword - Enhanced */}
          <motion.g
            animate={{
              rotate: [0, 360],
              y: [0, -30, 0],
            }}
            transition={{
              rotate: { duration: 20, repeat: Infinity, ease: 'linear' },
              y: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
            }}
            style={{ transformOrigin: '150px 200px' }}
          >
            <path
              d="M 150 50 L 140 200 L 150 250 L 160 200 Z"
              fill="none"
              stroke="rgba(139, 92, 246, 0.8)"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <circle cx="150" cy="30" r="10" fill="rgba(245, 158, 11, 1)" />
            <circle cx="150" cy="30" r="15" fill="none" stroke="rgba(139, 92, 246, 0.4)" strokeWidth="2" />
          </motion.g>

          {/* Right Sword - Enhanced */}
          <motion.g
            animate={{
              rotate: [0, -360],
              y: [0, 30, 0],
            }}
            transition={{
              rotate: { duration: 25, repeat: Infinity, ease: 'linear' },
              y: { duration: 5, repeat: Infinity, ease: 'easeInOut' },
            }}
            style={{ transformOrigin: '850px 200px' }}
          >
            <path
              d="M 850 50 L 840 200 L 850 250 L 860 200 Z"
              fill="none"
              stroke="rgba(245, 158, 11, 0.8)"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <circle cx="850" cy="30" r="10" fill="rgba(139, 92, 246, 1)" />
            <circle cx="850" cy="30" r="15" fill="none" stroke="rgba(245, 158, 11, 0.4)" strokeWidth="2" />
          </motion.g>

          {/* Floating Crown - Enhanced */}
          <motion.g
            animate={{
              y: [0, -40, 0],
              x: [0, 15, 0],
              rotate: [0, 5, -5, 0],
            }}
            transition={{
              duration: 6,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            <path
              d="M 500 100 L 520 150 L 500 160 L 480 150 Z"
              fill="rgba(245, 158, 11, 0.7)"
            />
            <circle cx="500" cy="85" r="8" fill="rgba(139, 92, 246, 0.9)" />
            <circle cx="500" cy="85" r="12" fill="none" stroke="rgba(245, 158, 11, 0.5)" strokeWidth="2" />
          </motion.g>

          {/* Animated Rings */}
          <motion.circle
            cx="500"
            cy="500"
            r="100"
            fill="none"
            stroke="rgba(139, 92, 246, 0.3)"
            strokeWidth="2"
            animate={{
              r: [100, 200, 100],
              opacity: [0.5, 0.1, 0.5],
            }}
            transition={{
              duration: 5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />

          <motion.circle
            cx="500"
            cy="500"
            r="150"
            fill="none"
            stroke="rgba(245, 158, 11, 0.3)"
            strokeWidth="2"
            animate={{
              r: [150, 250, 150],
              opacity: [0.3, 0.1, 0.3],
            }}
            transition={{
              duration: 7,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: 1,
            }}
          />
        </motion.svg>

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
