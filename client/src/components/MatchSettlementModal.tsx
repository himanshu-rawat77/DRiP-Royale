import { motion } from 'framer-motion';
import { useLocation } from 'wouter';

interface MatchSettlementModalProps {
  isOpen: boolean;
  winner: 'player1' | 'player2' | null;
  winnerName: string;
  loserName: string;
  nftsWon: Array<{ id: number; name: string; power: number; image: string }>;
  roundsPlayed: number;
  onClose: () => void;
}

export default function MatchSettlementModal({
  isOpen,
  winner,
  winnerName,
  loserName,
  nftsWon,
  roundsPlayed,
  onClose,
}: MatchSettlementModalProps) {
  const [, navigate] = useLocation();

  if (!isOpen || !winner) return null;

  const handleTransferAndReturn = () => {
    // In a real app, this would trigger the smart contract transfer
    // For now, we'll just navigate back to home
    navigate('/');
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
        className="drip-panel-hot p-12 max-w-2xl w-full rounded-lg max-h-[90vh] overflow-y-auto"
      >
        {/* Victory Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center mb-8"
        >
          <p
            className="text-sm font-bold mb-2"
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              color: '#10B981',
              letterSpacing: '0.1em',
            }}
          >
            // MATCH COMPLETE
          </p>
          <h2
            className="text-4xl font-bold mb-4"
            style={{
              fontFamily: "'Syne', sans-serif",
              color: '#10B981',
            }}
          >
            VICTORY!
          </h2>
          <p
            className="text-lg"
            style={{
              fontFamily: "'Outfit', sans-serif",
              color: 'rgba(255, 255, 255, 0.7)',
            }}
          >
            {winnerName} defeated {loserName}
          </p>
          <p
            className="text-sm mt-2"
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              color: 'rgba(255, 255, 255, 0.4)',
            }}
          >
            Match Duration: {roundsPlayed} rounds
          </p>
        </motion.div>

        {/* NFTs Won Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-8"
        >
          <p
            className="text-sm font-bold mb-4"
            style={{
              fontFamily: "'Syne', sans-serif",
              color: '#FFFFFF',
            }}
          >
            NFTs Won ({nftsWon.length})
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
            {nftsWon.map((nft, index) => (
              <motion.div
                key={nft.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 + index * 0.05 }}
                className="relative rounded-lg overflow-hidden"
                style={{
                  border: '2px solid #10B981',
                  boxShadow: '0 0 15px rgba(16, 185, 129, 0.3)',
                }}
              >
                <div className="relative w-full aspect-[2/3] overflow-hidden">
                  <img
                    src={nft.image}
                    alt={nft.name}
                    className="w-full h-full object-cover"
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      background: 'linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.6) 100%)',
                    }}
                  />
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-2">
                  <p
                    className="text-xs font-bold line-clamp-1"
                    style={{
                      fontFamily: "'Syne', sans-serif",
                      color: '#FFFFFF',
                    }}
                  >
                    {nft.name}
                  </p>
                  <span
                    className="text-xs font-bold px-1 py-0.5 rounded inline-block"
                    style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      background: '#10B981',
                      color: '#FFFFFF',
                    }}
                  >
                    ⚡ {nft.power}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="drip-panel p-4 text-center"
          >
            <p
              className="text-sm"
              style={{
                fontFamily: "'Outfit', sans-serif",
                color: 'rgba(255, 255, 255, 0.7)',
              }}
            >
              These NFTs are now in your local wallet and ready to be transferred to your main account.
            </p>
          </motion.div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex flex-col sm:flex-row gap-4"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleTransferAndReturn}
            className="flex-1 px-6 py-3 font-bold text-sm rounded-lg"
            style={{
              fontFamily: "'Syne', sans-serif",
              background: 'linear-gradient(135deg, #10B981, #34D399)',
              color: '#FFFFFF',
              letterSpacing: '0.05em',
            }}
          >
            TRANSFER & RETURN HOME
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            className="flex-1 px-6 py-3 font-bold text-sm rounded-lg"
            style={{
              fontFamily: "'Syne', sans-serif",
              background: 'rgba(139, 92, 246, 0.1)',
              color: '#8B5CF6',
              border: '2px solid rgba(139, 92, 246, 0.3)',
              letterSpacing: '0.05em',
            }}
          >
            CLOSE
          </motion.button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
