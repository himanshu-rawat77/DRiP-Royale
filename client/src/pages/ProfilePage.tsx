import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import TopBar from '@/components/TopBar';
import Footer from '@/components/Footer';
import { useHeliusAssets } from '@/hooks/useHeliusAssets';
import AchievementBadges from '@/components/AchievementBadges';
import { PlayerStats } from '@/lib/achievements';
import { useProfileStorage } from '@/hooks/useLocalStorage';
import { usePhantomWallet } from '@/contexts/PhantomWalletContext';
import { fetchRoyaleWalletState, fetchTokenomicsConfig } from '@/lib/tokenomicsClient';

const PROFILE_BG = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663486830791/WuCyWqVdFPbfCADWcJauKD/card-pattern-bg-By5zBsUSv6CrFLKpdTgQ8r.webp';

interface UserProfile {
  username: string;
  bio: string;
  profileImage: string;
  joinDate: string;
  totalWins: number;
  totalLosses: number;
  winRate: number;
}

const DUMMY_LEADERBOARD = [
  { rank: 1, username: 'ShadowMaster', wins: 245, winRate: 78.5 },
  { rank: 2, username: 'GoldenPhoenix', wins: 198, winRate: 75.2 },
  { rank: 3, username: 'VoidSentinel', wins: 187, winRate: 72.1 },
  { rank: 4, username: 'CrystalGuard', wins: 156, winRate: 69.8 },
  { rank: 5, username: 'InfernoDragon', wins: 142, winRate: 67.3 },
];

const DUMMY_LEDGER = [
  { id: 1, opponent: 'ShadowMaster', result: 'WIN', date: '2 hours ago', reward: '+50 SOL' },
  { id: 2, opponent: 'GoldenPhoenix', result: 'LOSS', date: '5 hours ago', reward: '-25 SOL' },
  { id: 3, opponent: 'VoidSentinel', result: 'WIN', date: '1 day ago', reward: '+75 SOL' },
  { id: 4, opponent: 'CrystalGuard', result: 'WIN', date: '2 days ago', reward: '+60 SOL' },
  { id: 5, opponent: 'InfernoDragon', result: 'LOSS', date: '3 days ago', reward: '-30 SOL' },
];

export default function ProfilePage() {
  const [, navigate] = useLocation();
  const { assets, loading, error, loadAssets, clearError, reset } = useHeliusAssets();
  const {
    publicKey,
    connect,
    disconnect,
    connecting,
    error: walletError,
    isPhantomAvailable,
    clearError: clearWalletError,
  } = usePhantomWallet();
  const [storedProfile, setStoredProfile] = useProfileStorage();
  const [isEditing, setIsEditing] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showLedger, setShowLedger] = useState(false);
  const [royaleBalance, setRoyaleBalance] = useState<number>(0);
  const [challengeTickets, setChallengeTickets] = useState<number>(0);
  const [tokenSupply, setTokenSupply] = useState<number | null>(null);

  const [profile, setProfile] = useState<UserProfile>(storedProfile);
  const [editProfile, setEditProfile] = useState<UserProfile>(storedProfile);

  useEffect(() => {
    if (!publicKey) {
      reset();
      return;
    }
    loadAssets(publicKey, 52);
  }, [publicKey, loadAssets, reset]);

  useEffect(() => {
    if (!publicKey) {
      setRoyaleBalance(0);
      setChallengeTickets(0);
      return;
    }
    void (async () => {
      try {
        const walletState = await fetchRoyaleWalletState(publicKey);
        setRoyaleBalance(walletState.royaleBalance);
        setChallengeTickets(walletState.challengeTickets);
      } catch {
        /* ignore */
      }
    })();
  }, [publicKey]);

  useEffect(() => {
    void (async () => {
      try {
        const cfg = await fetchTokenomicsConfig();
        setTokenSupply(cfg.totalSupply);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const handleSaveProfile = () => {
    setProfile(editProfile);
    setStoredProfile(editProfile);
    setIsEditing(false);
  };

  const handleEditChange = (field: keyof UserProfile, value: string) => {
    setEditProfile((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleDisconnectWallet = async () => {
    clearWalletError();
    await disconnect();
    reset();
  };

  const handleConnectPhantom = async () => {
    clearWalletError();
    clearError();
    try {
      await connect();
    } catch {
      /* error surfaced in context */
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-black">
      <TopBar />
      <main className="flex-1">
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="relative min-h-screen py-20 px-6 md:px-16"
          style={{ background: '#07060F' }}
        >
          {/* Background */}
          <div className="absolute inset-0 z-0">
            <img
              src={PROFILE_BG}
              alt="Profile Background"
              className="absolute inset-0 w-full h-full object-cover"
              style={{
                filter: 'saturate(0.2) brightness(0.3)',
              }}
            />
            <div
              className="absolute inset-0"
              style={{
                background: `
                  radial-gradient(ellipse 60% 50% at 50% 50%, rgba(139, 92, 246, 0.08), transparent)
                `,
              }}
            />
          </div>

          <div className="container relative z-10">
            {!publicKey && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="drip-panel p-8 mb-12 max-w-2xl mx-auto"
              >
                <p
                  className="text-sm font-bold mb-4"
                  style={{
                    fontFamily: "'Syne', sans-serif",
                    color: '#FFFFFF',
                  }}
                >
                  Connect Phantom
                </p>

                <p
                  className="text-xs mb-6"
                  style={{
                    fontFamily: "'Outfit', sans-serif",
                    color: 'rgba(255, 255, 255, 0.45)',
                  }}
                >
                  {isPhantomAvailable
                    ? 'Connect with Phantom to load your DRiP NFTs from the chain.'
                    : 'Install Phantom from phantom.app, then refresh this page.'}
                </p>

                <div className="flex flex-col gap-4">
                  {walletError && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-xs"
                      style={{ color: '#EF4444' }}
                    >
                      {walletError}
                    </motion.p>
                  )}

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleConnectPhantom}
                    disabled={!isPhantomAvailable || connecting}
                    className="px-4 py-3 font-bold text-sm rounded-lg"
                    style={{
                      fontFamily: "'Syne', sans-serif",
                      background: 'linear-gradient(135deg, #8B5CF6, #A78BFA)',
                      color: '#FFFFFF',
                      letterSpacing: '0.05em',
                      opacity: !isPhantomAvailable || connecting ? 0.6 : 1,
                      cursor: !isPhantomAvailable || connecting ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {connecting ? 'CONNECTING…' : 'CONNECT PHANTOM'}
                  </motion.button>
                </div>
              </motion.div>
            )}

            {publicKey && (
              <>
                {/* Profile Header */}
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  className="drip-panel-hot p-8 mb-12"
                >
                  <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
                    {/* Profile Image */}
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      className="relative"
                    >
                      <img
                        src={profile.profileImage}
                        alt={profile.username}
                        className="w-32 h-32 rounded-lg"
                        style={{
                          border: '3px solid #8B5CF6',
                          boxShadow: '0 0 20px rgba(139, 92, 246, 0.4)',
                        }}
                      />
                    </motion.div>

                    {/* Profile Info */}
                    <div className="flex-1">
                      <p
                        className="text-xs font-bold mb-2"
                        style={{
                          fontFamily: "'IBM Plex Mono', monospace",
                          color: '#8B5CF6',
                          letterSpacing: '0.1em',
                        }}
                      >
                        // PLAYER PROFILE
                      </p>
                      <h1
                        className="text-heading mb-2"
                        style={{
                          fontSize: '2.5rem',
                          color: '#FFFFFF',
                        }}
                      >
                        {profile.username}
                      </h1>
                      <p
                        className="text-body mb-4"
                        style={{
                          color: 'rgba(255, 255, 255, 0.55)',
                          fontSize: '0.875rem',
                        }}
                      >
                        {profile.bio}
                      </p>

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div>
                          <p
                            className="text-xs"
                            style={{
                              fontFamily: "'IBM Plex Mono', monospace",
                              color: '#A78BFA',
                            }}
                          >
                            WINS
                          </p>
                          <p
                            className="text-heading text-2xl"
                            style={{
                              fontFamily: "'Syne', sans-serif",
                              color: '#8B5CF6',
                            }}
                          >
                            {profile.totalWins}
                          </p>
                        </div>
                        <div>
                          <p
                            className="text-xs"
                            style={{
                              fontFamily: "'IBM Plex Mono', monospace",
                              color: '#A78BFA',
                            }}
                          >
                            LOSSES
                          </p>
                          <p
                            className="text-heading text-2xl"
                            style={{
                              fontFamily: "'Syne', sans-serif",
                              color: '#F59E0B',
                            }}
                          >
                            {profile.totalLosses}
                          </p>
                        </div>
                        <div>
                          <p
                            className="text-xs"
                            style={{
                              fontFamily: "'IBM Plex Mono', monospace",
                              color: '#A78BFA',
                            }}
                          >
                            WIN RATE
                          </p>
                          <p
                            className="text-heading text-2xl"
                            style={{
                              fontFamily: "'Syne', sans-serif",
                              color: '#10B981',
                            }}
                          >
                            {profile.winRate}%
                          </p>
                        </div>
                      </div>

                      {/* Wallet Info */}
                      <p
                        className="text-xs"
                        style={{
                          fontFamily: "'IBM Plex Mono', monospace",
                          color: 'rgba(255, 255, 255, 0.4)',
                        }}
                      >
                        Wallet: {publicKey.slice(0, 8)}...{publicKey.slice(-8)}
                      </p>
                      <p
                        className="text-xs mt-1"
                        style={{
                          fontFamily: "'IBM Plex Mono', monospace",
                          color: '#A78BFA',
                        }}
                      >
                        ROYALE: {royaleBalance.toLocaleString()} · Tickets: {challengeTickets}
                        {tokenSupply !== null ? ` · Supply: ${tokenSupply.toLocaleString()}` : ''}
                      </p>
                    </div>

                    {/* Edit Button */}
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setIsEditing(!isEditing);
                        setEditProfile(profile);
                      }}
                      className="px-6 py-3 font-bold text-sm rounded-lg"
                      style={{
                        fontFamily: "'Syne', sans-serif",
                        background: isEditing
                          ? 'rgba(239, 68, 68, 0.1)'
                          : 'rgba(139, 92, 246, 0.1)',
                        color: isEditing ? '#EF4444' : '#8B5CF6',
                        border: `2px solid ${isEditing ? 'rgba(239, 68, 68, 0.3)' : 'rgba(139, 92, 246, 0.3)'}`,
                      }}
                    >
                      {isEditing ? 'CANCEL' : 'EDIT'}
                    </motion.button>
                  </div>
                </motion.div>

                {/* Edit Profile Form */}
                {isEditing && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="drip-panel p-8 mb-12"
                  >
                    <p
                      className="text-sm font-bold mb-6"
                      style={{
                        fontFamily: "'Syne', sans-serif",
                        color: '#FFFFFF',
                      }}
                    >
                      Edit Profile Information
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      {/* Username */}
                      <div>
                        <label
                          className="block text-xs font-bold mb-2"
                          style={{
                            fontFamily: "'IBM Plex Mono', monospace",
                            color: '#A78BFA',
                          }}
                        >
                          USERNAME
                        </label>
                        <input
                          type="text"
                          value={editProfile.username}
                          onChange={(e) => handleEditChange('username', e.target.value)}
                          className="w-full px-4 py-2 rounded-lg text-sm"
                          style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(139, 92, 246, 0.2)',
                            color: '#FFFFFF',
                          }}
                        />
                      </div>

                      {/* Profile Image URL */}
                      <div>
                        <label
                          className="block text-xs font-bold mb-2"
                          style={{
                            fontFamily: "'IBM Plex Mono', monospace",
                            color: '#A78BFA',
                          }}
                        >
                          PROFILE IMAGE URL
                        </label>
                        <input
                          type="text"
                          value={editProfile.profileImage}
                          onChange={(e) => handleEditChange('profileImage', e.target.value)}
                          className="w-full px-4 py-2 rounded-lg text-sm"
                          style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(139, 92, 246, 0.2)',
                            color: '#FFFFFF',
                          }}
                        />
                      </div>

                      {/* Bio */}
                      <div className="md:col-span-2">
                        <label
                          className="block text-xs font-bold mb-2"
                          style={{
                            fontFamily: "'IBM Plex Mono', monospace",
                            color: '#A78BFA',
                          }}
                        >
                          BIO
                        </label>
                        <textarea
                          value={editProfile.bio}
                          onChange={(e) => handleEditChange('bio', e.target.value)}
                          rows={3}
                          className="w-full px-4 py-2 rounded-lg text-sm"
                          style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(139, 92, 246, 0.2)',
                            color: '#FFFFFF',
                            fontFamily: "'Outfit', sans-serif",
                            resize: 'none',
                          }}
                        />
                      </div>
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleSaveProfile}
                      className="px-8 py-3 font-bold text-sm rounded-lg"
                      style={{
                        fontFamily: "'Syne', sans-serif",
                        background: 'linear-gradient(135deg, #8B5CF6, #A78BFA)',
                        color: '#FFFFFF',
                        letterSpacing: '0.05em',
                      }}
                    >
                      SAVE CHANGES
                    </motion.button>
                  </motion.div>
                )}

                {loading && (
                  <p
                    className="text-xs mb-6"
                    style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#A78BFA' }}
                  >
                    Loading your on-chain DRiP collection…
                  </p>
                )}
                {error && !loading && (
                  <p className="text-xs mb-6" style={{ color: '#F87171' }}>
                    {error}
                  </p>
                )}

                {/* Achievements Section */}
                <AchievementBadges
                  stats={{
                    totalWins: profile.totalWins,
                    totalLosses: profile.totalLosses,
                    winRate: profile.winRate,
                    totalMatches: profile.totalWins + profile.totalLosses,
                    consecutiveWins: Math.floor(profile.totalWins * 0.3),
                    highestWinStreak: Math.floor(profile.totalWins * 0.4),
                    totalEarnings: profile.totalWins * 75,
                    cardsCollected: assets.length,
                  } as PlayerStats}
                />

                {/* NFTs Section */}
                {assets.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="mb-12"
                  >
                    <div className="drip-panel p-6 mb-6">
                      <p
                        className="text-sm font-bold"
                        style={{
                          fontFamily: "'Syne', sans-serif",
                          color: '#FFFFFF',
                        }}
                      >
                        Your DRiP NFTs ({assets.length})
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                      {assets.slice(0, 8).map((card, index) => (
                        <motion.div
                          key={card.assetId}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.3, delay: index * 0.05 }}
                          whileHover={{ scale: 1.05 }}
                          className="cursor-pointer"
                        >
                          <div
                            className="relative rounded-lg overflow-hidden"
                            style={{
                              border: '2px solid rgba(139, 92, 246, 0.2)',
                              background: 'rgba(0, 0, 0, 0.3)',
                            }}
                          >
                            <div className="relative w-full aspect-[2/3] overflow-hidden">
                              <img
                                src={card.imageUri}
                                alt={card.name}
                                className="w-full h-full object-cover"
                              />
                              <div
                                className="absolute inset-0"
                                style={{
                                  background: 'linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.6) 100%)',
                                }}
                              />
                            </div>

                            <div className="absolute bottom-0 left-0 right-0 p-3">
                              <p
                                className="text-xs font-bold line-clamp-2 mb-2"
                                style={{
                                  fontFamily: "'Syne', sans-serif",
                                  color: '#FFFFFF',
                                }}
                              >
                                {card.name}
                              </p>
                              <span
                                className="text-xs font-bold px-2 py-1 rounded"
                                style={{
                                  fontFamily: "'IBM Plex Mono', monospace",
                                  background: '#8B5CF6',
                                  color: '#FFFFFF',
                                }}
                              >
                                ⚡ {card.power}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    {assets.length > 8 && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center mt-6 text-xs"
                        style={{
                          fontFamily: "'IBM Plex Mono', monospace",
                          color: 'rgba(255, 255, 255, 0.4)',
                        }}
                      >
                        +{assets.length - 8} more NFTs in your collection
                      </motion.p>
                    )}
                  </motion.div>
                )}

                {/* Leaderboard Preview */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  className="mb-12"
                >
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    onClick={() => setShowLeaderboard(!showLeaderboard)}
                    className="w-full drip-panel p-6 mb-6 text-left"
                  >
                    <p
                      className="text-sm font-bold"
                      style={{
                        fontFamily: "'Syne', sans-serif",
                        color: '#FFFFFF',
                      }}
                    >
                      Global Leaderboard {showLeaderboard ? '▼' : '▶'}
                    </p>
                  </motion.button>

                  {showLeaderboard && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      transition={{ duration: 0.3 }}
                      className="drip-panel p-6"
                    >
                      <div className="space-y-3">
                        {DUMMY_LEADERBOARD.map((player, index) => (
                          <motion.div
                            key={player.rank}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="flex items-center justify-between p-3 rounded-lg"
                            style={{
                              background: 'rgba(139, 92, 246, 0.05)',
                              border: '1px solid rgba(139, 92, 246, 0.1)',
                            }}
                          >
                            <div className="flex items-center gap-4">
                              <span
                                className="text-sm font-bold w-8"
                                style={{
                                  fontFamily: "'Syne', sans-serif",
                                  color: player.rank === 1 ? '#F59E0B' : '#8B5CF6',
                                }}
                              >
                                #{player.rank}
                              </span>
                              <span
                                className="text-sm"
                                style={{
                                  fontFamily: "'Outfit', sans-serif",
                                  color: '#FFFFFF',
                                }}
                              >
                                {player.username}
                              </span>
                            </div>
                            <div className="flex items-center gap-4">
                              <span
                                className="text-xs"
                                style={{
                                  fontFamily: "'IBM Plex Mono', monospace",
                                  color: 'rgba(255, 255, 255, 0.5)',
                                }}
                              >
                                {player.wins} wins
                              </span>
                              <span
                                className="text-xs font-bold px-2 py-1 rounded"
                                style={{
                                  fontFamily: "'IBM Plex Mono', monospace",
                                  background: '#10B981',
                                  color: '#FFFFFF',
                                }}
                              >
                                {player.winRate}%
                              </span>
                            </div>
                          </motion.div>
                        ))}
                      </div>

                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => navigate('/leaderboard')}
                        className="w-full mt-6 px-4 py-2 font-bold text-sm rounded-lg"
                        style={{
                          fontFamily: "'Syne', sans-serif",
                          background: 'rgba(139, 92, 246, 0.1)',
                          color: '#8B5CF6',
                          border: '1px solid rgba(139, 92, 246, 0.2)',
                        }}
                      >
                        VIEW FULL LEADERBOARD
                      </motion.button>
                    </motion.div>
                  )}
                </motion.div>

                {/* Ledger Preview */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  className="mb-12"
                >
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    onClick={() => setShowLedger(!showLedger)}
                    className="w-full drip-panel p-6 mb-6 text-left"
                  >
                    <p
                      className="text-sm font-bold"
                      style={{
                        fontFamily: "'Syne', sans-serif",
                        color: '#FFFFFF',
                      }}
                    >
                      Match History {showLedger ? '▼' : '▶'}
                    </p>
                  </motion.button>

                  {showLedger && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      transition={{ duration: 0.3 }}
                      className="drip-panel p-6"
                    >
                      <div className="space-y-3">
                        {DUMMY_LEDGER.map((entry, index) => (
                          <motion.div
                            key={entry.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="flex items-center justify-between p-3 rounded-lg"
                            style={{
                              background: 'rgba(139, 92, 246, 0.05)',
                              border: '1px solid rgba(139, 92, 246, 0.1)',
                            }}
                          >
                            <div className="flex items-center gap-4">
                              <span
                                className="text-xs font-bold px-2 py-1 rounded"
                                style={{
                                  fontFamily: "'IBM Plex Mono', monospace",
                                  background: entry.result === 'WIN' ? '#10B981' : '#EF4444',
                                  color: '#FFFFFF',
                                }}
                              >
                                {entry.result}
                              </span>
                              <div>
                                <p
                                  className="text-sm"
                                  style={{
                                    fontFamily: "'Outfit', sans-serif",
                                    color: '#FFFFFF',
                                  }}
                                >
                                  vs {entry.opponent}
                                </p>
                                <p
                                  className="text-xs"
                                  style={{
                                    fontFamily: "'IBM Plex Mono', monospace",
                                    color: 'rgba(255, 255, 255, 0.4)',
                                  }}
                                >
                                  {entry.date}
                                </p>
                              </div>
                            </div>
                            <span
                              className="text-sm font-bold"
                              style={{
                                fontFamily: "'Syne', sans-serif",
                                color: entry.result === 'WIN' ? '#10B981' : '#EF4444',
                              }}
                            >
                              {entry.reward}
                            </span>
                          </motion.div>
                        ))}
                      </div>

                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => navigate('/ledger')}
                        className="w-full mt-6 px-4 py-2 font-bold text-sm rounded-lg"
                        style={{
                          fontFamily: "'Syne', sans-serif",
                          background: 'rgba(139, 92, 246, 0.1)',
                          color: '#8B5CF6',
                          border: '1px solid rgba(139, 92, 246, 0.2)',
                        }}
                      >
                        VIEW FULL HISTORY
                      </motion.button>
                    </motion.div>
                  )}
                </motion.div>

                {/* Change Wallet Button */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  className="text-center"
                >
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleDisconnectWallet}
                    className="px-6 py-2 font-bold text-sm rounded-lg"
                    style={{
                      fontFamily: "'Syne', sans-serif",
                      background: 'transparent',
                      color: '#F59E0B',
                      border: '2px solid rgba(245, 158, 11, 0.3)',
                    }}
                  >
                    DISCONNECT WALLET
                  </motion.button>
                </motion.div>
              </>
            )}
          </div>
        </motion.section>
      </main>
      <Footer />
    </div>
  );
}
