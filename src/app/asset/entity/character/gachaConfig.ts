export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface GachaConfig {
  rarity: Rarity;
  weight: number; // Relative weight for probability
  color: string; // Display color
}

export const RARITY_CONFIG: Record<Rarity, { weight: number; color: string; label: string }> = {
  common: { weight: 100, color: '#94a3b8', label: 'Common' }, // Slate-400
  rare: { weight: 50, color: '#38bdf8', label: 'Rare' },    // Sky-400
  epic: { weight: 25, color: '#a78bfa', label: 'Epic' },    // Violet-400
  legendary: { weight: 10, color: '#fbbf24', label: 'Legendary' }, // Amber-400
};

// Character specific overrides or assignments
export const CHARACTER_RARITY: Record<string, Rarity> = {
  adam: 'common', // Default, but if he was in gacha
  baron: 'rare',
  carrot: 'common',
  dakota: 'rare',
  eli: 'epic',
  felix: 'common',
  grant: 'legendary',
  harper: 'epic',
};

export const getCharacterRarity = (id: string): Rarity => {
  return CHARACTER_RARITY[id.toLowerCase()] || 'common';
};
