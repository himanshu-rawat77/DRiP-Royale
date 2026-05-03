# DRiP Royale - Architecture & Functioning

This document explains how DRiP Royale works, its architecture, data flow, and key components—including **Campaign mode** (solo PvE runs, creator campaigns, and optional on-chain intents).

## 🏗️ System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                     DRiP Royale Client (Vite + React)                │
├──────────────────────────────────────────────────────────────────────┤
│  Pages: Home, Vault, Arena, Profile, Ledger, Leaderboard, Docs        │
│         Matchmaking (/matchmaking) · Campaigns (/campaigns)           │
│         Creator dashboard (/creator)                                   │
│  Lib: shared match engine client, Helius assets, soloCampaignClient,  │
│       onchainCampaignTx (memo intents), websocket, campaignSession     │
│  Contexts: Deck, DummyDeck, Phantom wallet, Theme                      │
└──────────────────────────────────────────────────────────────────────┘
         │ REST /api/*              │ Helius RPC           │ /ws/matchmaking
         ▼                          ▼                      ▼
┌─────────────────────┐    ┌─────────────────┐    ┌─────────────────────┐
│ Express + HTTP      │    │ Solana (NFTs,   │    │ Matchmaking WS      │
│ server/index.ts     │    │  txs via wallet)│    │ matchmaking-ws.ts   │
├─────────────────────┤    └─────────────────┘    └─────────────────────┘
│ /api/escrow         │
│ /api/tokenomics     │
│ /api/campaigns      │
│ /api/users          │
└──────────┬──────────┘
           ▼
    ┌──────────────┐     Static: dist/public (SPA) in production
    │ PostgreSQL   │     Requires DATABASE_URL at server start
    │ db-schema.sql│
    └──────────────┘
```

**Browser storage**: `localStorage` (profile, ledger, achievements) and `sessionStorage` (active campaign session, multiplayer session). Campaign mode also syncs runs and balances with the server.

## 🎮 Game Flow

### 1. User Journey (Arena / Vault — classic flow)

```
Home Page
    ↓
Select "THE VAULT"
    ↓
Choose Demo Deck OR Connect Wallet
    ├─ Demo Mode: Select 5 demo cards
    └─ Wallet Mode: Load real NFTs from Helius
    ↓
Select "THE ARENA" or Matchmaking
    ↓
Choose Difficulty (Easy/Medium/Hard) [Arena AI] or human opponent [matchmaking]
    ↓
Play Match (Flip Cards Round by Round)
    ↓
Match Settlement (Victory/Defeat)
    ├─ Add to Ledger
    └─ Unlock Achievements
    ↓
Return to Home or Play Again
```

### 1b. Campaign mode journey (solo PvE)

Campaigns are **staged runs**: four stages per run (`Match 1`, `Match 2`, `Match 3`, `Boss`). Each stage is a full flip battle using the shared `matchEngine`; the server generates a scaled opponent deck from the player’s deck, difficulty, and stage index.

```
/campaigns (SoloCampaignPage)
    ↓
Connect wallet · pick campaign · set difficulty (normal / hard / nightmare)
    ↓
Commit entry (ROYALE spend + optional on-chain memo tx if enabled)
    → session: campaignSession (campaignId, difficulty, entryId)
    ↓
/vault — campaign mode ON (demo deck only for MVP fairness)
    Build 2–52 cards, then continue
    ↓
/arena — startCampaignRun → server creates campaign_runs row + LocalMatch
    ↓
Per round: pickCampaignCard (server submitPick + AI resolves picks)
    ↓
stage_won → continueCampaignRun (next stage) | lost | completed
    ↓
Rewards: ROYALE + optional cNFT stage rewards (server mint path) + optional finalize/claim intents
    ↓
clearCampaignSession or return to /campaigns
```

**Key files**

| Layer | Path | Role |
|--------|------|------|
| UI — list & pay | `client/src/pages/SoloCampaignPage.tsx` | Lists campaigns, entry preview, pays entry, writes `campaignSession` |
| UI — play | `client/src/pages/ArenaPage.tsx` | Starts/continues run, picks cards, on-chain finalize/claim when enabled |
| Session | `client/src/lib/campaignSession.ts` | `sessionStorage` bridge Vault ↔ Arena |
| API client | `client/src/lib/soloCampaignClient.ts` | REST to `/api/campaigns/*` |
| On-chain helper | `client/src/lib/onchainCampaignTx.ts` | Builds Phantom-signed tx: tiny SOL transfer + Memo with JSON intent |
| Server router | `server/solo-campaign-routes.ts` | Campaigns, entries, runs, progress, rewards |
| Tokenomics | `server/tokenomics-store.ts` + `/api/tokenomics` | ROYALE balance, challenge tickets, splits |
| On-chain scaffolding | `server/onchain-campaign.ts` | PDAs, commitment hash, `ChainIntent` payloads |
| DB | `server/db-schema.sql` | `campaign_*`, `creator_campaigns`, `token_wallets`, etc. |
| Creator UI | `client/src/pages/CreatorDashboardPage.tsx` + `client/src/lib/usersClient.ts` | Draft/publish campaigns, collections, stage reward metadata |

**Campaign catalog**: Published rows from `creator_campaigns` are merged with a small in-code seed list (`mvp-training`, `neon-citadel`, `void-gallery`) in `listAllCampaigns()`.

**Entry economics**: Paid entries split ROYALE **50% creator / 35% reward pool / 15% protocol** (`ENTRY_SPLIT` in `solo-campaign-routes.ts`). Free or ticket-based paths exist where configured.

### 1c. What campaign mode is for (product direction)

| Today (implemented) | Where we’re going |
|----------------------|-------------------|
| Server-authoritative staged runs, persisted in Postgres | Same model, hardened anti-abuse and rate limits |
| In-app **ROYALE** + challenge tickets | Deeper economy ties to seasons and matchmaking |
| Creator-published campaigns + earnings tracking | Richer creator analytics and payout flows |
| Stage reward definitions + cNFT mint integration | Broader reward types and secondary-market-friendly metadata |
| **Memo-based “intents”** (publish, pay entry, finalize run, claim) for wallets | Replace with a **real Solana program** (Anchor) so PDAs vaults and settlement are enforced on-chain |
| Run **commitment hash** (deck + run metadata) | Auditable verification against finalized outcomes |

When `ONCHAIN_CAMPAIGNS_ENABLED=true` and a real `CAMPAIGN_PROGRAM_ID` is set, the same intent shape is intended to map to program instructions; until then, memos anchor intent in the user’s transaction history for integration testing.

### 2. Match Flow

```
Initialize Match
├─ Player Deck: 5-52 cards
├─ Opponent Deck: Same cards (shuffled)
└─ AI Strategy: Based on selected difficulty

Round Loop:
├─ Player selects card (or auto-selected in demo)
├─ AI selects card using strategy
├─ Compare power levels
├─ Winner takes both cards
├─ Animate card flip with particles
└─ Play sound effect

Match End:
├─ One player has 0 cards remaining
├─ Calculate winner
├─ Create settlement modal
├─ Add ledger entry
└─ Unlock achievements
```

## 📊 Data Structures

### GameCard

```typescript
interface GameCard {
  assetId: string;           // Unique identifier
  imageUri: string;          // Card image URL
  name: string;              // Card name
  power: number;             // Card power level (1-20)
  rarity?: 'common' | 'rare' | 'epic' | 'legendary';
}
```

### LocalMatch

```typescript
interface LocalMatch {
  id: string;
  player1: {
    name: string;
    hand: GameCard[];
    cardsWon: GameCard[];
  };
  player2: {
    name: string;
    hand: GameCard[];
    cardsWon: GameCard[];
  };
  currentRound: number;
  maxRounds: number;
  isActive: boolean;
  winner: 'player1' | 'player2' | null;
  roundResults: RoundResult[];
}
```

### UserProfile

```typescript
interface UserProfile {
  walletAddress: string;
  username: string;
  bio: string;
  profileImage: string;
  totalWins: number;
  totalLosses: number;
  totalEarnings: number;
  achievements: Achievement[];
  nfts: GameCard[];
}
```

## 🎯 Key Components

### 1. DifficultySelector Component

**Location**: `client/src/components/DifficultySelector.tsx`

**Purpose**: Allow users to choose AI opponent difficulty before match

**Features**:
- Three difficulty options (Easy/Medium/Hard)
- Color-coded UI (Green/Gold/Red)
- Shows opponent name and strategy description
- Back button to return to Vault
- Start Match and Reset buttons



### 2. AI Strategy Engine

**Location**: `client/src/lib/aiStrategy.ts`

**Purpose**: Implement different AI opponent strategies

**Strategies**:

| Difficulty | Strategy | Card Selection |
|------------|----------|-----------------|
| Easy | Random with mistakes | 70% random, 30% weakest |
| Medium | Balanced tactical | 40% match strength, 30% stronger, 30% random |
| Hard | Advanced analysis | Analyzes game state, conserves strong cards |

**Usage**:
```typescript
const aiStrategy = createAIStrategy('hard');
const selectedCard = aiStrategy.selectCard(gameState);
```

### 3. Match engine (shared + client wrapper)

**Canonical logic**: `shared/matchEngine` — used by the **Express campaign router** (`initializeLocalMatch`, `submitPick`, etc.) and re-exported from the client.

**Client wrapper**: `client/src/lib/localMatchEngine.ts` — classic Arena AI flow (`playRound`, `getWinnerInfo`, …) on top of the same types.

**Campaign runs** never simulate full rounds only in the browser: the server holds the authoritative `LocalMatch` JSON in `campaign_runs.match_json` and advances it when the player calls `pickCampaignCard`.

### 4. Helius API Integration

**Location**: `client/src/lib/helius.ts`

**Purpose**: Fetch user's NFT collection from Solana

**Functions**:
```typescript
// Get NFTs for a wallet address
const assets = await getAssetsByOwner(walletAddress);

// Returns array of GameCard objects
```

**API Endpoint**: `https://mainnet.helius-rpc.com/`

**Authentication**: Via `VITE_HELIUS_API_KEY` environment variable

### 5. State Management

**Contexts**:

| Context | Purpose | State |
|---------|---------|-------|
| DeckContext | Active deck management | selectedCards, matchState |
| DummyDeckContext | Demo deck mode | selectedDummyCards, isDemoMode |
| ThemeContext | Dark/light theme | theme, toggleTheme |

**localStorage**:
- `userProfile`: User profile data
- `walletAddress`: Connected wallet
- `ledger`: Match history
- `achievements`: Unlocked achievements

**sessionStorage**:
- `drip-campaign-session`: Active campaign id, difficulty, `entryId`, `runId` (see `campaignSession.ts`)
- `drip-multiplayer`: Cleared when entering a campaign from Solo Campaign page

## 🔄 Data Flow

### 1. Vault Page Flow

```
User enters Vault Page
    ↓
Check localStorage for wallet
    ├─ If wallet exists: Load NFTs from Helius
    └─ If no wallet: Show "Connect Wallet" or "Demo Deck" options
    ↓
Display available cards
    ↓
User selects 5-52 cards (wallet deck) or demo cards
    ↓
If campaign session active: demo-only deck, label "Campaign mode"
    ↓
Store selection in DummyDeckContext
    ↓
Navigate to Arena or Matchmaking (campaign → Arena)
```

### 2. Arena Page Flow

```
User enters Arena Page
    ↓
If `campaignSession`: skip classic difficulty modal; start or resume `startCampaignRun` / picks
    Else: Show DifficultySelector modal
    ↓
User selects difficulty (non-campaign)
    ↓
Initialize match with AI strategy
    ↓
Loop: User clicks "FLIP CARDS"
    ├─ Get player card (from selection or auto)
    ├─ AI selects card using strategy
    ├─ Compare power levels
    ├─ Animate winner with particles
    ├─ Play sound effect
    └─ Update match state
    ↓
Match ends (one player has 0 cards)
    ↓
Show settlement modal
    ├─ Display won NFTs
    ├─ Add ledger entry
    └─ Unlock achievements
    ↓
User clicks "Play Again" or "Home"
```

### 3. Profile Page Flow

```
User enters Profile Page
    ↓
Load profile from localStorage
    ↓
Display sections:
    ├─ Wallet Connection
    ├─ Profile Info (editable)
    ├─ Achievements (with progress)
    ├─ Leaderboard Preview (compressed)
    ├─ Ledger Preview (compressed)
    └─ NFT Collection (from Helius)
    ↓
User can:
    ├─ Edit profile info
    ├─ Connect/disconnect wallet
    ├─ Load NFTs from Helius
    ├─ View full leaderboard
    └─ View full ledger
```

## 🎨 Animation & Effects

### Card Flip Animation

```typescript
// Framer Motion animation
<motion.div
  animate={{ rotateY: 180 }}
  transition={{ duration: 0.6 }}
>
  {/* Card content */}
</motion.div>
```

### Particle Effects

**Location**: `client/src/components/ParticleEffect.tsx`

**Types**:
- Card flip particles (12 particles)
- Glow effects (radial burst)
- Royale War particles (20 particles, red/purple)

**Physics**:
- Gravity: 0.1
- Velocity: Random direction
- Decay: Fade over time

### Sound Effects

**Location**: `client/src/components/ParticleEffect.tsx`

**Sounds**:
- `card-flip-sound.wav`: Card flip
- `card-reveal-sound.wav`: Card reveal
- `royale-war-sound.wav`: Royale War trigger

## 🔐 localStorage Schema

### User Profile

```json
{
  "userProfile": {
    "walletAddress": "...",
    "username": "...",
    "bio": "...",
    "profileImage": "...",
    "totalWins": 0,
    "totalLosses": 0,
    "totalEarnings": 0
  }
}
```

### Ledger (Match History)

```json
{
  "ledger": [
    {
      "id": "match-1234567890",
      "opponent": "Veteran AI",
      "result": "WIN",
      "date": "2026-03-29 12:30:45",
      "reward": "+50 SOL",
      "nftsWon": ["card-1", "card-2"]
    }
  ]
}
```

### Achievements

```json
{
  "achievements": [
    {
      "id": "first-blood",
      "name": "First Blood",
      "description": "Win your first match",
      "unlockedAt": "2026-03-29T12:30:45Z",
      "rarity": "common"
    }
  ]
}
```

## 🚀 Performance Optimizations

1. **Code Splitting**: Routes lazy-loaded with React.lazy()
2. **Image Optimization**: CDN-hosted images with proper sizing
3. **Animation Performance**: GPU-accelerated transforms with Framer Motion
4. **State Management**: Minimal re-renders with React Context
5. **API Caching**: localStorage for user data and NFT collections

## 🔮 Roadmap (current vs next)

**Shipped in this repo**

- Express API: escrow, tokenomics, campaigns, users; static SPA in production.
- PostgreSQL schema for wallets, campaigns, runs, creator content, chain-attestation tables.
- WebSocket matchmaking server (`/ws/matchmaking`).
- Campaign mode: staged PvE, ROYALE entry splits, creator dashboard, stage reward metadata + mint pipeline (see `server/campaign-reward-mint.ts`).
- Optional memo-based on-chain intents for publish / entry / finalize / claim (`ONCHAIN_CAMPAIGNS_ENABLED`).

**Next**

- **Anchor program** replacing memo-only intents: vault PDAs, enforced entry and reward settlement.
- **Multiplayer**: deepen escrow + WS sync; global leaderboard from persisted `match_history`.
- **Campaign**: wallet-NFT deck support when fairness model is defined; stronger verification of commitments vs outcomes.
- **Product**: seasons, tournaments, mobile polish.

## 📝 Development Guidelines

### Adding New Features

1. **Create new component** in `client/src/components/`
2. **Add types** to `client/src/lib/types.ts`
3. **Create hooks** if needed in `client/src/hooks/`
4. **Update routing** in `client/src/App.tsx`
5. **Add tests** for logic functions
6. **Update documentation**

### Code Style

- Use TypeScript for type safety
- Follow Tailwind CSS for styling
- Use Framer Motion for animations
- Keep components small and focused
- Document complex logic with comments

### Testing

```bash
# Run type checking
pnpm check

# Format code
pnpm format

# Build for production
pnpm build
```

## 🐛 Debugging

### Enable Debug Logging

```typescript
// In any component
console.log('Debug:', data);

// Check browser console (F12)
```

### Check localStorage / sessionStorage

```javascript
// In browser console
localStorage.getItem('userProfile')
localStorage.getItem('ledger')
localStorage.getItem('achievements')
sessionStorage.getItem('drip-campaign-session')
```

### Monitor Network

- Open DevTools (F12)
- Go to Network tab
- Check Helius API calls
- Verify response data

## 📚 References

- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Framer Motion](https://www.framer.com/motion/)
- [Helius API Docs](https://docs.helius.dev)
- [Solana Documentation](https://docs.solana.com)

---

**Last Updated**: May 2, 2026  
**Version**: 1.1.0 (backend + campaign mode documented)
