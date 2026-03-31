import { motion } from 'framer-motion';
import { useRef, useState } from 'react';
import { NFT_CARDS } from '@/lib/cardData';
import CardDisplay from './CardDisplay';

export default function HowItWorks() {
  const containerRef = useRef(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);

  const steps = [
    {
      number: '01',
      title: 'BUILD YOUR DECK',
      description:
        'Connect wallet. Cherry-pick 5 DRiP cNFTs. Power is determined by rarity — Common 2–10, Uncommon 11–12, Rare 13, Legendary is the Ace.',
    },
    {
      number: '02',
      title: 'ENTER THE ARENA',
      description:
        'Match made. Cards shuffle. Each turn: both players flip. High card takes the pile. Tie? The Royale War: 3 face-down, 4th decides everything.',
    },
    {
      number: '03',
      title: 'SETTLE ON-CHAIN',
      description:
        'Deck reaches zero. Smart contract fires. Every asset transfers — no custodian, no delay. Solana settles in seconds.',
    },
  ];

  const cycleCard = () => {
    setCurrentCardIndex((prev) => (prev + 1) % NFT_CARDS.length);
  };

  const currentCard = NFT_CARDS[currentCardIndex];

  return (
    <motion.section
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
      viewport={{ once: true }}
      className="relative py-28 px-6 md:px-16"
      style={{ background: '#07060F' }}
    >
      <div className="container">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20">
          {/* Left Sticky Section */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="md:sticky md:top-32 h-fit"
          >
            <div className="mb-4">
              <p
                className="text-xs font-bold mb-4"
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  color: '#8B5CF6',
                  letterSpacing: '0.1em',
                }}
              >
                // MECHANICS
              </p>
              <h2
                className="text-heading mb-6"
                style={{
                  fontSize: 'clamp(2rem, 6vw, 3.5rem)',
                  color: '#FFFFFF',
                  lineHeight: 1.2,
                }}
              >
                Rules of<br />The Royale
              </h2>
              <p
                className="text-body"
                style={{
                  color: 'rgba(255, 255, 255, 0.55)',
                  fontSize: '0.95rem',
                  lineHeight: 1.6,
                }}
              >
                Master the mechanics of DRiP Royale and dominate the arena with strategic deck building and tactical gameplay.
              </p>
            </div>

            {/* Card Display with Dummy Data */}
            <motion.div
              className="mt-12 flex flex-col items-center gap-4"
              onClick={cycleCard}
            >
              <CardDisplay
                name={currentCard.name}
                image={currentCard.image}
                power={currentCard.power}
                rarity={currentCard.rarity}
                size="large"
                showInfo={true}
              />
              <p
                className="text-xs font-bold text-center"
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  color: '#A78BFA',
                  cursor: 'pointer',
                }}
              >
                Click to cycle cards ({currentCardIndex + 1}/{NFT_CARDS.length})
              </p>
            </motion.div>
          </motion.div>

          {/* Right Scrolling Steps */}
          <motion.div
            ref={containerRef}
            className="space-y-8"
          >
            {steps.map((step, index) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
                viewport={{ once: true }}
                className="drip-panel p-8 border-l-2"
                style={{
                  borderColor: '#8B5CF6',
                }}
              >
                <div className="relative">
                  {/* Step Number Watermark */}
                  <div
                    className="absolute -top-4 -left-8 pointer-events-none"
                    style={{
                      fontSize: 'clamp(5rem, 12vw, 9rem)',
                      fontWeight: 800,
                      color: 'rgba(139, 92, 246, 0.08)',
                      lineHeight: 1,
                      fontFamily: "'Syne', sans-serif",
                    }}
                  >
                    {step.number}
                  </div>

                  <h3
                    className="text-heading mb-3 relative z-10"
                    style={{
                      fontSize: '1.25rem',
                      color: '#FFFFFF',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {step.title}
                  </h3>

                  <p
                    className="text-body relative z-10"
                    style={{
                      color: 'rgba(255, 255, 255, 0.65)',
                      fontSize: '0.95rem',
                      lineHeight: 1.6,
                    }}
                  >
                    {step.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </motion.section>
  );
}
