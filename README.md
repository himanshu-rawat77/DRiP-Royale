# DRiP Royale - Stake Art. Win War.

A professional Solana-based NFT card game platform built with React, TypeScript, and Tailwind CSS. Play card battles, stake your NFTs, and compete for glory in the Royale War.

## 📋 Table of Contents

- [Features](#features)
- [Campaign mode](#campaign-mode)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Project](#running-the-project)
- [Project Structure](#project-structure)
- [API Integration](#api-integration)
- [Environment Variables](#environment-variables)

## ✨ Features

- **The Vault**: Build and manage your deck (demo cards or wallet NFTs from Helius); special flow when a **campaign** is active
- **The Arena**: Card battles against AI (Easy / Medium / Hard) or **multiplayer** via matchmaking
- **Campaign mode** (`/campaigns`): Solo PvE **staged runs** (four stages per run), **ROYALE** entry economics, creator-published campaigns, optional on-chain memo intents
- **Creator dashboard** (`/creator`): Create collections, configure campaigns, stage rewards, publish live
- **Matchmaking** (`/matchmaking`): WebSocket-backed queue (`/ws/matchmaking`) and escrow-related API
- **Tokenomics API**: In-app **ROYALE** balance and challenge tickets (PostgreSQL-backed)
- **The Profile**: Wallet, NFTs, achievements, ledger-oriented history (local + server where wired)
- **Achievement System**: Unlock badges for milestones
- **Shared match engine**: Same flip logic in the client and Express (`shared/matchEngine`)

## Campaign mode

**What works today**

- Players open **Campaigns**, connect **Phantom**, choose a campaign and difficulty (**normal** / **hard** / **nightmare**), and **pay entry** in ROYALE (split: creator, reward pool, protocol). They receive an `entryId` stored in `sessionStorage` with `campaignSession`.
- **Vault** switches to **campaign mode**: for the current MVP, only the **demo deck** is allowed so runs stay fair and testable with a known card pool.
- **Arena** starts a **server-side run** (`campaign_runs`): each stage is a full match; the server builds a scaled opponent deck from the player deck. The client sends picks via `pickCampaignCard`; AI replies are resolved on the server.
- **Progress** and **balances** persist in Postgres (`campaign_progress`, `token_wallets`, etc.). **Stage rewards** can mint compressed NFTs when the server mint path is configured.
- **Optional on-chain layer**: when enabled, the wallet signs transactions that include **Memo program** payloads (`publish_campaign`, `pay_entry`, `finalize_run`, `claim_reward`) derived in `server/onchain-campaign.ts` and sent via `client/src/lib/onchainCampaignTx.ts`. This is scaffolding toward a real program, not a substitute for audited vault logic.

**What we want to achieve**

- **Creator economy**: Creators ship themed campaigns; entry fees fund creators, a visible reward pool, and protocol fee—see [ARCHITECTURE.md](./ARCHITECTURE.md) for splits and tables.
- **Verifiable runs**: Commitment hashes tie deck and run metadata to **finalize** steps so outcomes can be checked against what was committed.
- **Real on-chain settlement**: Move from memo intents to an **Anchor** program with PDAs for campaign, reward vault, and fees—`CAMPAIGN_PROGRAM_ID` and `ONCHAIN_CAMPAIGNS_ENABLED` are the hooks for that migration.
- **Richer rewards**: ROYALE plus **cNFT** (and later hybrid) rewards per stage; metadata driven from the creator dashboard.

For diagrams, API touchpoints, and file map, read **[ARCHITECTURE.md](./ARCHITECTURE.md)**.

## 🔧 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **pnpm** (v10 or higher) — package manager
- **PostgreSQL** — required for tokenomics, campaigns, users, and related APIs (`DATABASE_URL`)
- **Git** — version control

## 📦 Installation

### 1. Clone the Repository

```bash
git clone <your-fork-or-origin-url>
cd drip-royale-web
```

### 2. Install Dependencies

```bash
pnpm install
```

## ⚙️ Configuration

### Environment Variables

Create a `.env.local` file in the **project root** (Vite `envDir` is the repo root). Example:

```env
# Database (required for /api/tokenomics, /api/campaigns, /api/users, etc.)
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/drip_royale

# Helius — NFT loading and RPC for wallet txs
VITE_HELIUS_API_KEY=your_helius_api_key_here
VITE_HELIUS_API_URL=https://mainnet.helius-rpc.com

# Solana
VITE_SOLANA_NETWORK=mainnet-beta

# Campaign on-chain scaffolding (optional)
# ONCHAIN_CAMPAIGNS_ENABLED=true
# CAMPAIGN_PROGRAM_ID=<pubkey when Anchor program exists>

VITE_APP_NAME=DRiP Royale
VITE_APP_VERSION=1.0.0
```

Apply the SQL schema (once per database):

```bash
pnpm db:init
# or run server/db-schema.sql against your Postgres instance
```

### Helius API Setup

1. Visit [helius.dev](https://helius.dev), create an API key.
2. Set `VITE_HELIUS_API_KEY` in `.env.local`.

### Wallet

- **Phantom** is used for signing (campaign entry, memo intents, future program txs).
- Install the [Phantom](https://phantom.app/) browser extension for full campaign and creator flows.

## 🚀 Running the Project

### Development Server

```bash
pnpm dev
```

Vite serves the React app and **mounts the Express routers** on the same dev server (`/api/*`, `/ws/matchmaking`). Ensure `DATABASE_URL` is set so campaign and tokenomics routes can reach Postgres.

App URL: `http://localhost:3000` (or the next free port if 3000 is busy).

### Production

```bash
pnpm build
pnpm start
```

`pnpm build` outputs the client to `dist/public` and bundles `server/index.ts` to `dist/index.js`. `pnpm start` runs the Node server, which requires `DATABASE_URL` and serves the built SPA.

### Preview Production Build (client only)

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
├── client/src/              # React app (Vite root)
│   ├── pages/               # Home, Vault, Arena, Profile, Ledger, Leaderboard,
│   │                        # Matchmaking, SoloCampaign, CreatorDashboard, Docs, …
│   ├── lib/                 # helius, localMatchEngine, soloCampaignClient,
│   │                        # onchainCampaignTx, campaignSession, websocket, …
│   ├── components/, hooks/, contexts/
│   └── App.tsx              # Routes: /campaigns, /creator, /matchmaking, …
├── server/                  # Express routers + WS + DB helpers
│   ├── index.ts             # Production HTTP server + static SPA
│   ├── solo-campaign-routes.ts
│   ├── tokenomics-routes.ts, tokenomics-store.ts
│   ├── escrow-routes.ts, escrow-settlement.ts
│   ├── users-routes.ts, matchmaking-ws.ts
│   ├── onchain-campaign.ts, campaign-reward-mint.ts, db.ts, db-schema.sql
│   └── scripts/init-db.ts
├── shared/                  # matchEngine, helius RPC helpers (client + server)
├── dist/                    # Build output (public + server bundle)
├── ARCHITECTURE.md          # System design and campaign deep-dive
├── vite.config.ts           # Dev server + /api middleware + WS upgrade
└── package.json
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

### Backend REST (Vite dev and production)

| Prefix | Purpose |
|--------|---------|
| `/api/tokenomics` | ROYALE, challenge tickets |
| `/api/campaigns` | Solo campaigns, runs, entries, progress |
| `/api/users` | Creator campaigns, collections, dashboard |
| `/api/escrow` | Multiplayer escrow flows |

### WebSocket

**Path**: `/ws/matchmaking` — matchmaking and session sync (`server/matchmaking-ws.ts`, `client/src/lib/websocket.ts`).

## 🎮 Game Logic Files

### Core Game Engine

| File | Purpose |
|------|---------|
| `lib/warEngine.ts` | Core game mechanics (card comparison, Royale War logic) |
| `lib/aiStrategy.ts` | AI opponent strategies (Easy, Medium, Hard) |
| `lib/localMatchEngine.ts` | Client wrapper around `shared/matchEngine` |
| `lib/soloCampaignClient.ts` | Campaign REST client |
| `shared/matchEngine.ts` | Authoritative flip logic (also used on server) |
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

1. **Anchor campaign program**: Replace memo-only intents with audited on-chain vaults and settlement.
2. **Campaign deck policy**: Allow wallet NFTs in campaigns when fairness and verification are defined.
3. **Multiplayer depth**: Harden escrow + WS state machine; surface global stats from `match_history`.
4. **Leaderboard / seasons**: Tie ROYALE and campaigns to seasonal resets.
5. **Mobile**: Responsive polish for campaign and arena flows.

## 📞 Support

For issues, questions, or suggestions:

1. Check existing GitHub issues
2. Create a new issue with detailed description
3. Include error messages and steps to reproduce

---

**Built with ❤️ for the Solana community**
