import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import TopBar from '@/components/TopBar';
import Footer from '@/components/Footer';
import DifficultySelector from '@/components/DifficultySelector';
import { useDeck } from '@/contexts/DeckContext';
import { useDummyDeck } from '@/contexts/DummyDeckContext';
import { useLedgerStorage } from '@/hooks/useLocalStorage';
import {
  initializeLocalMatch,
  submitPick,
  getMatchStats,
  getWinnerInfo,
  getNftsCapturedFromOpponent,
} from '@/lib/localMatchEngine';
import { createAIStrategy } from '@/lib/aiStrategy';
import { getMatchmakingService, type MatchmakingMessage } from '@/lib/websocket';
import { fetchEscrowConfig, ensureEscrowDepositsForMatch } from '@/lib/escrowClient';
import {
  continueCampaignRun,
  exitCampaignRun,
  pickCampaignCard,
  startCampaignRun,
  type CampaignRunState,
} from '@/lib/soloCampaignClient';
import { usePhantomWallet } from '@/contexts/PhantomWalletContext';
import { clearCampaignSession, readCampaignSession, writeCampaignSession } from '@/lib/campaignSession';
import type { LocalMatch } from '@/lib/localMatchEngine';
import type { GameCard } from '@/lib/types';
import type { AIDifficulty } from '@/lib/aiStrategy';

const ARENA_BG = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663486830791/WuCyWqVdFPbfCADWcJauKD/arena-split-bg-By5zBsUSv6CrFLKpdTgQ8r.webp';

type MpSession = { roomId: string; playerId: string } | null;

function readMpSession(): MpSession {
  try {
    const raw = sessionStorage.getItem('drip-multiplayer');
    if (!raw) return null;
    const o = JSON.parse(raw) as { roomId?: string; playerId?: string };
    if (o.roomId && o.playerId) return { roomId: o.roomId, playerId: o.playerId };
  } catch {
    /* ignore */
  }
  return null;
}

export default function ArenaPage() {
  const [, navigate] = useLocation();
  const { publicKey } = usePhantomWallet();
  const { selectedDeck } = useDeck();
  const { isDummyMode, selectedDummyCards } = useDummyDeck();
  const [ledger, setLedger] = useLedgerStorage();
  const ledgerRef = useRef(ledger);
  ledgerRef.current = ledger;

  const [mpSession] = useState<MpSession>(() => readMpSession());
  // Difficulty selection is only for local demo vs AI (not multiplayer).
  const [showDifficultySelector, setShowDifficultySelector] = useState(
    () => isDummyMode && !readMpSession() && !readCampaignSession()
  );
  const [selectedDifficulty, setSelectedDifficulty] = useState<AIDifficulty>('medium');
  const [aiStrategy, setAiStrategy] = useState(createAIStrategy('medium'));
  const [youAre, setYouAre] = useState<'player1' | 'player2' | null>(null);
  const mpSettlementDone = useRef(false);

  const [match, setMatch] = useState<LocalMatch | null>(null);
  const [showSettlement, setShowSettlement] = useState(false);
  const [lastFlippedCards, setLastFlippedCards] = useState<{ player1: any; player2: any } | null>(null);
  const [campaignRun, setCampaignRun] = useState<CampaignRunState | null>(null);
  const [campaignBusy, setCampaignBusy] = useState(false);
  const [campaignSession] = useState(() => readCampaignSession());

  // Handle difficulty selection
  const handleSelectDifficulty = (difficulty: AIDifficulty) => {
    setSelectedDifficulty(difficulty);
    setAiStrategy(createAIStrategy(difficulty));
  };

  // Start match with selected difficulty
  const handleStartMatch = () => {
    let playerDeck: GameCard[] | null = null;

    if (isDummyMode && selectedDummyCards.length > 0) {
      playerDeck = selectedDummyCards.map((card) => ({
        assetId: card.id.toString(),
        imageUri: card.image,
        name: card.name,
        power: card.power,
      }));
    } else if (selectedDeck && selectedDeck.length > 0) {
      playerDeck = selectedDeck.map((card) => ({ ...card }));
    }

    if (!playerDeck || playerDeck.length === 0) {
      navigate('/vault');
      return;
    }

    // Create opponent deck (shuffled copy)
    const opponentDeck: GameCard[] = [...playerDeck].sort(() => Math.random() - 0.5);

    // Demo matches use an AI opponent name; real NFT matches should not show the AI selector.
    const opponentName = isDummyMode ? aiStrategy.getOpponentName() : 'Opponent';
    const newMatch = initializeLocalMatch(playerDeck, opponentDeck, 'You', opponentName);
    setMatch(newMatch);
    setShowDifficultySelector(false);
  };

  // Solo / vs AI only — multiplayer state comes from the WebSocket server.
  useEffect(() => {
    if (campaignSession) return;
    if (mpSession) return;
    if (!isDummyMode && !match) {
      setShowDifficultySelector(false);
      if (selectedDeck && selectedDeck.length > 0) {
        handleStartMatch();
      }
    } else if (isDummyMode && !match && !mpSession) {
      setShowDifficultySelector(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDummyMode, mpSession]);

  useEffect(() => {
    if (!campaignSession || !selectedDeck?.length || !publicKey || campaignRun) return;
    let cancelled = false;
    setCampaignBusy(true);
    void (async () => {
      try {
        const run = await startCampaignRun({
          campaignId: campaignSession.campaignId,
          walletAddress: publicKey,
          deck: selectedDeck,
          difficulty: campaignSession.difficulty,
          useTicket: false,
        });
        if (cancelled) return;
        setCampaignRun(run);
        setMatch(run.match);
        writeCampaignSession({
          ...campaignSession,
          runId: run.runId,
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not start campaign run');
        clearCampaignSession();
        navigate('/campaigns');
      } finally {
        if (!cancelled) setCampaignBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [campaignSession, selectedDeck, publicKey, campaignRun, navigate]);

  useEffect(() => {
    if (!mpSession || !selectedDeck?.length) return;

    const service = getMatchmakingService(mpSession.playerId);
    const deckPayload = selectedDeck.map((c) => ({
      assetId: c.assetId,
      imageUri: c.imageUri,
      name: c.name,
      power: c.power,
    }));

    const sendDeck = () => service.sendRejoinRoom(mpSession.roomId, deckPayload);

    mpSettlementDone.current = false;

    let unsubGame: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      try {
        const cfg = await fetchEscrowConfig();
        if (cancelled) return;
        if (cfg.enabled && cfg.custodyPubkey) {
          if (!publicKey) {
            toast.error('Connect your Phantom wallet — your deck must move into escrow before this match.');
            navigate('/vault');
            return;
          }
          const escrowDoneKey = `drip-escrow-done-${mpSession.roomId}-${mpSession.playerId}`;
          if (sessionStorage.getItem(escrowDoneKey) !== '1') {
            toast.loading('Moving NFTs into escrow…', { id: 'escrow' });
            await ensureEscrowDepositsForMatch({
              roomId: mpSession.roomId,
              playerId: mpSession.playerId,
              walletAddress: publicKey,
              deck: selectedDeck,
              custodyPubkey: cfg.custodyPubkey,
            });
            sessionStorage.setItem(escrowDoneKey, '1');
            toast.dismiss('escrow');
          }
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Escrow failed', { id: 'escrow' });
        navigate('/vault');
        return;
      }

      if (cancelled) return;

      if (service.isConnected()) {
        sendDeck();
      } else {
        void service.connect().then(sendDeck);
      }

      unsubGame = service.on('game_state', (msg: MatchmakingMessage) => {
        const pl = msg.payload as { match?: LocalMatch; youAre?: 'player1' | 'player2' };
        if (!pl?.match) return;
        setMatch(pl.match);
        if (pl.youAre) setYouAre(pl.youAre);

        if (pl.match.roundResults.length > 0) {
          const lastResult = pl.match.roundResults[pl.match.roundResults.length - 1];
          setLastFlippedCards({
            player1: lastResult.player1Card,
            player2: lastResult.player2Card,
          });
        }

        if (!pl.match.isActive && pl.match.winner && pl.youAre && !mpSettlementDone.current) {
          mpSettlementDone.current = true;
          window.setTimeout(() => {
            setShowSettlement(true);
            const won = pl.match!.winner === pl.youAre;
            if (won) {
              const captured = getNftsCapturedFromOpponent(pl.match!);
              const winnerInfo = getWinnerInfo(pl.match!);
              if (winnerInfo) {
                const newEntry = {
                  id: `match-${Date.now()}`,
                  opponent: winnerInfo.loser.name,
                  result: 'WIN' as const,
                  date: new Date().toLocaleString(),
                  reward: `+${captured.length * 10} SOL`,
                  nftsWon: captured.map((card) => card.assetId || card.name || ''),
                };
                setLedger([newEntry, ...ledgerRef.current]);
              }
            }
          }, 800);
        }
      });
    })();

    return () => {
      cancelled = true;
      unsubGame?.();
    };
  }, [mpSession, selectedDeck, publicKey, navigate]);

  const handlePickCard = (player: 'player1' | 'player2', assetId: string) => {
    if (!match?.isActive) return;
    if (campaignSession && campaignRun && publicKey) {
      if (player !== 'player1') return;
      if (campaignRun.status !== 'in_progress' || match.pickTurn !== 'player1') return;
      setCampaignBusy(true);
      void (async () => {
        try {
          const next = await pickCampaignCard({
            runId: campaignRun.runId,
            walletAddress: publicKey,
            assetId,
          });
          setCampaignRun(next);
          setMatch(next.match);
          if (next.match && next.match.roundResults.length > 0) {
            const lastResult = next.match.roundResults[next.match.roundResults.length - 1];
            setLastFlippedCards({
              player1: lastResult.player1Card,
              player2: lastResult.player2Card,
            });
          }
          if (next.status === 'stage_won' || next.status === 'lost' || next.status === 'completed') {
            setShowSettlement(true);
          }
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'Could not play card');
        } finally {
          setCampaignBusy(false);
        }
      })();
      return;
    }
    if (mpSession) {
      if (!youAre || player !== youAre || match.pickTurn !== youAre || match.picksThisRound[youAre]) return;
      const service = getMatchmakingService(mpSession.playerId);
      if (service.isConnected()) {
        service.sendPlayerAction(mpSession.roomId, { action: 'pick', assetId });
      }
      return;
    }
    const updatedMatch = submitPick(match, player, assetId);
    setMatch(updatedMatch);

    if (updatedMatch.roundResults.length > 0) {
      const lastResult = updatedMatch.roundResults[updatedMatch.roundResults.length - 1];
      setLastFlippedCards({
        player1: lastResult.player1Card,
        player2: lastResult.player2Card,
      });
    }

    if (!updatedMatch.isActive) {
      setTimeout(() => {
        setShowSettlement(true);
        const captured = getNftsCapturedFromOpponent(updatedMatch);
        const winnerInfo = getWinnerInfo(updatedMatch);
        if (winnerInfo) {
          const newEntry = {
            id: `match-${Date.now()}`,
            opponent: winnerInfo.loser.name,
            result: 'WIN' as const,
            date: new Date().toLocaleString(),
            reward: `+${captured.length * 10} SOL`,
            nftsWon: captured.map((card) => card.assetId || card.name || ''),
          };
          setLedger([newEntry, ...ledgerRef.current]);
        }
      }, 800);
    }
  };

  // Demo / AI: opponent picks automatically when it's their turn.
  useEffect(() => {
    if (campaignSession) return;
    if (mpSession || !match?.isActive || !isDummyMode || match.pickTurn !== 'player2') return;
    if (match.picksThisRound.player2) return;

    const t = window.setTimeout(() => {
      setMatch((prev) => {
        if (!prev?.isActive || prev.pickTurn !== 'player2' || prev.picksThisRound.player2) return prev;
        const aiPick = aiStrategy.selectCard({
          hand: [...prev.player2.deck],
          opponentHand: [...prev.player1.deck],
          playerWins: prev.player2.won.length,
          opponentWins: prev.player1.won.length,
          roundNumber: prev.currentRound + 1,
        });
        if (!aiPick) return prev;
        const next = submitPick(prev, 'player2', aiPick.assetId);
        if (next.roundResults.length > 0) {
          const lastResult = next.roundResults[next.roundResults.length - 1];
          setLastFlippedCards({
            player1: lastResult.player1Card,
            player2: lastResult.player2Card,
          });
        }
        if (!next.isActive) {
          setTimeout(() => {
            setShowSettlement(true);
            const captured = getNftsCapturedFromOpponent(next);
            const winnerInfo = getWinnerInfo(next);
            if (winnerInfo) {
              const newEntry = {
                id: `match-${Date.now()}`,
                opponent: winnerInfo.loser.name,
                result: 'WIN' as const,
                date: new Date().toLocaleString(),
                reward: `+${captured.length * 10} SOL`,
                nftsWon: captured.map((card) => card.assetId || card.name || ''),
              };
              setLedger([newEntry, ...ledgerRef.current]);
            }
          }, 800);
        }
        return next;
      });
    }, 650);
    return () => clearTimeout(t);
  }, [
    match?.pickTurn,
    match?.currentRound,
    match?.isActive,
    match?.picksThisRound.player1,
    isDummyMode,
    aiStrategy,
    mpSession,
  ]);

  const handleReturnHome = () => {
    if (campaignSession && campaignRun && publicKey) {
      void exitCampaignRun({
        runId: campaignRun.runId,
        walletAddress: publicKey,
      }).catch(() => {});
      clearCampaignSession();
      navigate('/campaigns');
      return;
    }
    if (campaignSession) {
      clearCampaignSession();
    }
    navigate('/');
  };

  const handleBackToVault = () => {
    navigate('/vault');
  };

  const handlePlayAgain = () => {
    if (campaignSession) {
      if (!campaignRun || !publicKey) {
        navigate('/vault');
        return;
      }
      if (campaignRun.status === 'stage_won') {
        setCampaignBusy(true);
        void continueCampaignRun({
          runId: campaignRun.runId,
          walletAddress: publicKey,
        })
          .then((next) => {
            setCampaignRun(next);
            setMatch(next.match);
            setShowSettlement(false);
            setLastFlippedCards(null);
          })
          .catch((e) => {
            toast.error(e instanceof Error ? e.message : 'Could not continue to next stage');
          })
          .finally(() => setCampaignBusy(false));
        return;
      }
      void exitCampaignRun({
        runId: campaignRun.runId,
        walletAddress: publicKey,
      }).catch(() => {});
      clearCampaignSession();
      navigate('/campaigns');
      return;
    }
    sessionStorage.removeItem('drip-multiplayer');
    mpSettlementDone.current = false;
    setYouAre(null);
    setShowDifficultySelector(isDummyMode && !readMpSession());
    setMatch(null);
    setLastFlippedCards(null);
    setShowSettlement(false);
  };

  if (showDifficultySelector) {
    return (
      <div className="min-h-screen flex flex-col bg-black">
        <TopBar />
        <main className="flex-1 flex items-center justify-center">
          <DifficultySelector
            selectedDifficulty={selectedDifficulty}
            onSelectDifficulty={handleSelectDifficulty}
            onStart={handleStartMatch}
            onBack={handleBackToVault}
          />
        </main>
        <Footer />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen flex flex-col bg-black">
        <TopBar />
        <main className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
          <p style={{ color: '#A78BFA' }}>
            {campaignSession
              ? campaignBusy
                ? 'Initializing campaign stage…'
                : 'Campaign deck missing. Return to Vault to build deck.'
              : mpSession
                ? 'Connecting to your match… Submitting deck to the room.'
                : 'Loading match…'}
          </p>
          {campaignSession && !campaignBusy && (
            <button
              onClick={() => navigate('/vault')}
              className="mt-2 px-4 py-2 rounded-lg text-xs font-bold"
              style={{ background: 'rgba(139,92,246,0.2)', color: '#A78BFA' }}
            >
              BACK TO VAULT
            </button>
          )}
          {mpSession && (!selectedDeck || selectedDeck.length === 0) && (
            <p className="max-w-md text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
              No deck found. Return to the vault and queue again with a selected deck.
            </p>
          )}
        </main>
        <Footer />
      </div>
    );
  }

  const stats = getMatchStats(match);
  const winnerInfo = match.winner ? getWinnerInfo(match) : null;
  const iWonMultiplayer = mpSession
    ? !!youAre && !!match.winner && match.winner === youAre
    : !!match.winner && match.winner === 'player1';
  const nftsWonFromOpponent =
    match.winner && iWonMultiplayer ? getNftsCapturedFromOpponent(match) : [];

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
              src={ARENA_BG}
              alt="Arena Background"
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
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center mb-12"
            >
              <p
                className="text-xs font-bold mb-2"
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  color: '#8B5CF6',
                  letterSpacing: '0.1em',
                }}
              >
                // ROYALE ARENA
              </p>
              <h1
                className="text-heading mb-4"
                style={{
                  fontSize: '3rem',
                  color: '#FFFFFF',
                }}
              >
                THE ARENA
              </h1>
              <p
                className="text-body"
                style={{
                  color: 'rgba(255, 255, 255, 0.55)',
                  fontSize: '0.875rem',
                }}
              >
                {campaignSession && campaignRun
                  ? `${campaignRun.stageLabel} · `
                  : ''}
                Round {Math.min(match.currentRound + 1, match.maxRounds)} of {match.maxRounds}
                {match.pickTurn && match.isActive
                  ? ` · ${match[match.pickTurn].name}'s turn — choose a card from your deck`
                  : ''}
              </p>
            </motion.div>

            {/* Cards played this round (alternating picks) */}
            {match.isActive && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-2"
              >
                <div className="drip-panel p-4 text-center">
                  <p
                    className="mb-3 text-xs font-bold"
                    style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#A78BFA' }}
                  >
                    {match.player1.name} — this round
                  </p>
                  {match.picksThisRound.player1 ? (
                    <div className="mx-auto max-w-[140px] overflow-hidden rounded-lg border-2 border-violet-500/40">
                      <img
                        src={(match.picksThisRound.player1 as GameCard).imageUri}
                        alt=""
                        className="aspect-[2/3] w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div
                      className="mx-auto flex aspect-[2/3] max-w-[140px] items-center justify-center rounded-lg border border-dashed border-violet-500/30 text-xs"
                      style={{ color: 'rgba(255,255,255,0.35)' }}
                    >
                      {mpSession && youAre !== 'player1' && match.pickTurn === 'player1'
                        ? 'Opponent is choosing…'
                        : 'Waiting…'}
                    </div>
                  )}
                </div>
                <div className="drip-panel p-4 text-center">
                  <p
                    className="mb-3 text-xs font-bold"
                    style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#F59E0B' }}
                  >
                    {match.player2.name} — this round
                  </p>
                  {match.picksThisRound.player2 ? (
                    <div className="mx-auto max-w-[140px] overflow-hidden rounded-lg border-2 border-amber-500/40">
                      <img
                        src={(match.picksThisRound.player2 as GameCard).imageUri}
                        alt=""
                        className="aspect-[2/3] w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div
                      className="mx-auto flex aspect-[2/3] max-w-[140px] items-center justify-center rounded-lg border border-dashed border-amber-500/30 text-xs"
                      style={{ color: 'rgba(255,255,255,0.35)' }}
                    >
                      {campaignSession
                        ? 'Campaign AI is choosing…'
                        : isDummyMode && match.pickTurn === 'player2'
                        ? 'Opponent is choosing…'
                        : mpSession && youAre !== 'player2' && match.pickTurn === 'player2'
                          ? 'Opponent is choosing…'
                          : 'Waiting…'}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Players Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
              {/* Player 1 */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
                className="drip-panel p-8"
              >
                <p
                  className="text-sm font-bold mb-4"
                  style={{
                    fontFamily: "'Syne', sans-serif",
                    color: '#8B5CF6',
                  }}
                >
                  {stats.player1.name}
                </p>

                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center">
                    <p
                      className="text-xs"
                      style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        color: 'rgba(255, 255, 255, 0.4)',
                      }}
                    >
                      DECK
                    </p>
                    <p
                      className="text-2xl font-bold"
                      style={{
                        fontFamily: "'Syne', sans-serif",
                        color: '#8B5CF6',
                      }}
                    >
                      {stats.player1.cardsRemaining}
                    </p>
                  </div>
                  <div className="text-center">
                    <p
                      className="text-xs"
                      style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        color: 'rgba(255, 255, 255, 0.4)',
                      }}
                    >
                      WON
                    </p>
                    <p
                      className="text-2xl font-bold"
                      style={{
                        fontFamily: "'Syne', sans-serif",
                        color: '#10B981',
                      }}
                    >
                      {stats.player1.cardsWon}
                    </p>
                  </div>
                  <div className="text-center">
                    <p
                      className="text-xs"
                      style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        color: 'rgba(255, 255, 255, 0.4)',
                      }}
                    >
                      TOTAL
                    </p>
                    <p
                      className="text-2xl font-bold"
                      style={{
                        fontFamily: "'Syne', sans-serif",
                        color: '#F59E0B',
                      }}
                    >
                      {stats.player1.totalCards}
                    </p>
                  </div>
                </div>

                {/* Player 1 Card Display */}
                {lastFlippedCards && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                    className="relative rounded-lg overflow-hidden"
                    style={{
                      border: '2px solid rgba(139, 92, 246, 0.3)',
                      background: 'rgba(0, 0, 0, 0.3)',
                    }}
                  >
                    <div className="relative w-full aspect-[2/3] overflow-hidden">
                      <img
                        src={(lastFlippedCards.player1 as any).image || (lastFlippedCards.player1 as any).imageUri}
                        alt={(lastFlippedCards.player1 as any).name}
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
                        className="text-xs font-bold mb-2"
                        style={{
                          fontFamily: "'Syne', sans-serif",
                          color: '#FFFFFF',
                        }}
                      >
                        {(lastFlippedCards.player1 as any).name}
                      </p>
                      <span
                        className="text-xs font-bold px-2 py-1 rounded inline-block"
                        style={{
                          fontFamily: "'IBM Plex Mono', monospace",
                          background: '#8B5CF6',
                          color: '#FFFFFF',
                        }}
                      >
                        ⚡ {(lastFlippedCards.player1 as any).power}
                      </span>
                    </div>
                  </motion.div>
                )}

                {match.isActive && match.player1.deck.length > 0 && (
                  <div className="mt-6">
                    <p
                      className="mb-3 text-xs font-bold"
                      style={{ fontFamily: "'IBM Plex Mono', monospace", color: 'rgba(255,255,255,0.45)' }}
                    >
                      {mpSession && youAre !== 'player1'
                        ? 'OPPONENT DECK (HIDDEN)'
                        : 'YOUR DECK — TAP A CARD WHEN IT’S YOUR TURN'}
                    </p>
                    <div className="flex max-h-52 flex-wrap gap-2 overflow-y-auto pr-1">
                      {match.player1.deck.map((card) => {
                        if (mpSession && youAre !== 'player1') {
                          return (
                            <div
                              key={card.assetId}
                              className="relative h-[5.625rem] w-[4.5rem] shrink-0 overflow-hidden rounded-md border-2 border-violet-500/25"
                              style={{
                                background:
                                  'linear-gradient(145deg, rgba(49, 46, 129, 0.5), rgba(7, 6, 15, 0.95))',
                              }}
                            />
                          );
                        }
                        const canPick =
                          match.pickTurn === 'player1' &&
                          !match.picksThisRound.player1 &&
                          (!mpSession || youAre === 'player1') &&
                          !campaignBusy;
                        return (
                          <motion.button
                            key={card.assetId}
                            type="button"
                            disabled={!canPick}
                            whileHover={canPick ? { scale: 1.04 } : undefined}
                            whileTap={canPick ? { scale: 0.96 } : undefined}
                            onClick={() => handlePickCard('player1', card.assetId)}
                            className="relative w-[4.5rem] shrink-0 overflow-hidden rounded-md"
                            style={{
                              border: `2px solid ${canPick ? '#8B5CF6' : 'rgba(139, 92, 246, 0.25)'}`,
                              opacity: canPick ? 1 : 0.55,
                              cursor: canPick ? 'pointer' : 'not-allowed',
                            }}
                          >
                            <img
                              src={card.imageUri}
                              alt=""
                              className="aspect-[2/3] w-full object-cover"
                            />
                            <span
                              className="absolute bottom-0.5 right-0.5 rounded px-1 text-[10px] font-bold"
                              style={{
                                fontFamily: "'IBM Plex Mono', monospace",
                                background: 'rgba(0,0,0,0.75)',
                                color: '#fff',
                              }}
                            >
                              {card.power}
                            </span>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </motion.div>

              {/* Player 2 (Opponent) */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
                className="drip-panel p-8"
              >
                <p
                  className="text-sm font-bold mb-4"
                  style={{
                    fontFamily: "'Syne', sans-serif",
                    color: '#F59E0B',
                  }}
                >
                  {stats.player2.name}
                </p>

                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center">
                    <p
                      className="text-xs"
                      style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        color: 'rgba(255, 255, 255, 0.4)',
                      }}
                    >
                      DECK
                    </p>
                    <p
                      className="text-2xl font-bold"
                      style={{
                        fontFamily: "'Syne', sans-serif",
                        color: '#F59E0B',
                      }}
                    >
                      {stats.player2.cardsRemaining}
                    </p>
                  </div>
                  <div className="text-center">
                    <p
                      className="text-xs"
                      style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        color: 'rgba(255, 255, 255, 0.4)',
                      }}
                    >
                      WON
                    </p>
                    <p
                      className="text-2xl font-bold"
                      style={{
                        fontFamily: "'Syne', sans-serif",
                        color: '#10B981',
                      }}
                    >
                      {stats.player2.cardsWon}
                    </p>
                  </div>
                  <div className="text-center">
                    <p
                      className="text-xs"
                      style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        color: 'rgba(255, 255, 255, 0.4)',
                      }}
                    >
                      TOTAL
                    </p>
                    <p
                      className="text-2xl font-bold"
                      style={{
                        fontFamily: "'Syne', sans-serif",
                        color: '#F59E0B',
                      }}
                    >
                      {stats.player2.totalCards}
                    </p>
                  </div>
                </div>

                {/* Player 2 Card Display */}
                {lastFlippedCards && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                    className="relative rounded-lg overflow-hidden"
                    style={{
                      border: '2px solid rgba(245, 158, 11, 0.3)',
                      background: 'rgba(0, 0, 0, 0.3)',
                    }}
                  >
                    <div className="relative w-full aspect-[2/3] overflow-hidden">
                      <img
                        src={(lastFlippedCards.player2 as any).image || (lastFlippedCards.player2 as any).imageUri}
                        alt={(lastFlippedCards.player2 as any).name}
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
                        className="text-xs font-bold mb-2"
                        style={{
                          fontFamily: "'Syne', sans-serif",
                          color: '#FFFFFF',
                        }}
                      >
                        {(lastFlippedCards.player2 as any).name}
                      </p>
                      <span
                        className="text-xs font-bold px-2 py-1 rounded inline-block"
                        style={{
                          fontFamily: "'IBM Plex Mono', monospace",
                          background: '#F59E0B',
                          color: '#FFFFFF',
                        }}
                      >
                        ⚡ {(lastFlippedCards.player2 as any).power}
                      </span>
                    </div>
                  </motion.div>
                )}

                {match.isActive && match.player2.deck.length > 0 && (
                  <div className="mt-6">
                    <p
                      className="mb-3 text-xs font-bold"
                      style={{ fontFamily: "'IBM Plex Mono', monospace", color: 'rgba(255,255,255,0.45)' }}
                    >
                      {isDummyMode || (mpSession && youAre !== 'player2')
                        ? 'OPPONENT DECK (HIDDEN)'
                        : 'YOUR DECK — TAP A CARD WHEN IT’S YOUR TURN'}
                    </p>
                    <div className="flex max-h-52 flex-wrap gap-2 overflow-y-auto pr-1">
                      {match.player2.deck.map((card) => {
                        if (campaignSession || isDummyMode || (mpSession && youAre !== 'player2')) {
                          return (
                            <div
                              key={card.assetId}
                              className="relative h-[5.625rem] w-[4.5rem] shrink-0 overflow-hidden rounded-md border-2 border-amber-500/25"
                              style={{
                                background:
                                  'linear-gradient(145deg, rgba(49, 46, 129, 0.5), rgba(7, 6, 15, 0.95))',
                              }}
                            />
                          );
                        }
                        const canPick =
                          match.pickTurn === 'player2' &&
                          !match.picksThisRound.player2 &&
                          (!mpSession || youAre === 'player2');
                        return (
                          <motion.button
                            key={card.assetId}
                            type="button"
                            disabled={!canPick}
                            whileHover={canPick ? { scale: 1.04 } : undefined}
                            whileTap={canPick ? { scale: 0.96 } : undefined}
                            onClick={() => handlePickCard('player2', card.assetId)}
                            className="relative w-[4.5rem] shrink-0 overflow-hidden rounded-md"
                            style={{
                              border: `2px solid ${canPick ? '#F59E0B' : 'rgba(245, 158, 11, 0.25)'}`,
                              opacity: canPick ? 1 : 0.55,
                              cursor: canPick ? 'pointer' : 'not-allowed',
                            }}
                          >
                            <img
                              src={card.imageUri}
                              alt=""
                              className="aspect-[2/3] w-full object-cover"
                            />
                            <span
                              className="absolute bottom-0.5 right-0.5 rounded px-1 text-[10px] font-bold"
                              style={{
                                fontFamily: "'IBM Plex Mono', monospace",
                                background: 'rgba(0,0,0,0.75)',
                                color: '#fff',
                              }}
                            >
                              {card.power}
                            </span>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </motion.div>
            </div>

            {/* Match Settlement Modal */}
            {winnerInfo && showSettlement && (
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
                        color: iWonMultiplayer ? '#10B981' : '#EF4444',
                        letterSpacing: '0.1em',
                      }}
                    >
                      // MATCH COMPLETE
                    </p>
                    <h2
                      className="text-4xl font-bold mb-4"
                      style={{
                        fontFamily: "'Syne', sans-serif",
                        color: iWonMultiplayer ? '#10B981' : '#EF4444',
                      }}
                    >
                      {iWonMultiplayer ? 'VICTORY!' : 'DEFEAT'}
                    </h2>
                    <p
                      className="text-lg"
                      style={{
                        fontFamily: "'Outfit', sans-serif",
                        color: 'rgba(255, 255, 255, 0.7)',
                      }}
                    >
                      {iWonMultiplayer
                        ? `You defeated ${winnerInfo.loser.name}`
                        : `${winnerInfo.winner.name} won this match`}
                    </p>
                    <p
                      className="text-sm mt-2"
                      style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        color: 'rgba(255, 255, 255, 0.4)',
                      }}
                    >
                      Match Duration: {match.currentRound} rounds
                      {!mpSession && ` | Difficulty: ${aiStrategy.getDifficultyLabel()}`}
                    </p>
                  </motion.div>

                  {iWonMultiplayer && (
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
                      NFTs won from opponent ({nftsWonFromOpponent.length})
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                      {nftsWonFromOpponent.map((nft, index) => (
                        <motion.div
                          key={nft.assetId || index}
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
                              src={nft.imageUri}
                              alt={nft.name ?? 'NFT'}
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
                  </motion.div>
                  )}

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
                      onClick={handlePlayAgain}
                      className="flex-1 px-6 py-3 font-bold text-sm rounded-lg"
                      style={{
                        fontFamily: "'Syne', sans-serif",
                        background: 'linear-gradient(135deg, #10B981, #34D399)',
                        color: '#FFFFFF',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {campaignSession && campaignRun?.status === 'stage_won' ? 'NEXT STAGE' : 'PLAY AGAIN'}
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleReturnHome}
                      className="flex-1 px-6 py-3 font-bold text-sm rounded-lg"
                      style={{
                        fontFamily: "'Syne', sans-serif",
                        background: 'rgba(139, 92, 246, 0.1)',
                        color: '#8B5CF6',
                        border: '2px solid rgba(139, 92, 246, 0.3)',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {campaignSession ? 'RETURN TO CAMPAIGNS' : 'HOME'}
                    </motion.button>
                  </motion.div>
                </motion.div>
              </motion.div>
            )}
          </div>
        </motion.section>
      </main>
      <Footer />
    </div>
  );
}
