import type { GameCard } from './types';

export type AIDifficulty = 'easy' | 'medium' | 'hard';

interface AIState {
  hand: GameCard[];
  opponentHand: GameCard[];
  opponentWins: number;
  playerWins: number;
  roundNumber: number;
}

/**
 * AI Strategy Engine for DRiP Royale
 * Implements different difficulty levels with varying card selection strategies
 */
export class AIStrategy {
  private difficulty: AIDifficulty;

  constructor(difficulty: AIDifficulty = 'medium') {
    this.difficulty = difficulty;
  }

  /**
   * Select a card from AI's hand based on difficulty level
   */
  selectCard(state: AIState): GameCard | null {
    if (state.hand.length === 0) return null;

    switch (this.difficulty) {
      case 'easy':
        return this.easyStrategy(state);
      case 'medium':
        return this.mediumStrategy(state);
      case 'hard':
        return this.hardStrategy(state);
      default:
        return this.mediumStrategy(state);
    }
  }

  /**
   * Easy Strategy: Random card selection with occasional weak card plays
   * - 70% chance to play a random card
   * - 30% chance to play the weakest card (bad decision)
   */
  private easyStrategy(state: AIState): GameCard {
    const randomChance = Math.random();

    if (randomChance < 0.7) {
      // Play random card
      const randomIndex = Math.floor(Math.random() * state.hand.length);
      return state.hand[randomIndex];
    } else {
      // Play weakest card (intentional bad play)
      return state.hand.reduce((weakest, current) =>
        (current.power || 0) < (weakest.power || 0) ? current : weakest
      );
    }
  }

  /**
   * Medium Strategy: Balanced approach with some tactical decisions
   * - 40% chance to play a card matching opponent's expected strength
   * - 30% chance to play a slightly stronger card
   * - 30% chance to play random
   */
  private mediumStrategy(state: AIState): GameCard {
    const randomChance = Math.random();
    const sortedHand = [...state.hand].sort((a, b) => (a.power || 0) - (b.power || 0));

    if (randomChance < 0.4) {
      // Try to match opponent's strength (play mid-range card)
      const midIndex = Math.floor(sortedHand.length / 2);
      return sortedHand[midIndex];
    } else if (randomChance < 0.7) {
      // Play slightly stronger card
      const strongIndex = Math.floor(sortedHand.length * 0.65);
      return sortedHand[strongIndex];
    } else {
      // Play random
      const randomIndex = Math.floor(Math.random() * state.hand.length);
      return state.hand[randomIndex];
    }
  }

  /**
   * Hard Strategy: Advanced tactical decisions
   * - Analyzes game state and plays optimally
   * - 50% chance to play strongest card when behind
   * - 40% chance to play weakest card when ahead (to conserve strong cards)
   * - 10% chance to play strategically weak card to bait opponent
   */
  private hardStrategy(state: AIState): GameCard {
    const sortedHand = [...state.hand].sort((a, b) => (a.power || 0) - (b.power || 0));
    const isAheadInWins = state.opponentWins > state.playerWins;
    const randomChance = Math.random();

    // If behind, play stronger cards
    if (isAheadInWins) {
      if (randomChance < 0.5) {
        // Play strongest card
        return sortedHand[sortedHand.length - 1];
      } else if (randomChance < 0.9) {
        // Play strong card
        const strongIndex = Math.floor(sortedHand.length * 0.75);
        return sortedHand[strongIndex];
      } else {
        // Occasional bait with weak card
        return sortedHand[0];
      }
    }

    // If ahead, conserve strong cards
    if (randomChance < 0.4) {
      // Play weakest card to conserve strength
      return sortedHand[0];
    } else if (randomChance < 0.8) {
      // Play mid-range card
      const midIndex = Math.floor(sortedHand.length / 2);
      return sortedHand[midIndex];
    } else {
      // Occasionally play strong card to close out
      return sortedHand[sortedHand.length - 1];
    }
  }

  /**
   * Get AI difficulty label
   */
  getDifficultyLabel(): string {
    const labels: Record<AIDifficulty, string> = {
      easy: 'ROOKIE',
      medium: 'VETERAN',
      hard: 'LEGEND',
    };
    return labels[this.difficulty];
  }

  /**
   * Get AI difficulty description
   */
  getDifficultyDescription(): string {
    const descriptions: Record<AIDifficulty, string> = {
      easy: 'Random card selection with occasional poor decisions',
      medium: 'Balanced approach with tactical awareness',
      hard: 'Advanced strategy with game state analysis',
    };
    return descriptions[this.difficulty];
  }

  /**
   * Get AI opponent name based on difficulty
   */
  getOpponentName(): string {
    const names: Record<AIDifficulty, string> = {
      easy: 'Rookie Bot',
      medium: 'Veteran AI',
      hard: 'Legend AI',
    };
    return names[this.difficulty];
  }
}

/**
 * Create AI strategy instance
 */
export function createAIStrategy(difficulty: AIDifficulty = 'medium'): AIStrategy {
  return new AIStrategy(difficulty);
}
