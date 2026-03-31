/**
 * Achievement Badges System
 * Defines all available achievements and their unlock conditions
 */

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlockedAt?: number; // timestamp
  condition: (stats: PlayerStats) => boolean;
  progress?: (stats: PlayerStats) => number; // 0-100 for progress display
}

export interface PlayerStats {
  totalWins: number;
  totalLosses: number;
  winRate: number;
  totalMatches: number;
  consecutiveWins: number;
  firstWinDate?: number;
  highestWinStreak: number;
  totalEarnings: number;
  cardsCollected: number;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first-blood',
    name: 'First Blood',
    description: 'Win your first match',
    icon: '🎯',
    rarity: 'common',
    condition: (stats) => stats.totalWins >= 1,
    progress: (stats) => Math.min((stats.totalWins / 1) * 100, 100),
  },
  {
    id: 'warrior',
    name: 'Warrior',
    description: 'Achieve 10 wins',
    icon: '⚔️',
    rarity: 'common',
    condition: (stats) => stats.totalWins >= 10,
    progress: (stats) => Math.min((stats.totalWins / 10) * 100, 100),
  },
  {
    id: 'champion',
    name: 'Champion',
    description: 'Achieve 50 wins',
    icon: '👑',
    rarity: 'rare',
    condition: (stats) => stats.totalWins >= 50,
    progress: (stats) => Math.min((stats.totalWins / 50) * 100, 100),
  },
  {
    id: 'legend',
    name: 'Legend',
    description: 'Achieve 100 wins',
    icon: '⭐',
    rarity: 'epic',
    condition: (stats) => stats.totalWins >= 100,
    progress: (stats) => Math.min((stats.totalWins / 100) * 100, 100),
  },
  {
    id: 'immortal',
    name: 'Immortal',
    description: 'Achieve 250 wins',
    icon: '🔥',
    rarity: 'legendary',
    condition: (stats) => stats.totalWins >= 250,
    progress: (stats) => Math.min((stats.totalWins / 250) * 100, 100),
  },
  {
    id: 'hot-streak',
    name: 'Hot Streak',
    description: 'Win 5 matches in a row',
    icon: '🌪️',
    rarity: 'rare',
    condition: (stats) => stats.consecutiveWins >= 5,
    progress: (stats) => Math.min((stats.consecutiveWins / 5) * 100, 100),
  },
  {
    id: 'inferno',
    name: 'Inferno',
    description: 'Win 10 matches in a row',
    icon: '🔥',
    rarity: 'epic',
    condition: (stats) => stats.consecutiveWins >= 10,
    progress: (stats) => Math.min((stats.consecutiveWins / 10) * 100, 100),
  },
  {
    id: 'flawless',
    name: 'Flawless Victory',
    description: 'Achieve 75% win rate',
    icon: '✨',
    rarity: 'epic',
    condition: (stats) => stats.winRate >= 75,
    progress: (stats) => Math.min((stats.winRate / 75) * 100, 100),
  },
  {
    id: 'collector',
    name: 'Collector',
    description: 'Collect 10 different NFTs',
    icon: '🎨',
    rarity: 'common',
    condition: (stats) => stats.cardsCollected >= 10,
    progress: (stats) => Math.min((stats.cardsCollected / 10) * 100, 100),
  },
  {
    id: 'vault-master',
    name: 'Vault Master',
    description: 'Collect 50 different NFTs',
    icon: '💎',
    rarity: 'rare',
    condition: (stats) => stats.cardsCollected >= 50,
    progress: (stats) => Math.min((stats.cardsCollected / 50) * 100, 100),
  },
  {
    id: 'wealthy',
    name: 'Wealthy',
    description: 'Earn 1000 SOL',
    icon: '💰',
    rarity: 'rare',
    condition: (stats) => stats.totalEarnings >= 1000,
    progress: (stats) => Math.min((stats.totalEarnings / 1000) * 100, 100),
  },
  {
    id: 'rich',
    name: 'Rich',
    description: 'Earn 5000 SOL',
    icon: '🏆',
    rarity: 'epic',
    condition: (stats) => stats.totalEarnings >= 5000,
    progress: (stats) => Math.min((stats.totalEarnings / 5000) * 100, 100),
  },
  {
    id: 'marathon',
    name: 'Marathon',
    description: 'Play 100 matches',
    icon: '🏃',
    rarity: 'common',
    condition: (stats) => stats.totalMatches >= 100,
    progress: (stats) => Math.min((stats.totalMatches / 100) * 100, 100),
  },
  {
    id: 'endurance',
    name: 'Endurance',
    description: 'Play 500 matches',
    icon: '💪',
    rarity: 'epic',
    condition: (stats) => stats.totalMatches >= 500,
    progress: (stats) => Math.min((stats.totalMatches / 500) * 100, 100),
  },
];

export function getUnlockedAchievements(stats: PlayerStats): Achievement[] {
  return ACHIEVEMENTS.filter((achievement) => achievement.condition(stats));
}

export function getAchievementProgress(stats: PlayerStats) {
  return ACHIEVEMENTS.map((achievement) => ({
    ...achievement,
    progress: achievement.progress?.(stats) || 0,
  })) as (Achievement & { progress: number })[];
}

export function getRarityColor(rarity: Achievement['rarity']): string {
  const colors: Record<Achievement['rarity'], string> = {
    common: '#A78BFA',
    rare: '#3B82F6',
    epic: '#8B5CF6',
    legendary: '#F59E0B',
  };
  return colors[rarity];
}

export function getRarityGlow(rarity: Achievement['rarity']): string {
  const glows: Record<Achievement['rarity'], string> = {
    common: 'rgba(167, 139, 250, 0.3)',
    rare: 'rgba(59, 130, 246, 0.3)',
    epic: 'rgba(139, 92, 246, 0.3)',
    legendary: 'rgba(245, 158, 11, 0.3)',
  };
  return glows[rarity];
}
