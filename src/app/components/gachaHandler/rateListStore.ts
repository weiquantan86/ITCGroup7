import "server-only";

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import RateList from "./RateList";
import {
  DEFAULT_GACHA_RATE_LIST,
  DEFAULT_SNACK_RATE_CONFIG,
  SNACK_KEYS,
  SNACK_BY_KEY,
  type GachaRateList,
  type ResourceKey,
  type SnackInventory,
  type SnackRateConfig,
  type SpecialRateEntry,
  type SpecialRateReward,
} from "./rateConfig";

const RATE_LIST_PATH = path.join(
  process.cwd(),
  "src",
  "app",
  "components",
  "gachaHandler",
  "RateList.json"
);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const toPositiveInt = (value: unknown, fallback: number) => {
  const parsed =
    typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.trunc(parsed);
};

const toNonNegativeInt = (value: unknown, fallback: number) => {
  const parsed =
    typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.trunc(parsed);
};

const toChance = (value: unknown, fallback: number) => {
  const parsed =
    typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  if (!Number.isFinite(parsed)) return fallback;
  return clamp(parsed, 0, 1);
};

const toSnackInventory = (
  value: unknown,
  fallback: SnackInventory
): SnackInventory => {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    energy_sugar: toNonNegativeInt(source.energy_sugar, fallback.energy_sugar),
    dream_fruit_dust: toNonNegativeInt(
      source.dream_fruit_dust,
      fallback.dream_fruit_dust
    ),
    core_crunch_seed: toNonNegativeInt(
      source.core_crunch_seed,
      fallback.core_crunch_seed
    ),
    star_gel_essence: toNonNegativeInt(
      source.star_gel_essence,
      fallback.star_gel_essence
    ),
  };
};

const isResourceKey = (value: unknown): value is ResourceKey =>
  typeof value === "string" &&
  (value === "star_coin" ||
    value === "point" ||
    SNACK_KEYS.some((snackKey) => snackKey === value));

const buildDefaultReward = (): SpecialRateReward => ({
  type: "resource",
  resourceKey: "star_coin",
  name: "Star Coin",
  count: 1,
  icon: "STAR",
});

const sanitizeReward = (
  value: unknown
): SpecialRateReward => {
  if (!value || typeof value !== "object") return buildDefaultReward();
  const source = value as Record<string, unknown>;
  const type = source.type;
  const count = toPositiveInt(source.count, 1);

  if (type === "character") {
    const characterId =
      typeof source.characterId === "string" && source.characterId.trim()
        ? source.characterId.trim()
        : "";
    if (!characterId) return buildDefaultReward();
    const name =
      typeof source.name === "string" && source.name.trim()
        ? source.name.trim()
        : characterId;
    return {
      type: "character",
      characterId,
      name,
      count,
      icon:
        typeof source.icon === "string" && source.icon.trim()
          ? source.icon.trim()
          : "CHAR",
    };
  }

  const resourceKey = isResourceKey(source.resourceKey)
    ? source.resourceKey
    : "star_coin";
  const fallbackName =
    resourceKey in SNACK_BY_KEY
      ? SNACK_BY_KEY[resourceKey as keyof typeof SNACK_BY_KEY].label
      : resourceKey === "star_coin"
        ? "Star Coin"
        : "Point";
  const name =
    typeof source.name === "string" && source.name.trim()
      ? source.name.trim()
      : fallbackName;

  return {
    type: "resource",
    resourceKey,
    name,
    count,
    imagePath:
      typeof source.imagePath === "string" && source.imagePath.trim()
        ? source.imagePath.trim()
        : resourceKey in SNACK_BY_KEY
          ? SNACK_BY_KEY[resourceKey as keyof typeof SNACK_BY_KEY].imagePath
          : undefined,
    icon:
      typeof source.icon === "string" && source.icon.trim()
        ? source.icon.trim()
        : resourceKey === "star_coin"
          ? "STAR"
          : resourceKey === "point"
            ? "PTS"
            : undefined,
  };
};

const sanitizeSpecialRate = (
  value: unknown,
  index: number
): SpecialRateEntry | null => {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const id =
    typeof source.id === "string" && source.id.trim()
      ? source.id.trim()
      : `special-rate-${index + 1}`;
  const name =
    typeof source.name === "string" && source.name.trim()
      ? source.name.trim()
      : `Special Rate ${index + 1}`;
  const requirements = toSnackInventory(source.requirements, {
    energy_sugar: 0,
    dream_fruit_dust: 0,
    core_crunch_seed: 0,
    star_gel_essence: 0,
  });
  const reward = sanitizeReward(source.reward);

  return {
    id,
    name,
    requirements,
    chance: toChance(source.chance, 0),
    reward,
  };
};

const sanitizeBaseConfig = (_value: unknown): SnackRateConfig => {
  return {
    snacksPerReward: DEFAULT_SNACK_RATE_CONFIG.snacksPerReward,
    dropChance: DEFAULT_SNACK_RATE_CONFIG.dropChance,
    rewardCount: DEFAULT_SNACK_RATE_CONFIG.rewardCount,
    weights: {
      ...DEFAULT_SNACK_RATE_CONFIG.weights,
    },
    updatedAt: null,
  };
};

const cloneRateList = (value: GachaRateList): GachaRateList =>
  JSON.parse(JSON.stringify(value)) as GachaRateList;

const sanitizeRateList = (value: unknown): GachaRateList => {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const specialRatesSource = Array.isArray(source.specialRates) ? source.specialRates : [];
  const sanitizedSpecialRates = specialRatesSource
    .map((entry, index) => sanitizeSpecialRate(entry, index))
    .filter((entry): entry is SpecialRateEntry => entry !== null);
  const usedIds = new Set<string>();
  const uniqueSpecialRates = sanitizedSpecialRates.map((entry, index) => {
    const baseId = entry.id || `special-rate-${index + 1}`;
    let nextId = baseId;
    let suffix = 2;
    while (usedIds.has(nextId)) {
      nextId = `${baseId}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(nextId);
    return nextId === entry.id ? entry : { ...entry, id: nextId };
  });

  return {
    baseConfig: sanitizeBaseConfig(source.baseConfig),
    specialRates: uniqueSpecialRates,
    updatedAt:
      typeof source.updatedAt === "string" && source.updatedAt.trim()
        ? source.updatedAt
        : null,
  };
};

const writeRateList = async (value: GachaRateList) => {
  await writeFile(RATE_LIST_PATH, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

export const loadRateList = async (): Promise<GachaRateList> => {
  try {
    const raw = await readFile(RATE_LIST_PATH, "utf8");
    return sanitizeRateList(JSON.parse(raw));
  } catch {
    const fallback = sanitizeRateList(cloneRateList(RateList ?? DEFAULT_GACHA_RATE_LIST));
    await writeRateList(fallback);
    return fallback;
  }
};

export const updateRateList = async (
  patch: { specialRates?: SpecialRateEntry[] }
): Promise<GachaRateList> => {
  const current = await loadRateList();

  const next: GachaRateList = sanitizeRateList({
    baseConfig: current.baseConfig,
    specialRates: patch.specialRates ?? current.specialRates,
    updatedAt: new Date().toISOString(),
  });

  await writeRateList(next);
  return next;
};

export const buildDefaultRateList = (): GachaRateList =>
  sanitizeRateList(cloneRateList(DEFAULT_GACHA_RATE_LIST));
