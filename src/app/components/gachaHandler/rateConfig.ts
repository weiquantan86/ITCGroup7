export const SNACK_KEYS = [
  "energy_sugar",
  "dream_fruit_dust",
  "core_crunch_seed",
  "star_gel_essence",
] as const;

export type SnackKey = (typeof SNACK_KEYS)[number];

export type SnackInventory = Record<SnackKey, number>;

export type ResourceKey = SnackKey | "star_coin" | "point";

export type GachaDisplayReward = {
  id: string;
  name: string;
  count: number;
  imagePath?: string;
  icon?: string;
  subtitle?: string;
};

export type SnackRateConfig = {
  snacksPerReward: number;
  dropChance: number;
  rewardCount: number;
  weights: Record<SnackKey, number>;
  updatedAt: string | null;
};

export type SpecialRateReward =
  | {
      type: "resource";
      resourceKey: ResourceKey;
      name: string;
      count: number;
      imagePath?: string;
      icon?: string;
    }
  | {
      type: "character";
      characterId: string;
      name: string;
      count: number;
      icon?: string;
    };

export type SpecialRateEntry = {
  id: string;
  name: string;
  requirements: SnackInventory;
  chance: number;
  reward: SpecialRateReward;
};

export type GachaRateList = {
  baseConfig: SnackRateConfig;
  specialRates: SpecialRateEntry[];
  updatedAt: string | null;
};

export const SNACK_DEFINITIONS: Array<{
  key: SnackKey;
  label: string;
  imagePath: string;
  glow: string;
  accent: string;
}> = [
  {
    key: "energy_sugar",
    label: "Energy Sugar",
    imagePath: "/snack/energy-sugar.svg",
    glow: "rgba(56,189,248,0.65)",
    accent: "#38bdf8",
  },
  {
    key: "dream_fruit_dust",
    label: "Dream Fruit Dust",
    imagePath: "/snack/dream-fruit-dust.svg",
    glow: "rgba(217,70,239,0.65)",
    accent: "#d946ef",
  },
  {
    key: "core_crunch_seed",
    label: "Core Crunch Seed",
    imagePath: "/snack/core-crunch-seed.svg",
    glow: "rgba(245,158,11,0.65)",
    accent: "#f59e0b",
  },
  {
    key: "star_gel_essence",
    label: "Star Gel Essence",
    imagePath: "/snack/star-gel-essence.svg",
    glow: "rgba(52,211,153,0.65)",
    accent: "#34d399",
  },
];

export const SNACK_BY_KEY = Object.fromEntries(
  SNACK_DEFINITIONS.map((snack) => [snack.key, snack])
) as Record<SnackKey, (typeof SNACK_DEFINITIONS)[number]>;

export const ZERO_SNACK_INVENTORY: SnackInventory = {
  energy_sugar: 0,
  dream_fruit_dust: 0,
  core_crunch_seed: 0,
  star_gel_essence: 0,
};

export const FIXED_BASE_SNACKS_PER_REWARD = 5;
export const FIXED_BASE_DROP_CHANCE = 1;
export const FIXED_BASE_REWARD_COUNT = 1;
export const LUCKY_CHARACTER_BONUS_CHANCE = 0.0005;
export const FIXED_BASE_WEIGHTS: Record<SnackKey, number> = {
  energy_sugar: 1,
  dream_fruit_dust: 1,
  core_crunch_seed: 1,
  star_gel_essence: 1,
};

export const DEFAULT_SNACK_RATE_CONFIG: SnackRateConfig = {
  snacksPerReward: FIXED_BASE_SNACKS_PER_REWARD,
  dropChance: FIXED_BASE_DROP_CHANCE,
  rewardCount: FIXED_BASE_REWARD_COUNT,
  weights: { ...FIXED_BASE_WEIGHTS },
  updatedAt: null,
};

export const DEFAULT_GACHA_RATE_LIST: GachaRateList = {
  baseConfig: {
    ...DEFAULT_SNACK_RATE_CONFIG,
    weights: { ...DEFAULT_SNACK_RATE_CONFIG.weights },
  },
  specialRates: [],
  updatedAt: null,
};
