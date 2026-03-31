import { motion } from 'framer-motion';
import { RARITY_COLORS } from '@/lib/cardData';

interface CardDisplayProps {
  name: string;
  image: string;
  power: number;
  rarity: string;
  size?: 'small' | 'medium' | 'large';
  showInfo?: boolean;
  isFlipped?: boolean;
  onClick?: () => void;
  className?: string;
}

export default function CardDisplay({
  name,
  image,
  power,
  rarity,
  size = 'medium',
  showInfo = true,
  isFlipped = false,
  onClick,
  className = '',
}: CardDisplayProps) {
  const sizeClasses = {
    small: 'w-20 h-28',
    medium: 'w-32 h-44',
    large: 'w-48 h-64',
  };

  return (
    <motion.div
      animate={{ rotateY: isFlipped ? 180 : 0 }}
      transition={{ duration: 0.55 }}
      onClick={onClick}
      className={`card-face flex flex-col justify-between overflow-hidden cursor-pointer ${sizeClasses[size]} ${className}`}
      style={{
        transformStyle: 'preserve-3d',
        perspective: '1200px',
      }}
    >
      {/* Card Image */}
      <div className="relative w-full h-full">
        <img
          src={image}
          alt={name}
          className="w-full h-full object-cover"
        />
        {/* Overlay Gradient */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(180deg, transparent 0%, rgba(14, 11, 30, 0.8) 100%)',
          }}
        />

        {/* Card Info */}
        {showInfo && (
          <div className="absolute bottom-0 left-0 right-0 p-2">
            <p
              className="text-xs font-bold mb-1 truncate"
              style={{
                fontFamily: "'Syne', sans-serif",
                color: '#FFFFFF',
              }}
            >
              {name}
            </p>

            <div className="flex items-center justify-between">
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: RARITY_COLORS[rarity] || '#A0AEC0',
                }}
              />
              <span
                className="text-xs font-bold px-1.5 py-0.5 rounded"
                style={{
                  fontFamily: "'Syne', sans-serif",
                  background: '#8B5CF6',
                  color: '#FFFFFF',
                }}
              >
                {power}
              </span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
