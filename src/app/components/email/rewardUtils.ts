export type EmailRewardResources = Record<string, number>;

const RESOURCE_ALIASES: Record<string, string> = {
  energy_sugar: "energy_sugar",
  energysugar: "energy_sugar",
  dream_fruit_dust: "dream_fruit_dust",
  dreamfruitdust: "dream_fruit_dust",
  core_crunch_seed: "core_crunch_seed",
  corecrunchseed: "core_crunch_seed",
  star_gel_essence: "star_gel_essence",
  stargelessence: "star_gel_essence",
  star_coin: "star_coin",
  starcoin: "star_coin",
  point: "point",
  points: "point",
};

export const normalizeRewardKey = (value: string) =>
  value.trim().toLowerCase().replace(/[\s-]+/g, "_");

const isSafeResourceKey = (value: string) => /^[a-z_][a-z0-9_]*$/.test(value);

const resolveResourceKey = (value: string): string | null => {
  const normalized = normalizeRewardKey(value);
  if (!normalized) return null;
  const aliased = RESOURCE_ALIASES[normalized] ?? normalized;
  return isSafeResourceKey(aliased) ? aliased : null;
};

const normalizeCount = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  const floored = Math.floor(parsed);
  return floored > 0 ? floored : 0;
};

export const createEmptyEmailRewardResources = (): EmailRewardResources => ({});

const addReward = (
  target: EmailRewardResources,
  rawKey: string,
  rawCount: unknown
) => {
  const key = resolveResourceKey(rawKey);
  if (!key) return;
  const count = normalizeCount(rawCount);
  if (count <= 0) return;
  target[key] += count;
};

const applyRewardRecord = (
  target: EmailRewardResources,
  record: Record<string, unknown>
) => {
  for (const [rawKey, rawValue] of Object.entries(record)) {
    addReward(target, rawKey, rawValue);
  }

  const resourceKey =
    typeof record.resourceKey === "string"
      ? record.resourceKey
      : typeof record.key === "string"
        ? record.key
        : null;
  if (resourceKey) {
    addReward(target, resourceKey, record.count ?? record.amount ?? record.value);
  }

  const nested =
    record.rewards ??
    record.reward ??
    record.payload ??
    record.items;
  if (nested && typeof nested === "object") {
    applyRewardUnknown(target, nested);
  }
};

const applyRewardUnknown = (
  target: EmailRewardResources,
  value: unknown
) => {
  if (!value) return;
  if (Array.isArray(value)) {
    value.forEach((entry) => {
      if (entry && typeof entry === "object") {
        applyRewardRecord(target, entry as Record<string, unknown>);
      }
    });
    return;
  }
  if (typeof value === "object") {
    applyRewardRecord(target, value as Record<string, unknown>);
  }
};

const parseTextReward = (target: EmailRewardResources, rawText: string) => {
  const segments = rawText.split(/[,;\n]/);
  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    const strictMatched = trimmed.match(/^([a-zA-Z_ -]+)\s*[:=x]\s*(-?\d+)$/);
    if (strictMatched) {
      addReward(target, strictMatched[1], strictMatched[2]);
      continue;
    }

    const forwardMatched = trimmed.match(/^([a-zA-Z_ -]+)\s+(-?\d+)$/);
    if (forwardMatched) {
      addReward(target, forwardMatched[1], forwardMatched[2]);
      continue;
    }

    const backwardMatched = trimmed.match(/^(-?\d+)\s+([a-zA-Z_ -]+)$/);
    if (backwardMatched) {
      addReward(target, backwardMatched[2], backwardMatched[1]);
    }
  }
};

export const hasAnyEmailReward = (rewards: EmailRewardResources) =>
  Object.keys(rewards).length > 0;

export const parseEmailRewardResources = (
  rawReward: string | null | undefined
): EmailRewardResources | null => {
  if (!rawReward) return null;
  const trimmed = rawReward.trim();
  if (!trimmed) return null;

  const rewards = createEmptyEmailRewardResources();
  try {
    const parsed = JSON.parse(trimmed);
    applyRewardUnknown(rewards, parsed);
  } catch {
    parseTextReward(rewards, trimmed);
  }

  return hasAnyEmailReward(rewards) ? rewards : null;
};

export const hasClaimableEmailReward = (
  rawReward: string | null | undefined
) => parseEmailRewardResources(rawReward) != null;

const toTitleCase = (value: string) =>
  value
    .split("_")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

export const formatEmailRewardResources = (rewards: EmailRewardResources) =>
  Object.entries(rewards)
    .filter((entry) => entry[1] > 0)
    .map((entry) => `${toTitleCase(entry[0])} x${entry[1]}`)
    .join(" + ");

export const describeEmailRewardText = (rawReward: string | null | undefined) => {
  if (!rawReward || !rawReward.trim()) {
    return "No reward";
  }

  const parsed = parseEmailRewardResources(rawReward);
  if (parsed) {
    return formatEmailRewardResources(parsed);
  }
  return rawReward.trim();
};
