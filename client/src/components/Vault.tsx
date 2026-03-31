import { motion } from 'framer-motion';
import { useState } from 'react';
import { NFT_CARDS, RARITY_COLORS } from '@/lib/cardData';

export default function Vault() {
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const [activeRarity, setActiveRarity] = useState('all');

  const rarities = [
    { id: 'all', label: 'ALL' },
    { id: 'common', label: 'COMMON' },
    { id: 'uncommon', label: 'UNCOMMON' },
    { id: 'rare', label: 'RARE' },
    { id: 'legendary', label: 'LEGENDARY' },
  ];

  const filteredCards = activeRarity === 'all'
    ? NFT_CARDS
    : NFT_CARDS.filter((card) => card.rarity === activeRarity);

  const toggleCard = (cardId: number) => {
    if (selectedCards.includes(cardId)) {
      setSelectedCards(selectedCards.filter((id) => id !== cardId));
    } else if (selectedCards.length < 5) {
      setSelectedCards([...selectedCards, cardId]);
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
      viewport={{ once: true }}
      className="relative py-24 px-6 md:px-16"
      style={{ background: '#07060F' }}
    >
      <div className="container">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="drip-panel-hot p-6 mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6"
        >
          <div>
            <p
              className="text-xs font-bold mb-2"
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                color: '#8B5CF6',
                letterSpacing: '0.1em',
              }}
            >
              // THE VAULT
            </p>
            <h2
              className="text-heading"
              style={{
                fontSize: '1.75rem',
                color: '#FFFFFF',
              }}
            >
              Build Your Collection
            </h2>
          </div>

          {/* Progress Bar */}
          <div className="flex-1 md:flex-none md:w-48">
            <div
              className="w-full h-2 rounded-full overflow-hidden"
              style={{ background: 'rgba(255, 255, 255, 0.05)' }}
            >
              <motion.div
                animate={{ width: `${(selectedCards.length / 5) * 100}%` }}
                transition={{ duration: 0.3 }}
                className="h-full"
                style={{ background: '#8B5CF6' }}
              />
            </div>
            <p
              className="text-xs mt-2 text-right"
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                color: '#A78BFA',
              }}
            >
              {selectedCards.length} / 5 SELECTED
            </p>
          </div>

          {/* Lock Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            disabled={selectedCards.length < 5}
            className="px-6 py-2 font-bold text-sm transition-all duration-300 rounded-lg"
            style={{
              fontFamily: "'Syne', sans-serif",
              background: selectedCards.length === 5 ? '#8B5CF6' : 'rgba(139, 92, 246, 0.3)',
              color: '#FFFFFF',
              cursor: selectedCards.length === 5 ? 'pointer' : 'not-allowed',
              opacity: selectedCards.length === 5 ? 1 : 0.5,
              letterSpacing: '0.1em',
            }}
          >
            LOCK DECK
          </motion.button>
        </motion.div>

        {/* Filter Row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          viewport={{ once: true }}
          className="flex flex-wrap gap-3 mb-8"
        >
          {rarities.map((rarity) => (
            <motion.button
              key={rarity.id}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveRarity(rarity.id)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all duration-300 ${
                activeRarity === rarity.id ? 'drip-panel-hot' : 'drip-panel'
              }`}
              style={{
                fontFamily: "'Syne', sans-serif",
                color: activeRarity === rarity.id ? '#FFFFFF' : 'rgba(255, 255, 255, 0.4)',
                letterSpacing: '0.05em',
              }}
            >
              {rarity.label}
            </motion.button>
          ))}
        </motion.div>

        {/* Card Grid - 5 Cards */}
        <motion.div
          layout
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-12"
        >
          {filteredCards.map((card, index) => (
            <motion.div
              key={card.id}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              viewport={{ once: true }}
              onClick={() => toggleCard(card.id)}
              className="relative cursor-pointer group"
            >
              <div
                className="drip-panel rounded-lg overflow-hidden aspect-square flex flex-col justify-between transition-all duration-300"
                style={{
                  border: selectedCards.includes(card.id)
                    ? '2px solid #F59E0B'
                    : '1px solid rgba(139, 92, 246, 0.14)',
                  background: selectedCards.includes(card.id)
                    ? 'rgba(245, 158, 11, 0.1)'
                    : 'linear-gradient(135deg, rgba(139, 92, 246, 0.06) 0%, rgba(14, 11, 30, 0.95) 50%, rgba(245, 158, 11, 0.04) 100%)',
                  boxShadow: selectedCards.includes(card.id)
                    ? '0 0 20px rgba(139, 92, 246, 0.3)'
                    : 'none',
                }}
              >
                {/* Card Image */}
                <div className="relative w-full h-full overflow-hidden flex-1">
                  <img
                    src={card.image}
                    alt={card.name}
                    className="w-full h-full object-cover"
                  />
                  {/* Overlay Gradient */}
                  <div
                    className="absolute inset-0"
                    style={{
                      background: 'linear-gradient(180deg, transparent 0%, rgba(14, 11, 30, 0.8) 100%)',
                    }}
                  />
                </div>

                {/* Card Info */}
                <div className="p-3 relative z-10">
                  <p
                    className="text-xs font-bold mb-2 truncate"
                    style={{
                      fontFamily: "'Syne', sans-serif",
                      color: '#FFFFFF',
                    }}
                  >
                    {card.name}
                  </p>

                  <div className="flex items-center justify-between">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{
                        background: RARITY_COLORS[card.rarity] || '#A0AEC0',
                      }}
                    />
                    <span
                      className="text-xs font-bold px-2 py-1 rounded"
                      style={{
                        fontFamily: "'Syne', sans-serif",
                        background: '#8B5CF6',
                        color: '#FFFFFF',
                      }}
                    >
                      PWR {card.power}
                    </span>
                  </div>
                </div>

                {/* Selection Checkmark */}
                {selectedCards.includes(card.id) && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute inset-0 flex items-center justify-center"
                    style={{
                      background: 'rgba(245, 158, 11, 0.15)',
                    }}
                  >
                    <span className="text-4xl" style={{ color: '#F59E0B' }}>
                      ✓
                    </span>
                  </motion.div>
                )}
              </div>

              {/* Card Description Tooltip */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                whileHover={{ opacity: 1, y: -5 }}
                transition={{ duration: 0.2 }}
                className="absolute -top-12 left-0 right-0 drip-panel p-2 text-center pointer-events-none z-50"
              >
                <p
                  className="text-xs"
                  style={{
                    fontFamily: "'Outfit', sans-serif",
                    color: 'rgba(255, 255, 255, 0.8)',
                  }}
                >
                  {card.description}
                </p>
              </motion.div>
            </motion.div>
          ))}
        </motion.div>

        {/* Bottom Deck Tray */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true }}
          className="drip-panel-hot p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-6"
        >
          <div className="flex-1">
            <p
              className="text-xs font-bold"
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                color: '#F59E0B',
              }}
            >
              {selectedCards.length} / 5 CARDS SELECTED
            </p>
            {selectedCards.length > 0 && (
              <p
                className="text-xs mt-2"
                style={{
                  fontFamily: "'Outfit', sans-serif",
                  color: 'rgba(255, 255, 255, 0.5)',
                }}
              >
                Selected: {NFT_CARDS.filter((c) => selectedCards.includes(c.id))
                  .map((c) => c.name)
                  .join(', ')}
              </p>
            )}
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            disabled={selectedCards.length < 5}
            className="px-8 py-3 font-bold text-sm rounded-lg transition-all duration-300 w-full md:w-auto"
            style={{
              fontFamily: "'Syne', sans-serif",
              background: selectedCards.length === 5 ? '#8B5CF6' : 'rgba(139, 92, 246, 0.3)',
              color: '#FFFFFF',
              cursor: selectedCards.length === 5 ? 'pointer' : 'not-allowed',
              opacity: selectedCards.length === 5 ? 1 : 0.5,
              letterSpacing: '0.1em',
            }}
          >
            LOCK DECK & FIND OPPONENT
          </motion.button>
        </motion.div>
      </div>
    </motion.section>
  );
}
