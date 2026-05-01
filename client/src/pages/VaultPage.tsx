import { motion } from 'framer-motion';
import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import TopBar from '@/components/TopBar';
import Footer from '@/components/Footer';
import { useDeck } from '@/contexts/DeckContext';
import { useDummyDeck } from '@/contexts/DummyDeckContext';
import { usePhantomWallet } from '@/contexts/PhantomWalletContext';
import { useHeliusAssets } from '@/hooks/useHeliusAssets';
import { NFT_CARDS } from '@/lib/cardData';
import { clearCampaignSession, readCampaignSession } from '@/lib/campaignSession';
import type { GameCard } from '@/lib/types';

const VAULT_BG =
  'https://d2xsxph8kpxj0f.cloudfront.net/310519663486830791/WuCyWqVdFPbfCADWcJauKD/card-pattern-bg-By5zBsUSv6CrFLKpdTgQ8r.webp';

export default function VaultPage() {
  const [, navigate] = useLocation();
  const { setSelectedDeck, setDeckSize } = useDeck();
  const { publicKey, connect, connecting, isPhantomAvailable } = usePhantomWallet();
  const {
    isDummyMode,
    setIsDummyMode,
    selectedDummyCards,
    addDummyCard,
    removeDummyCard,
    clearDummyDeck,
  } = useDummyDeck();
  const { assets, loading, error, loadAssets, clearError, reset } = useHeliusAssets();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [campaignMode, setCampaignMode] = useState(false);

  useEffect(() => {
    const activeCampaign = !!readCampaignSession();
    setCampaignMode(activeCampaign);
    if (activeCampaign) {
      // Campaign mode is intentionally demo-only for MVP fairness/testing.
      setIsDummyMode(true);
      setSelected(new Set());
    }
  }, []);

  const refreshAssets = useCallback(async () => {
    if (!publicKey) return;
    clearError();
    await loadAssets(publicKey, 52);
  }, [publicKey, loadAssets, clearError]);

  useEffect(() => {
    if (campaignMode) {
      reset();
      setSelected(new Set());
      return;
    }
    if (!publicKey) {
      reset();
      setSelected(new Set());
      return;
    }
    loadAssets(publicKey, 52);
  }, [publicKey, loadAssets, reset]);

  const toggleCardSelection = (cardId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else if (next.size < 52) {
        next.add(cardId);
      }
      return next;
    });
  };

  const handleConnect = async () => {
    try {
      await connect();
      toast.success('Wallet connected');
    } catch {
      toast.error('Could not connect to Phantom');
    }
  };

  const handleSelectDummyCard = (card: (typeof NFT_CARDS)[number]) => {
    const cardId = card.id.toString();
    if (selectedDummyCards.some((c) => c.id === card.id)) {
      removeDummyCard(cardId);
    } else if (selectedDummyCards.length < 52) {
      addDummyCard(card);
    }
  };

  const handleBuildDeck = () => {
    const campaignSession = readCampaignSession();
    if (campaignSession && !isDummyMode) {
      toast.error("Campaign mode uses demo campaign cards only.");
      setIsDummyMode(true);
      return;
    }
    if (isDummyMode) {
      if (selectedDummyCards.length < 5) return;
      if (campaignSession) {
        const selectedCards: GameCard[] = selectedDummyCards.map((card) => ({
          assetId: card.id.toString(),
          imageUri: card.image,
          name: card.name,
          power: card.power,
        }));
        setSelectedDeck(selectedCards);
        setDeckSize(selectedCards.length);
      }
      navigate('/arena');
      return;
    }
    if (selected.size < 5 || !assets.length) return;
    const selectedCards = assets.filter((card) => selected.has(card.assetId));
    if (selectedCards.length < 5) return;
    setSelectedDeck(selectedCards);
    setDeckSize(selectedCards.length);
    navigate(campaignSession ? '/arena' : '/matchmaking');
  };

  const handleClearSelection = () => {
    if (isDummyMode) {
      clearDummyDeck();
    } else {
      setSelected(new Set());
    }
  };

  const handleExitDemo = () => {
    setIsDummyMode(false);
    clearDummyDeck();
  };

  const handleExitCampaign = () => {
    clearCampaignSession();
    setCampaignMode(false);
    setIsDummyMode(false);
  };

  const selectedCount = isDummyMode ? selectedDummyCards.length : selected.size;
  const canEnterWallet = selected.size >= 5 && selected.size <= 52 && assets.length > 0 && !loading;
  const canEnterDummy = isDummyMode && selectedDummyCards.length >= 5;
  const canEnter = campaignMode ? canEnterDummy : isDummyMode ? canEnterDummy : canEnterWallet;

  return (
    <div className="min-h-screen flex flex-col bg-black">
      <TopBar />
      <main className="flex-1">
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="relative min-h-screen py-24 px-6 md:px-16"
          style={{ background: '#07060F' }}
        >
          <div className="absolute inset-0 z-0">
            <img
              src={VAULT_BG}
              alt="Vault Background"
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
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="drip-panel-hot p-8 mb-12"
            >
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
              <h1
                className="text-heading mb-4"
                style={{
                  fontSize: 'clamp(2rem, 6vw, 3.5rem)',
                  color: '#FFFFFF',
                  lineHeight: 1.2,
                }}
              >
                {campaignMode ? 'Build Your Campaign Deck' : 'Build Your Deck'}
              </h1>
              <p
                className="text-body"
                style={{
                  color: 'rgba(255, 255, 255, 0.55)',
                  fontSize: '1rem',
                }}
              >
                {campaignMode
                  ? 'Campaign mode is active. Build 5–52 cards here, then continue to the Arena for staged matches.'
                  : isDummyMode
                  ? 'Build your deck with demo cards. Select 5–52 cards to jump into the arena.'
                  : publicKey
                    ? 'Select 5–52 DRiP cards from your wallet to queue for a match.'
                    : 'Connect Phantom for your on-chain collection, or try a demo deck without a wallet.'}
              </p>
            </motion.div>

            {campaignMode && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="drip-panel p-4 mb-8 flex items-center justify-between gap-4"
              >
                <p className="text-xs" style={{ color: '#A78BFA', fontFamily: "'IBM Plex Mono', monospace" }}>
                  CAMPAIGN FLOW ACTIVE · Vault → Arena (1 → 2 → 3 → Boss)
                </p>
                <button
                  onClick={handleExitCampaign}
                  className="px-3 py-2 rounded-lg text-xs font-bold"
                  style={{ background: 'rgba(245,158,11,0.16)', color: '#F59E0B' }}
                >
                  EXIT CAMPAIGN
                </button>
              </motion.div>
            )}

            {!publicKey && !isDummyMode && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="drip-panel p-8 mb-12 max-w-2xl"
              >
                <p
                  className="text-sm font-bold mb-4"
                  style={{
                    fontFamily: "'Syne', sans-serif",
                    color: '#FFFFFF',
                  }}
                >
                  How would you like to proceed?
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleConnect}
                    disabled={!isPhantomAvailable || connecting}
                    className="px-6 py-4 font-bold text-sm rounded-lg"
                    style={{
                      fontFamily: "'Syne', sans-serif",
                      background: 'linear-gradient(135deg, #8B5CF6, #A78BFA)',
                      color: '#FFFFFF',
                      letterSpacing: '0.05em',
                      opacity: !isPhantomAvailable || connecting ? 0.55 : 1,
                      cursor: !isPhantomAvailable || connecting ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {connecting ? 'CONNECTING…' : 'CONNECT PHANTOM'}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsDummyMode(true)}
                    className="px-6 py-4 font-bold text-sm rounded-lg"
                    style={{
                      fontFamily: "'Syne', sans-serif",
                      background: 'rgba(139, 92, 246, 0.1)',
                      color: '#8B5CF6',
                      border: '2px solid rgba(139, 92, 246, 0.3)',
                      letterSpacing: '0.05em',
                    }}
                  >
                    TRY DEMO DECK
                  </motion.button>
                </div>
                {!isPhantomAvailable && (
                  <p
                    className="text-xs mt-4"
                    style={{ fontFamily: "'Outfit', sans-serif", color: 'rgba(255, 255, 255, 0.4)' }}
                  >
                    Install Phantom from{' '}
                    <a
                      href="https://phantom.app/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-[#A78BFA]"
                    >
                      phantom.app
                    </a>{' '}
                    to connect a wallet.
                  </p>
                )}
              </motion.div>
            )}

            {isDummyMode && (
              <>
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  className="drip-panel p-4 mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                >
                  <div className="flex gap-6">
                    <div>
                      <p
                        className="text-xs"
                        style={{
                          fontFamily: "'IBM Plex Mono', monospace",
                          color: '#A78BFA',
                        }}
                      >
                        SELECTED
                      </p>
                      <p
                        className="text-heading text-2xl"
                        style={{
                          fontFamily: "'Syne', sans-serif",
                          color: '#8B5CF6',
                        }}
                      >
                        {selectedDummyCards.length}
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
                        AVAILABLE
                      </p>
                      <p
                        className="text-heading text-2xl"
                        style={{
                          fontFamily: "'Syne', sans-serif",
                          color: '#F59E0B',
                        }}
                      >
                        {NFT_CARDS.length}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleClearSelection}
                      className="px-4 py-2 text-xs font-bold rounded-lg"
                      style={{
                        fontFamily: "'Syne', sans-serif",
                        background: 'rgba(139, 92, 246, 0.1)',
                        color: '#A78BFA',
                        border: '1px solid rgba(139, 92, 246, 0.2)',
                      }}
                    >
                      CLEAR
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleExitDemo}
                      className="px-4 py-2 text-xs font-bold rounded-lg"
                      style={{
                        fontFamily: "'Syne', sans-serif",
                        background: 'rgba(255, 255, 255, 0.06)',
                        color: 'rgba(255, 255, 255, 0.7)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                      }}
                    >
                      {campaignMode ? 'EXIT DEMO (CAMPAIGN)' : 'EXIT DEMO'}
                    </motion.button>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6 }}
                  className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-12"
                >
                  {NFT_CARDS.map((card, index) => {
                    const isSelected = selectedDummyCards.some((c) => c.id === card.id);
                    return (
                      <motion.div
                        key={card.id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3, delay: index * 0.02 }}
                        whileHover={{ scale: 1.05 }}
                        onClick={() => handleSelectDummyCard(card)}
                        className="cursor-pointer relative group"
                      >
                        <div
                          className="relative rounded-lg overflow-hidden transition-all duration-300"
                          style={{
                            border: isSelected
                              ? '3px solid #8B5CF6'
                              : '2px solid rgba(139, 92, 246, 0.2)',
                            background: isSelected
                              ? 'rgba(139, 92, 246, 0.1)'
                              : 'rgba(0, 0, 0, 0.3)',
                            boxShadow: isSelected ? '0 0 20px rgba(139, 92, 246, 0.4)' : 'none',
                          }}
                        >
                          <div className="relative w-full aspect-[2/3] overflow-hidden">
                            <img
                              src={card.image}
                              alt={card.name}
                              className="w-full h-full object-cover"
                            />
                            <div
                              className="absolute inset-0"
                              style={{
                                background:
                                  'linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.6) 100%)',
                              }}
                            />
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 p-4">
                            <p
                              className="text-xs font-bold mb-2 line-clamp-2"
                              style={{
                                fontFamily: "'Syne', sans-serif",
                                color: '#FFFFFF',
                              }}
                            >
                              {card.name}
                            </p>
                            <div className="flex items-center justify-between">
                              <div className="w-2 h-2 rounded-full" style={{ background: '#8B5CF6' }} />
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
                          {isSelected && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center"
                              style={{ background: '#8B5CF6' }}
                            >
                              <span style={{ color: '#FFFFFF', fontSize: '0.75rem' }}>✓</span>
                            </motion.div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  className="flex flex-col sm:flex-row gap-4 justify-center items-center"
                >
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    disabled={!canEnterDummy}
                    onClick={handleBuildDeck}
                    className="px-8 py-3 font-bold text-sm rounded-lg"
                    style={{
                      fontFamily: "'Syne', sans-serif",
                      background: canEnterDummy
                        ? 'linear-gradient(135deg, #8B5CF6, #A78BFA)'
                        : 'rgba(139, 92, 246, 0.2)',
                      color: '#FFFFFF',
                      letterSpacing: '0.1em',
                      opacity: !canEnterDummy ? 0.5 : 1,
                      cursor: !canEnterDummy ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {selectedDummyCards.length < 5
                      ? `SELECT ${5 - selectedDummyCards.length} MORE CARDS`
                      : campaignMode
                        ? 'ENTER CAMPAIGN ARENA'
                        : 'ENTER THE ARENA'}
                  </motion.button>
                  <p
                    className="text-xs"
                    style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      color: 'rgba(255, 255, 255, 0.4)',
                    }}
                  >
                    {selectedDummyCards.length}/52 CARDS SELECTED
                  </p>
                </motion.div>
              </>
            )}

            {publicKey && !isDummyMode && (
              <>
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  className="drip-panel p-4 mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                >
                  <div className="flex gap-6">
                    <div>
                      <p
                        className="text-xs"
                        style={{
                          fontFamily: "'IBM Plex Mono', monospace",
                          color: '#A78BFA',
                        }}
                      >
                        SELECTED
                      </p>
                      <p
                        className="text-heading text-2xl"
                        style={{
                          fontFamily: "'Syne', sans-serif",
                          color: '#8B5CF6',
                        }}
                      >
                        {selectedCount}
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
                        AVAILABLE
                      </p>
                      <p
                        className="text-heading text-2xl"
                        style={{
                          fontFamily: "'Syne', sans-serif",
                          color: '#F59E0B',
                        }}
                      >
                        {loading ? '…' : assets.length}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleClearSelection}
                      className="px-4 py-2 text-xs font-bold rounded-lg"
                      style={{
                        fontFamily: "'Syne', sans-serif",
                        background: 'rgba(139, 92, 246, 0.1)',
                        color: '#A78BFA',
                        border: '1px solid rgba(139, 92, 246, 0.2)',
                      }}
                    >
                      CLEAR
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setSelected(new Set());
                        setIsDummyMode(true);
                      }}
                      className="px-4 py-2 text-xs font-bold rounded-lg"
                      style={{
                        fontFamily: "'Syne', sans-serif",
                        background: 'rgba(139, 92, 246, 0.1)',
                        color: '#8B5CF6',
                        border: '1px solid rgba(139, 92, 246, 0.25)',
                      }}
                    >
                      PLAY DEMO MATCH
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => refreshAssets()}
                      disabled={loading}
                      className="px-4 py-2 text-xs font-bold rounded-lg"
                      style={{
                        fontFamily: "'Syne', sans-serif",
                        background: 'rgba(245, 158, 11, 0.1)',
                        color: '#F59E0B',
                        border: '1px solid rgba(245, 158, 11, 0.25)',
                        opacity: loading ? 0.5 : 1,
                      }}
                    >
                      REFRESH NFTs
                    </motion.button>
                  </div>
                </motion.div>

                {loading && (
                  <p
                    className="text-center mb-8 text-sm"
                    style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#A78BFA' }}
                  >
                    Loading your DRiP assets…
                  </p>
                )}

                {error && !loading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="drip-panel p-6 mb-8 max-w-2xl"
                  >
                    <p className="text-sm mb-2" style={{ color: '#F87171' }}>
                      {error}
                    </p>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => refreshAssets()}
                      className="px-4 py-2 text-xs font-bold rounded-lg"
                      style={{
                        fontFamily: "'Syne', sans-serif",
                        background: 'rgba(139, 92, 246, 0.2)',
                        color: '#A78BFA',
                      }}
                    >
                      TRY AGAIN
                    </motion.button>
                  </motion.div>
                )}

                {!loading && !error && assets.length === 0 && (
                  <div className="drip-panel p-8 mb-12 max-w-2xl">
                    <p
                      className="text-sm"
                      style={{ fontFamily: "'Outfit', sans-serif", color: 'rgba(255, 255, 255, 0.6)' }}
                    >
                      No qualifying DRiP NFTs found for this wallet on the configured network. If you
                      expect assets here, confirm your Helius key, network (devnet vs mainnet), and optional
                      creator filter in environment settings.
                    </p>
                  </div>
                )}

                {assets.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6 }}
                    className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-12"
                  >
                    {assets.map((card: GameCard, index: number) => {
                      const isSelected = selected.has(card.assetId);
                      return (
                        <motion.div
                          key={card.assetId}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.3, delay: index * 0.02 }}
                          whileHover={{ scale: 1.05 }}
                          onClick={() => toggleCardSelection(card.assetId)}
                          className="cursor-pointer relative group"
                        >
                          <div
                            className="relative rounded-lg overflow-hidden transition-all duration-300"
                            style={{
                              border: isSelected
                                ? '3px solid #8B5CF6'
                                : '2px solid rgba(139, 92, 246, 0.2)',
                              background: isSelected
                                ? 'rgba(139, 92, 246, 0.1)'
                                : 'rgba(0, 0, 0, 0.3)',
                              boxShadow: isSelected
                                ? '0 0 20px rgba(139, 92, 246, 0.4)'
                                : 'none',
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
                                  background:
                                    'linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.6) 100%)',
                                }}
                              />
                            </div>

                            <div className="absolute bottom-0 left-0 right-0 p-4">
                              <p
                                className="text-xs font-bold mb-2 line-clamp-2"
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
                                    background: '#8B5CF6',
                                  }}
                                />
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

                            {isSelected && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center"
                                style={{
                                  background: '#8B5CF6',
                                }}
                              >
                                <span style={{ color: '#FFFFFF', fontSize: '0.75rem' }}>✓</span>
                              </motion.div>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                )}

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  className="flex flex-col sm:flex-row gap-4 justify-center items-center"
                >
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    disabled={!canEnter || loading}
                    onClick={handleBuildDeck}
                    className="px-8 py-3 font-bold text-sm rounded-lg"
                    style={{
                      fontFamily: "'Syne', sans-serif",
                      background: canEnter
                        ? 'linear-gradient(135deg, #8B5CF6, #A78BFA)'
                        : 'rgba(139, 92, 246, 0.2)',
                      color: '#FFFFFF',
                      letterSpacing: '0.1em',
                      opacity: !canEnter || loading ? 0.5 : 1,
                      cursor: !canEnter || loading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {selectedCount < 5
                      ? `SELECT ${5 - selectedCount} MORE CARDS`
                      : campaignMode
                        ? 'ENTER CAMPAIGN ARENA'
                        : 'ENTER THE ARENA'}
                  </motion.button>

                  <p
                    className="text-xs"
                    style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      color: 'rgba(255, 255, 255, 0.4)',
                    }}
                  >
                    {selectedCount}/52 CARDS SELECTED
                  </p>
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
