// Shared NFT Card Data for DRiP Royale
export const NFT_CARDS = [
  {
    id: 1,
    name: 'Shadow Oracle',
    image: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663486830791/WuCyWqVdFPbfCADWcJauKD/nft-card-1-shadow-oracle-oWphV5HH5gd8RJVJHXvfh4.webp',
    power: 13,
    rarity: 'legendary',
    description: 'Mystical oracle with cosmic power',
  },
  {
    id: 2,
    name: 'Golden Phoenix',
    image: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663486830791/WuCyWqVdFPbfCADWcJauKD/nft-card-2-golden-phoenix-hCJ7TtRNesmM8sniavHXkg.webp',
    power: 12,
    rarity: 'rare',
    description: 'Majestic phoenix rising from flames',
  },
  {
    id: 3,
    name: 'Void Sentinel',
    image: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663486830791/WuCyWqVdFPbfCADWcJauKD/nft-card-3-void-sentinel-WcEBeGhaodqcUNXd9YGtX4.webp',
    power: 11,
    rarity: 'rare',
    description: 'Dark armored guardian of the void',
  },
  {
    id: 4,
    name: 'Crystal Guardian',
    image: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663486830791/WuCyWqVdFPbfCADWcJauKD/nft-card-4-crystal-guardian-PgDBe3X84SSZL45j5wEi49.webp',
    power: 10,
    rarity: 'uncommon',
    description: 'Crystalline protector with luminous power',
  },
  {
    id: 5,
    name: 'Inferno Dragon',
    image: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663486830791/WuCyWqVdFPbfCADWcJauKD/nft-card-5-inferno-dragon-gozDvcLrg2NqUagiRJuRBz.webp',
    power: 9,
    rarity: 'uncommon',
    description: 'Fierce dragon of molten fire',
  },
];

export const RARITY_COLORS: Record<string, string> = {
  common: '#A0AEC0',
  uncommon: '#3B82F6',
  rare: '#A855F7',
  legendary: '#F59E0B',
};

export function getCardById(id: number) {
  return NFT_CARDS.find((card) => card.id === id);
}

export function getRandomCard() {
  return NFT_CARDS[Math.floor(Math.random() * NFT_CARDS.length)];
}

export function getCardsByRarity(rarity: string) {
  return NFT_CARDS.filter((card) => card.rarity === rarity);
}
