import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import pool from "../../../../../database/client";
import {
  SURGE_TOTAL_MONSTERS,
  SURGE_SNACK_KEYS,
  createEmptySurgeSnackRewards,
  resolveSurgeRewardPacksFromKills,
  type SurgeSnackRewards,
} from "../../../../(pages)/(games)/mochiSoldierSurge/surgeConfig";

type RewardRequestBody = {
  defeatedMonsters?: number;
  victory?: boolean;
};

const normalizeDefeatedCount = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(500, Math.floor(parsed)));
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

  const defeatedMonsters = normalizeDefeatedCount(body.defeatedMonsters);
  const isVictory =
    Boolean(body.victory) && defeatedMonsters >= SURGE_TOTAL_MONSTERS;
  const killRewardPacks = resolveSurgeRewardPacksFromKills(defeatedMonsters);
  const victoryBonus = isVictory ? 3 : 0;
  const obtainedSnackRewards = rollRewards(killRewardPacks);
  const winBonusRewards = rollRewards(victoryBonus);
  const rewards = mergeRewards(obtainedSnackRewards, winBonusRewards);

  const totalReward = SURGE_SNACK_KEYS.reduce(
    (total, key) => total + rewards[key],
    0
  );
  if (totalReward <= 0) {
    return NextResponse.json({
      success: true,
      granted: rewards,
      obtainedSnack: obtainedSnackRewards,
      winBonus: winBonusRewards,
      defeatedMonsters,
      killRewardPacks,
      victoryBonus,
      skipped: true,
    });
  }

  try {
    const result = await pool.query(
      `
        INSERT INTO user_resources (
          user_id,
          energy_sugar,
          dream_fruit_dust,
          core_crunch_seed,
          star_gel_essence
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id)
        DO UPDATE SET
          energy_sugar = user_resources.energy_sugar + EXCLUDED.energy_sugar,
          dream_fruit_dust = user_resources.dream_fruit_dust + EXCLUDED.dream_fruit_dust,
          core_crunch_seed = user_resources.core_crunch_seed + EXCLUDED.core_crunch_seed,
          star_gel_essence = user_resources.star_gel_essence + EXCLUDED.star_gel_essence
        RETURNING
          COALESCE(energy_sugar, 0) AS energy_sugar,
          COALESCE(dream_fruit_dust, 0) AS dream_fruit_dust,
          COALESCE(core_crunch_seed, 0) AS core_crunch_seed,
          COALESCE(star_gel_essence, 0) AS star_gel_essence;
      `,
      [
        userId,
        rewards.energy_sugar,
        rewards.dream_fruit_dust,
        rewards.core_crunch_seed,
        rewards.star_gel_essence,
      ]
    );

    const resources = result.rows[0] ?? createEmptySurgeSnackRewards();
    return NextResponse.json({
      success: true,
      granted: rewards,
      obtainedSnack: obtainedSnackRewards,
      winBonus: winBonusRewards,
      defeatedMonsters,
      killRewardPacks,
      victoryBonus,
      resources: {
        energy_sugar: Number(resources.energy_sugar) || 0,
        dream_fruit_dust: Number(resources.dream_fruit_dust) || 0,
        core_crunch_seed: Number(resources.core_crunch_seed) || 0,
        star_gel_essence: Number(resources.star_gel_essence) || 0,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to apply mochisoldiersurge rewards" },
      { status: 500 }
    );
  }
}
