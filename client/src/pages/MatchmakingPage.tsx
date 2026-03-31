import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import TopBar from '@/components/TopBar';
import Footer from '@/components/Footer';
import { useDeck } from '@/contexts/DeckContext';
import { useMatchmaking } from '@/hooks/useMatchmaking';

const MATCHMAKING_BG = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663486830791/WuCyWqVdFPbfCADWcJauKD/arena-split-bg-By5zBsUSv6CrFLKpdTgQ8r.webp';

export default function MatchmakingPage() {
  const [, navigate] = useLocation();
  const { selectedDeck } = useDeck();
  const [playerId] = useState(() => `player-${Math.random().toString(36).substr(2, 9)}`);
  const matchmaking = useMatchmaking(playerId);
  const [queueStatus, setQueueStatus] = useState<'idle' | 'joining' | 'waiting' | 'found'>('idle');

  // Redirect if no deck selected
  useEffect(() => {
    if (!selectedDeck || selectedDeck.length === 0) {
      navigate('/vault');
    }
  }, [selectedDeck, navigate]);

  // Handle match found
  useEffect(() => {
    if (matchmaking.currentRoom) {
      sessionStorage.setItem(
        'drip-multiplayer',
        JSON.stringify({
          roomId: matchmaking.currentRoom.roomId,
          playerId: matchmaking.playerId,
        })
      );
      setQueueStatus('found');
      setTimeout(() => {
        navigate('/arena');
      }, 2000);
    }
  }, [matchmaking.currentRoom, matchmaking.playerId, navigate]);

  const handleJoinQueue = () => {
    if (selectedDeck) {
      setQueueStatus('joining');
      matchmaking.joinQueue(selectedDeck.length);
      setTimeout(() => setQueueStatus('waiting'), 500);
    }
  };

  const handleLeaveQueue = () => {
    matchmaking.leaveQueue();
    setQueueStatus('idle');
  };

  const formatWaitTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-black">
      <TopBar />
      <main className="flex-1">
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden py-20 px-6"
          style={{ background: '#07060F' }}
        >
          {/* Background */}
          <div className="absolute inset-0 z-0">
            <img
              src={MATCHMAKING_BG}
              alt="Matchmaking Background"
              className="absolute inset-0 w-full h-full object-cover"
              style={{
                filter: 'saturate(0.2) brightness(0.3)',
              }}
            />
            <div
              className="absolute inset-0"
              style={{
                background: `
                  radial-gradient(ellipse 60% 50% at 50% 50%, rgba(139, 92, 246, 0.1), transparent)
                `,
              }}
            />
          </div>

          <div className="container relative z-10 max-w-2xl">
            {/* Deck Info */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="drip-panel p-6 mb-12 text-center"
            >
              <p
                className="text-xs font-bold mb-2"
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  color: '#8B5CF6',
                  letterSpacing: '0.1em',
                }}
              >
                DECK READY
              </p>
              <p
                className="text-heading"
                style={{
                  fontSize: '1.5rem',
                  color: '#FFFFFF',
                }}
              >
                {selectedDeck?.length || 0} Cards Selected
              </p>
            </motion.div>

            {/* Connection Status */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6 }}
              className="drip-panel p-8 mb-12 text-center"
            >
              <div className="flex items-center justify-center gap-2 mb-4">
                <motion.div
                  animate={{
                    scale: matchmaking.isConnected ? [1, 1.2, 1] : 1,
                    opacity: matchmaking.isConnected ? 1 : 0.5,
                  }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="w-3 h-3 rounded-full"
                  style={{
                    background: matchmaking.isConnected ? '#8B5CF6' : '#EF4444',
                  }}
                />
                <p
                  className="text-xs font-bold"
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    color: matchmaking.isConnected ? '#8B5CF6' : '#EF4444',
                  }}
                >
                  {matchmaking.isConnected ? 'CONNECTED' : 'CONNECTING...'}
                </p>
              </div>

              {matchmaking.error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs"
                  style={{ color: '#EF4444' }}
                >
                  {matchmaking.error}
                </motion.p>
              )}
            </motion.div>

            {/* Main Matchmaking UI */}
            {queueStatus === 'idle' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6 }}
                className="drip-panel-hot p-12 text-center"
              >
                <p
                  className="text-heading mb-6"
                  style={{
                    fontSize: '2.5rem',
                    color: '#FFFFFF',
                  }}
                >
                  Find an Opponent
                </p>

                <p
                  className="text-body mb-8"
                  style={{
                    color: 'rgba(255, 255, 255, 0.55)',
                    fontSize: '1rem',
                  }}
                >
                  Join the matchmaking queue to battle another player in real-time. May the best deck win!
                </p>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleJoinQueue}
                  disabled={!matchmaking.isConnected}
                  className="px-12 py-4 font-bold text-lg rounded-lg"
                  style={{
                    fontFamily: "'Syne', sans-serif",
                    background: matchmaking.isConnected
                      ? 'linear-gradient(135deg, #8B5CF6, #A78BFA)'
                      : 'rgba(139, 92, 246, 0.2)',
                    color: '#FFFFFF',
                    letterSpacing: '0.1em',
                    cursor: matchmaking.isConnected ? 'pointer' : 'not-allowed',
                    opacity: matchmaking.isConnected ? 1 : 0.5,
                  }}
                >
                  JOIN QUEUE
                </motion.button>
              </motion.div>
            )}

            {/* Joining State */}
            {queueStatus === 'joining' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6 }}
                className="drip-panel-hot p-12 text-center"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  className="inline-block mb-6"
                >
                  <p className="text-4xl">⚙️</p>
                </motion.div>

                <p
                  className="text-heading mb-4"
                  style={{
                    fontSize: '1.5rem',
                    color: '#8B5CF6',
                  }}
                >
                  Joining Queue...
                </p>
              </motion.div>
            )}

            {/* Waiting State */}
            {queueStatus === 'waiting' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6 }}
                className="drip-panel-hot p-12 text-center"
              >
                {/* Animated Dots */}
                <div className="flex justify-center gap-2 mb-8">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      animate={{ y: [0, -10, 0] }}
                      transition={{
                        duration: 0.6,
                        repeat: Infinity,
                        delay: i * 0.2,
                      }}
                      className="w-3 h-3 rounded-full"
                      style={{ background: '#8B5CF6' }}
                    />
                  ))}
                </div>

                <p
                  className="text-heading mb-2"
                  style={{
                    fontSize: '1.5rem',
                    color: '#FFFFFF',
                  }}
                >
                  Searching for Opponent
                </p>

                <p
                  className="text-body mb-8"
                  style={{
                    color: 'rgba(255, 255, 255, 0.55)',
                    fontSize: '0.875rem',
                  }}
                >
                  Wait time: {formatWaitTime(matchmaking.queueWaitTime)}
                </p>

                {/* Live Players */}
                <div className="mb-8 p-4 rounded-lg" style={{ background: 'rgba(139, 92, 246, 0.05)' }}>
                  <p
                    className="text-xs font-bold mb-2"
                    style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      color: '#A78BFA',
                    }}
                  >
                    PLAYERS IN QUEUE
                  </p>
                  <motion.p
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="text-heading text-3xl"
                    style={{
                      fontFamily: "'Syne', sans-serif",
                      color: '#8B5CF6',
                    }}
                  >
                    {Math.floor(Math.random() * 50) + 10}
                  </motion.p>
                </div>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleLeaveQueue}
                  className="px-8 py-3 font-bold text-sm rounded-lg"
                  style={{
                    fontFamily: "'Syne', sans-serif",
                    background: 'transparent',
                    color: '#F59E0B',
                    border: '2px solid rgba(245, 158, 11, 0.5)',
                    letterSpacing: '0.05em',
                  }}
                >
                  CANCEL
                </motion.button>
              </motion.div>
            )}

            {/* Match Found State */}
            {queueStatus === 'found' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6 }}
                className="drip-panel-hot p-12 text-center"
              >
                <motion.p
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.6 }}
                  className="text-5xl mb-6"
                >
                  🎉
                </motion.p>

                <p
                  className="text-heading mb-4"
                  style={{
                    fontSize: '2rem',
                    color: '#8B5CF6',
                  }}
                >
                  Match Found!
                </p>

                <p
                  className="text-body"
                  style={{
                    color: 'rgba(255, 255, 255, 0.55)',
                    fontSize: '0.875rem',
                  }}
                >
                  Entering the Arena...
                </p>
              </motion.div>
            )}

            {/* Tips */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="drip-panel p-6 mt-12 text-center"
            >
              <p
                className="text-xs"
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  color: 'rgba(255, 255, 255, 0.4)',
                }}
              >
                💡 TIP: Higher power cards have better chances of winning each round. Royale War triggers on ties!
              </p>
            </motion.div>
          </div>
        </motion.section>
      </main>
      <Footer />
    </div>
  );
}
