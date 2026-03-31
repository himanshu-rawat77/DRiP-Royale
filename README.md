# DRiP Royale - Stake Art. Win War.

A professional Solana-based NFT card game platform built with React, TypeScript, and Tailwind CSS. Play card battles, stake your NFTs, and compete for glory in the Royale War.

## 📋 Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Project](#running-the-project)
- [Project Structure](#project-structure)
- [API Integration](#api-integration)
- [Environment Variables](#environment-variables)

## ✨ Features

- **The Vault**: Build and manage your NFT deck (5-52 cards)
- **The Arena**: Play card battles against AI opponents with three difficulty levels
- **The Profile**: Manage your wallet, view NFTs, track achievements, and check match history
- **AI Opponents**: Easy (Rookie), Medium (Veteran), Hard (Legend) difficulty levels
- **Achievement System**: Unlock badges for milestones and achievements
- **Local Match Engine**: Play matches without wallet connection using demo mode
- **Match Settlement**: Automatic NFT transfer and ledger tracking
- **localStorage Persistence**: Maintain wallet and profile data across sessions

## 🔧 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **pnpm** (v10 or higher) - Package manager
- **Git** - Version control

## 📦 Installation

### 1. Clone the Repository

```bash
gh repo clone himanshu-rawat77/DRiP_Royale
cd drip-royale-web
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Install Additional Packages (if needed)

```bash
pnpm add framer-motion axios wouter zod react-hook-form
```

## ⚙️ Configuration

### Environment Variables

Create a `.env.local` file in the project root with the following variables:

```env
# Helius API Configuration (Required for NFT loading)
VITE_HELIUS_API_KEY=your_helius_api_key_here
VITE_HELIUS_API_URL=https://mainnet.helius-rpc.com

# Solana Configuration (Optional - for future wallet integration)
VITE_SOLANA_NETWORK=mainnet-beta
VITE_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Application Configuration
VITE_APP_NAME=DRiP Royale
VITE_APP_VERSION=1.0.0
```

### Helius API Setup

1. **Get Helius API Key**:
   - Visit [helius.dev](https://helius.dev)
   - Sign up for a free account
   - Create a new API key in your dashboard
   - Copy the API key

2. **Add to Environment**:
   - Open `.env.local`
   - Add: `VITE_HELIUS_API_KEY=your_key_here`

### Optional: Wallet Integration (Future)

For Solana wallet connection, you'll need:

- **Phantom Wallet**: Install the browser extension
- **Magic Link**: For email-based authentication (optional)
- **Anchor Framework**: For smart contract interactions (future)

## 🚀 Running the Project

### Development Server

```bash
pnpm dev
```

The application will start at `http://localhost:3000`

### Build for Production

```bash
pnpm build
```

### Preview Production Build

```bash
pnpm preview
```

### Type Checking

```bash
pnpm check
```

### Format Code

```bash
pnpm format
```

## 📁 Project Structure

```
drip-royale-web/
├── client/
│   ├── public/              # Static assets (favicon, robots.txt)
│   ├── src/
│   │   ├── components/      # Reusable React components
│   │   │   ├── TopBar.tsx
│   │   │   ├── Hero.tsx
│   │   │   ├── Vault.tsx
│   │   │   ├── Arena.tsx
│   │   │   ├── DifficultySelector.tsx
│   │   │   ├── AchievementBadges.tsx
│   │   │   └── ...
│   │   ├── pages/           # Page components
│   │   │   ├── Home.tsx
│   │   │   ├── VaultPage.tsx
│   │   │   ├── ArenaPage.tsx
│   │   │   ├── ProfilePage.tsx
│   │   │   ├── LeaderboardPage.tsx
│   │   │   └── LedgerPage.tsx
│   │   ├── lib/             # Utility functions and logic
│   │   │   ├── types.ts     # TypeScript type definitions
│   │   │   ├── warEngine.ts # Game mechanics
│   │   │   ├── aiStrategy.ts # AI opponent logic
│   │   │   ├── helius.ts    # Helius API integration
│   │   │   ├── localMatchEngine.ts # Local match simulation
│   │   │   ├── cardData.ts  # Card data constants
│   │   │   └── websocket.ts # WebSocket utilities
│   │   ├── hooks/           # React custom hooks
│   │   │   ├── useGameState.ts
│   │   │   ├── useMatchmaking.ts
│   │   │   ├── useHeliusAssets.ts
│   │   │   └── useLocalStorage.ts
│   │   ├── contexts/        # React contexts
│   │   │   ├── DeckContext.tsx
│   │   │   └── DummyDeckContext.tsx
│   │   ├── App.tsx          # Main app component with routing
│   │   ├── main.tsx         # React entry point
│   │   └── index.css        # Global styles and design tokens
│   └── index.html           # HTML template
├── server/                  # Backend server (Express)
├── package.json             # Dependencies and scripts
├── tsconfig.json            # TypeScript configuration
├── tailwind.config.js       # Tailwind CSS configuration
├── vite.config.ts           # Vite configuration
└── README.md                # This file
```

## 🔌 API Integration

### Helius API

**Purpose**: Fetch user's NFT collection from Solana blockchain

**Endpoint**: `https://mainnet.helius-rpc.com/`

**Usage in Code**:

```typescript
// File: client/src/lib/helius.ts
import { getAssetsByOwner } from '@/lib/helius';

// Fetch NFTs for a wallet
const assets = await getAssetsByOwner(walletAddress);
```

**Configuration**:
- Add `VITE_HELIUS_API_KEY` to `.env.local`
- API calls are made from the frontend via the Helius proxy

**Rate Limits**: 
- Free tier: 100 requests/minute
- Paid tier: Higher limits available

### WebSocket API (Future)

**Purpose**: Real-time multiplayer matchmaking and match synchronization

**Configuration**: Will be added when backend server is implemented

**Location**: `client/src/lib/websocket.ts`

## 🎮 Game Logic Files

### Core Game Engine

| File | Purpose |
|------|---------|
| `lib/warEngine.ts` | Core game mechanics (card comparison, Royale War logic) |
| `lib/aiStrategy.ts` | AI opponent strategies (Easy, Medium, Hard) |
| `lib/localMatchEngine.ts` | Local match simulation and settlement |
| `lib/types.ts` | TypeScript interfaces and types |

### Data Management

| File | Purpose |
|------|---------|
| `lib/cardData.ts` | Dummy NFT card data |
| `hooks/useLocalStorage.ts` | Browser storage for wallet and profile |
| `contexts/DummyDeckContext.tsx` | Demo deck state management |
| `contexts/DeckContext.tsx` | Active deck state management |

## 🎨 Design System

### Colors

- **Primary**: Deep Violet (`#8B5CF6`)
- **Secondary**: Molten Gold (`#F59E0B`)
- **Success**: Emerald Green (`#10B981`)
- **Danger**: Crimson Red (`#EF4444`)
- **Background**: Deep Black (`#07060F`)

### Typography

- **Display**: Syne (Bold headings)
- **Data**: IBM Plex Mono (Monospace data)
- **Body**: Outfit (Regular text)

### Components

All components use shadcn/ui with custom styling via Tailwind CSS.

## 🔐 Security Considerations

1. **Never commit `.env.local`** - Add to `.gitignore`
2. **API Keys**: Keep Helius API key private
3. **localStorage**: Demo data only, no sensitive information
4. **Smart Contracts**: Future implementation will require auditing

## 🐛 Troubleshooting

### Port Already in Use

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use a different port
pnpm dev -- --port 3001
```

### Dependencies Installation Issues

```bash
# Clear pnpm cache
pnpm store prune

# Reinstall dependencies
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### TypeScript Errors

```bash
# Check for errors
pnpm check

# Generate types
pnpm build
```

### Helius API Not Working

1. Verify `VITE_HELIUS_API_KEY` is set correctly
2. Check Helius dashboard for rate limits
3. Ensure wallet address format is valid (base58)
4. Check browser console for error messages

## 📚 Additional Resources

- [Helius Documentation](https://docs.helius.dev)
- [Solana Documentation](https://docs.solana.com)
- [React Documentation](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [Framer Motion](https://www.framer.com/motion)

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Commit changes: `git commit -am 'Add new feature'`
3. Push to branch: `git push origin feature/your-feature`
4. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🎯 Next Steps

1. **Wallet Integration**: Connect Phantom wallet for real NFT loading
2. **Smart Contract**: Deploy settlement contract on Solana
3. **Multiplayer**: Implement real-time opponent matching
4. **Leaderboard**: Add global rankings and seasonal resets
5. **Mobile**: Optimize for mobile devices

## 📞 Support

For issues, questions, or suggestions:

1. Check existing GitHub issues
2. Create a new issue with detailed description
3. Include error messages and steps to reproduce

---

**Built with ❤️ for the Solana community**
