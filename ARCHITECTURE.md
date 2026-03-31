# DRiP Royale - Architecture & Functioning

This document explains how DRiP Royale works, its architecture, data flow, and key components.

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    DRiP Royale Frontend                      │
│                   (React + TypeScript)                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Pages      │  │  Components  │  │    Hooks     │       │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤       │
│  │ Home         │  │ TopBar       │  │ useGameState │       │
│  │ VaultPage    │  │ Hero         │  │ useMatchmak. │       │
│  │ ArenaPage    │  │ Vault        │  │ useHeliusAss.│       │
│  │ ProfilePage  │  │ Arena        │  │ useLocalStor.│       │
│  │ Leaderboard  │  │ Profile      │  │              │       │
│  │ LedgerPage   │  │ Achievements │  │              │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Game Logic & Utilities                  │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │ warEngine.ts | aiStrategy.ts | localMatchEngine.ts  │   │
│  │ helius.ts | websocket.ts | cardData.ts              │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         State Management & Contexts                 │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │ DeckContext | DummyDeckContext | ThemeContext        │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
    ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
    │ localStorage│   │ Helius API  │   │ WebSocket   │
    │  (Browser)  │   │ (Solana)    │   │ (Future)    │
    └─────────────┘   └─────────────┘   └─────────────┘
```

## 🎮 Game Flow

### 1. User Journey

```
Home Page
    ↓
Select "THE VAULT"
    ↓
Choose Demo Deck OR Connect Wallet
    ├─ Demo Mode: Select 5 demo cards
    └─ Wallet Mode: Load real NFTs from Helius
    ↓
Select "THE ARENA"
    ↓
Choose Difficulty (Easy/Medium/Hard)
    ↓
Play Match (Flip Cards Round by Round)
    ↓
Match Settlement (Victory/Defeat)
    ├─ Add to Ledger
    └─ Unlock Achievements
    ↓
Return to Home or Play Again
```

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

**Props**:
```typescript
interface DifficultySelectorProps {
  selectedDifficulty: AIDifficulty;
  onSelectDifficulty: (difficulty: AIDifficulty) => void;
  onStart: () => void;
  onBack?: () => void;
}
```

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

### 3. Local Match Engine

**Location**: `client/src/lib/localMatchEngine.ts`

**Purpose**: Simulate card battles locally without server

**Functions**:
- `initializeLocalMatch()`: Create new match
- `playRound()`: Execute one round
- `getMatchStats()`: Get current stats
- `getWinnerInfo()`: Get match result

**Flow**:
```typescript
// Initialize
const match = initializeLocalMatch(playerDeck, opponentDeck, 'You', 'Opponent');

// Play rounds
while (match.isActive) {
  const updatedMatch = playRound(match);
  // Update UI with results
}

// Get winner
const winnerInfo = getWinnerInfo(match);
```

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
User selects 5-52 cards
    ↓
Store selection in DummyDeckContext
    ↓
Navigate to Arena Page
```

### 2. Arena Page Flow

```
User enters Arena Page
    ↓
Show DifficultySelector modal
    ↓
User selects difficulty
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

## 🔮 Future Enhancements

### Phase 1: Backend Integration
- [ ] Node.js/Express server
- [ ] WebSocket for real-time matchmaking
- [ ] Database for persistent data

### Phase 2: Smart Contracts
- [ ] Solana Anchor program
- [ ] On-chain settlement
- [ ] NFT transfer logic

### Phase 3: Multiplayer
- [ ] Real opponent matching
- [ ] Live match synchronization
- [ ] Global leaderboard

### Phase 4: Advanced Features
- [ ] Seasonal rankings
- [ ] Tournaments
- [ ] Streaming integration
- [ ] Mobile app

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

### Check localStorage

```javascript
// In browser console
localStorage.getItem('userProfile')
localStorage.getItem('ledger')
localStorage.getItem('achievements')
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

**Last Updated**: March 29, 2026
**Version**: 1.0.0
