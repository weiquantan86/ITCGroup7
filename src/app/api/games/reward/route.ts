import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import pool from "../../../../database/client";
import {
  SURGE_TOTAL_MONSTERS,
  SURGE_SNACK_KEYS,
  createEmptySurgeSnackRewards,
  resolveSurgeRewardPacksFromKills,
  type SurgeSnackRewards,
} from "../../../(pages)/(games)/mochiSoldierSurge/surgeConfig";

type RewardRequestBody = {
  gameMode?: string;
  score?: number;
  elapsedSeconds?: number;
  defeatedMonsters?: number;
  victory?: boolean;
  rewardMultiplier?: number;
  pointReward?: number;
};

const MOCHI_GENERAL_VICTORY_SCORE_STEP = 100;
const MOCHI_GENERAL_DEFEAT_SCORE_STEP = 400;
const DEFAULT_DB_QUERY_TIMEOUT_MS = 12_000;

const queryTimeoutMsFromEnv = Number(process.env.DB_QUERY_TIMEOUT_MS);
const dbQueryTimeoutMs =
  Number.isFinite(queryTimeoutMsFromEnv) && queryTimeoutMsFromEnv > 0
    ? queryTimeoutMsFromEnv
    : DEFAULT_DB_QUERY_TIMEOUT_MS;

const normalizeDefeatedCount = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(500, Math.floor(parsed)));
};

const normalizeScore = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(1_000_000, Math.floor(parsed)));
};

const normalizeRewardMultiplier = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, parsed);
};

const normalizePointReward = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(1_000_000, Math.floor(parsed)));
};

const rollRewards = (count: number): SurgeSnackRewards => {
  const rewards = createEmptySurgeSnackRewards();
  for (let i = 0; i < count; i += 1) {
    const key = SURGE_SNACK_KEYS[Math.floor(Math.random() * SURGE_SNACK_KEYS.length)];
    rewards[key] += 1;
  }
  return rewards;
};

const mergeRewards = (
  a: SurgeSnackRewards,
  b: SurgeSnackRewards
): SurgeSnackRewards => {
  const merged = createEmptySurgeSnackRewards();
  SURGE_SNACK_KEYS.forEach((key) => {
    merged[key] = (a[key] || 0) + (b[key] || 0);
  });
  return merged;
};

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const userIdValue = cookieStore.get("user_id")?.value;
  if (!userIdValue) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const userId = Number.parseInt(userIdValue, 10);
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
  }

  let body: RewardRequestBody;
  try {
    body = (await request.json()) as RewardRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const isMochiGeneralBattleMode = body.gameMode === "mochiGeneralBattle";

  let obtainedSnackRewards = createEmptySurgeSnackRewards();
  let winBonusRewards = createEmptySurgeSnackRewards();
  let obtainedSnackBaseRewards = createEmptySurgeSnackRewards();
  let obtainedSnackMultiplierBonusRewards = createEmptySurgeSnackRewards();
  let winBonusBaseRewards = createEmptySurgeSnackRewards();
  let winBonusMultiplierBonusRewards = createEmptySurgeSnackRewards();
  let rewards = createEmptySurgeSnackRewards();
  let pointReward = 0;
  let settlementPayload: Record<string, number | boolean> = {};

  if (isMochiGeneralBattleMode) {
    const score = normalizeScore(body.score);
    const isVictory = Boolean(body.victory);
    const rewardMultiplier = normalizeRewardMultiplier(body.rewardMultiplier);
    pointReward = isVictory ? normalizePointReward(body.pointReward) : 0;
    const scoreStep = isVictory
      ? MOCHI_GENERAL_VICTORY_SCORE_STEP
      : MOCHI_GENERAL_DEFEAT_SCORE_STEP;
    const baseRewardPacks = Math.floor(score / scoreStep);
    const rewardPacks = Math.floor((score * rewardMultiplier) / scoreStep);
    const multiplierBonusRewardPacks = Math.max(0, rewardPacks - baseRewardPacks);
    obtainedSnackBaseRewards = rollRewards(baseRewardPacks);
    obtainedSnackMultiplierBonusRewards = rollRewards(multiplierBonusRewardPacks);
    obtainedSnackRewards = mergeRewards(
      obtainedSnackBaseRewards,
      obtainedSnackMultiplierBonusRewards
    );
    winBonusBaseRewards = createEmptySurgeSnackRewards();
    winBonusMultiplierBonusRewards = createEmptySurgeSnackRewards();
    winBonusRewards = createEmptySurgeSnackRewards();
    rewards = mergeRewards(obtainedSnackRewards, winBonusRewards);
    settlementPayload = {
      score,
      scoreStep,
      baseRewardPacks,
      rewardPacks,
      multiplierBonusRewardPacks,
      rewardMultiplier,
      victory: isVictory,
      pointReward,
    };
  } else {
    const defeatedMonsters = normalizeDefeatedCount(body.defeatedMonsters);
    const isVictory =
      Boolean(body.victory) && defeatedMonsters >= SURGE_TOTAL_MONSTERS;
    const rewardMultiplier = normalizeRewardMultiplier(body.rewardMultiplier);
    const killRewardPacks = resolveSurgeRewardPacksFromKills(defeatedMonsters);
    const victoryBonus = isVictory ? 3 : 0;
    const scaledKillRewardPacks = Math.floor(killRewardPacks * rewardMultiplier);
    const scaledVictoryBonus = Math.floor(victoryBonus * rewardMultiplier);
    const multiplierBonusKillRewardPacks = Math.max(
      0,
      scaledKillRewardPacks - killRewardPacks
    );
    const multiplierBonusVictoryBonus = Math.max(
      0,
      scaledVictoryBonus - victoryBonus
    );
    obtainedSnackBaseRewards = rollRewards(killRewardPacks);
    obtainedSnackMultiplierBonusRewards = rollRewards(
      multiplierBonusKillRewardPacks
    );
    obtainedSnackRewards = mergeRewards(
      obtainedSnackBaseRewards,
      obtainedSnackMultiplierBonusRewards
    );
    winBonusBaseRewards = rollRewards(victoryBonus);
    winBonusMultiplierBonusRewards = rollRewards(multiplierBonusVictoryBonus);
    winBonusRewards = mergeRewards(
      winBonusBaseRewards,
      winBonusMultiplierBonusRewards
    );
    rewards = mergeRewards(obtainedSnackRewards, winBonusRewards);
    settlementPayload = {
      defeatedMonsters,
      killRewardPacks,
      scaledKillRewardPacks,
      multiplierBonusKillRewardPacks,
      victoryBonus,
      scaledVictoryBonus,
      multiplierBonusVictoryBonus,
      rewardMultiplier,
      victory: isVictory,
    };
    pointReward = 0;
  }

  const totalReward = SURGE_SNACK_KEYS.reduce(
    (total, key) => total + rewards[key],
    0
  );
  if (totalReward <= 0 && pointReward <= 0) {
    return NextResponse.json({
      success: true,
      granted: rewards,
      obtainedSnack: obtainedSnackRewards,
      obtainedSnackBase: obtainedSnackBaseRewards,
      obtainedSnackMultiplierBonus: obtainedSnackMultiplierBonusRewards,
      winBonus: winBonusRewards,
      winBonusBase: winBonusBaseRewards,
      winBonusMultiplierBonus: winBonusMultiplierBonusRewards,
      pointReward,
      ...settlementPayload,
      skipped: true,
    });
  }

  try {
    const result = await pool.query({
      text: `
        INSERT INTO user_resources (
          user_id,
          energy_sugar,
          dream_fruit_dust,
          core_crunch_seed,
          star_gel_essence,
          point
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (user_id)
        DO UPDATE SET
          energy_sugar = user_resources.energy_sugar + EXCLUDED.energy_sugar,
          dream_fruit_dust = user_resources.dream_fruit_dust + EXCLUDED.dream_fruit_dust,
          core_crunch_seed = user_resources.core_crunch_seed + EXCLUDED.core_crunch_seed,
          star_gel_essence = user_resources.star_gel_essence + EXCLUDED.star_gel_essence,
          point = COALESCE(user_resources.point, 0) + EXCLUDED.point
        RETURNING
          COALESCE(energy_sugar, 0) AS energy_sugar,
          COALESCE(dream_fruit_dust, 0) AS dream_fruit_dust,
          COALESCE(core_crunch_seed, 0) AS core_crunch_seed,
          COALESCE(star_gel_essence, 0) AS star_gel_essence,
          COALESCE(point, 0) AS point;
      `,
      values: [
        userId,
        rewards.energy_sugar,
        rewards.dream_fruit_dust,
        rewards.core_crunch_seed,
        rewards.star_gel_essence,
        pointReward,
      ]
      ,
      query_timeout: dbQueryTimeoutMs,
    });

    const resources = result.rows[0] ?? createEmptySurgeSnackRewards();
    return NextResponse.json({
      success: true,
      granted: rewards,
      obtainedSnack: obtainedSnackRewards,
      obtainedSnackBase: obtainedSnackBaseRewards,
      obtainedSnackMultiplierBonus: obtainedSnackMultiplierBonusRewards,
      winBonus: winBonusRewards,
      winBonusBase: winBonusBaseRewards,
      winBonusMultiplierBonus: winBonusMultiplierBonusRewards,
      pointReward,
      ...settlementPayload,
      resources: {
        energy_sugar: Number(resources.energy_sugar) || 0,
        dream_fruit_dust: Number(resources.dream_fruit_dust) || 0,
        core_crunch_seed: Number(resources.core_crunch_seed) || 0,
        star_gel_essence: Number(resources.star_gel_essence) || 0,
        point: Number(resources.point) || 0,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to apply game rewards" },
      { status: 500 }
    );
  }
}
