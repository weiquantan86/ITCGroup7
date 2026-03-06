import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import pool from "@/database/client";
import { characterProfiles } from "@/app/asset/entity/character/general/player/registry";
import { loadRateList } from "@/app/components/gachaHandler/rateListStore";
import {
  DEFAULT_SNACK_RATE_CONFIG,
  LUCKY_CHARACTER_BONUS_CHANCE,
  SNACK_BY_KEY,
  SNACK_KEYS,
  ZERO_SNACK_INVENTORY,
  type GachaDisplayReward,
  type SnackInventory,
  type SnackKey,
} from "@/app/components/gachaHandler/rateConfig";

type RollPayload = Partial<Record<(typeof SNACK_KEYS)[number], unknown>>;

const DUPLICATE_CHARACTER_STAR_COIN_BONUS = 100;

type CharacterRevealPayload = {
  characterId: string;
  characterName: string;
  modelPath: string;
  isDuplicate: boolean;
  convertedStarCoin: number;
};

type PendingCharacterDrop = {
  characterId: string;
  fallbackName: string;
  source: string;
  characterDbId?: number;
};

const toNonNegativeInt = (value: unknown) => {
  const parsed =
    typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.trunc(parsed);
};

const parseSelection = (payload: RollPayload): SnackInventory | null => {
  const parsed: SnackInventory = { ...ZERO_SNACK_INVENTORY };
  for (const key of SNACK_KEYS) {
    const count = toNonNegativeInt(payload[key]);
    if (count == null) return null;
    parsed[key] = count;
  }
  return parsed;
};

const sumInventory = (inventory: SnackInventory) =>
  SNACK_KEYS.reduce((sum, key) => sum + inventory[key], 0);

const parseResourceRow = (row?: Record<string, unknown>): SnackInventory => {
  const parsed = { ...ZERO_SNACK_INVENTORY };
  if (!row) return parsed;
  for (const key of SNACK_KEYS) {
    parsed[key] = toNonNegativeInt(row[key]) ?? 0;
  }
  return parsed;
};

const rollSnackByWeight = (weights: Record<SnackKey, number>) => {
  const totalWeight = SNACK_KEYS.reduce((sum, key) => sum + weights[key], 0);
  if (totalWeight <= 0) return null;

  let random = Math.random() * totalWeight;
  for (const key of SNACK_KEYS) {
    random -= weights[key];
    if (random <= 0) return key;
  }
  return SNACK_KEYS[SNACK_KEYS.length - 1];
};

const profileById = new Map(
  characterProfiles.map((profile) => [profile.id.toLowerCase(), profile])
);
const profileByLabel = new Map(
  characterProfiles.map((profile) => [profile.label.toLowerCase(), profile])
);

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const userIdValue = cookieStore.get("user_id")?.value;
  if (!userIdValue) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const userId = Number.parseInt(userIdValue, 10);
  if (!Number.isFinite(userId) || userId <= 0) {
    return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
  }

  let payload: RollPayload;
  try {
    payload = (await request.json()) as RollPayload;
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (payload == null || typeof payload !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const selected = parseSelection(payload);
  if (!selected) {
    return NextResponse.json(
      { error: "Selection values must be non-negative integers." },
      { status: 400 }
    );
  }

  const totalSelected = sumInventory(selected);
  if (totalSelected <= 0) {
    return NextResponse.json(
      { error: "Please select at least one snack." },
      { status: 400 }
    );
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_resources (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        energy_sugar INTEGER NOT NULL DEFAULT 0 CHECK (energy_sugar >= 0),
        dream_fruit_dust INTEGER NOT NULL DEFAULT 0 CHECK (dream_fruit_dust >= 0),
        core_crunch_seed INTEGER NOT NULL DEFAULT 0 CHECK (core_crunch_seed >= 0),
        star_gel_essence INTEGER NOT NULL DEFAULT 0 CHECK (star_gel_essence >= 0),
        star_coin INTEGER NOT NULL DEFAULT 0 CHECK (star_coin >= 0),
        point INTEGER NOT NULL DEFAULT 0 CHECK (point >= 0)
      )
    `);
    await client.query(`
      ALTER TABLE user_resources
      ADD COLUMN IF NOT EXISTS star_coin INTEGER NOT NULL DEFAULT 0
    `);
    await client.query(`
      ALTER TABLE user_resources
      ADD COLUMN IF NOT EXISTS point INTEGER NOT NULL DEFAULT 0
    `);

    const rateList = await loadRateList();

    const currentResourcesResult = await client.query(
      `
        SELECT
          energy_sugar,
          dream_fruit_dust,
          core_crunch_seed,
          star_gel_essence,
          COALESCE(star_coin, 0) AS star_coin,
          COALESCE(point, 0) AS point
        FROM user_resources
        WHERE user_id = $1
        FOR UPDATE
      `,
      [userId]
    );

    if (currentResourcesResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "User resource row not found." },
        { status: 404 }
      );
    }

    const currentResources = parseResourceRow(currentResourcesResult.rows[0]);
    for (const key of SNACK_KEYS) {
      if (selected[key] > currentResources[key]) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: `Not enough ${SNACK_BY_KEY[key].label}.` },
          { status: 400 }
        );
      }
    }

    const characterRowsResult = await client.query(
      "SELECT id, name FROM characters ORDER BY id"
    );
    const allCharacters = characterRowsResult.rows as Array<{
      id: number;
      name: string;
    }>;
    const characterIdByName = new Map<string, number>();
    allCharacters.forEach((character) => {
      characterIdByName.set(character.name.toLowerCase(), character.id);
    });

    const ownedCharactersResult = await client.query(
      `
        SELECT character_id
        FROM user_characters
        WHERE user_id = $1
        FOR UPDATE
      `,
      [userId]
    );
    const ownedCharacterIds = new Set<number>(
      ownedCharactersResult.rows.map((row) => Number(row.character_id))
    );

    const rewardsMap = new Map<string, GachaDisplayReward>();
    const addReward = (reward: GachaDisplayReward) => {
      const existing = rewardsMap.get(reward.id);
      if (!existing) {
        rewardsMap.set(reward.id, reward);
        return;
      }
      rewardsMap.set(reward.id, {
        ...existing,
        count: existing.count + reward.count,
      });
    };

    const snackGains: SnackInventory = { ...ZERO_SNACK_INVENTORY };
    let starCoinGain = 0;
    let pointGain = 0;
    const pendingCharacterDrops: PendingCharacterDrop[] = [];
    const characterReveals: CharacterRevealPayload[] = [];

    let hasEligibleSpecialRule = false;
    // Special rules are evaluated independently in configured order (once per MAKE).
    for (const rule of rateList.specialRates) {
      const requirementsSatisfied = SNACK_KEYS.every(
        (key) => selected[key] >= rule.requirements[key]
      );
      if (!requirementsSatisfied) continue;

      hasEligibleSpecialRule = true;
      if (Math.random() > rule.chance) continue;

      if (rule.reward.type === "resource") {
        if (rule.reward.resourceKey in SNACK_BY_KEY) {
          const snackKey = rule.reward.resourceKey as SnackKey;
          snackGains[snackKey] += rule.reward.count;
          addReward({
            id: `special:${rule.id}:snack:${snackKey}`,
            name: rule.reward.name,
            count: rule.reward.count,
            imagePath: rule.reward.imagePath || SNACK_BY_KEY[snackKey].imagePath,
            subtitle: `Rate Rule: ${rule.name}`,
          });
        } else if (rule.reward.resourceKey === "star_coin") {
          starCoinGain += rule.reward.count;
          addReward({
            id: `special:${rule.id}:resource:star_coin`,
            name: rule.reward.name,
            count: rule.reward.count,
            icon: rule.reward.icon || "STAR",
            subtitle: `Rate Rule: ${rule.name}`,
          });
        } else if (rule.reward.resourceKey === "point") {
          pointGain += rule.reward.count;
          addReward({
            id: `special:${rule.id}:resource:point`,
            name: rule.reward.name,
            count: rule.reward.count,
            icon: rule.reward.icon || "PTS",
            subtitle: `Rate Rule: ${rule.name}`,
          });
        }
        continue;
      }

      for (let count = 0; count < rule.reward.count; count += 1) {
        pendingCharacterDrops.push({
          characterId: rule.reward.characterId,
          fallbackName: rule.reward.name || rule.reward.characterId,
          source: `Rate Rule: ${rule.name}`,
        });
      }
    }

    const totalForBase = totalSelected;
    const rewardPacks = Math.floor(
      totalForBase / DEFAULT_SNACK_RATE_CONFIG.snacksPerReward
    );

    if (!hasEligibleSpecialRule && rewardPacks <= 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          error:
            "Selection does not match any configured rate rule. Please check gacha manager settings.",
        },
        { status: 400 }
      );
    }

    for (let i = 0; i < rewardPacks; i += 1) {
      if (Math.random() > DEFAULT_SNACK_RATE_CONFIG.dropChance) continue;
      for (let roll = 0; roll < DEFAULT_SNACK_RATE_CONFIG.rewardCount; roll += 1) {
        const rolled = rollSnackByWeight(DEFAULT_SNACK_RATE_CONFIG.weights);
        if (!rolled) continue;
        snackGains[rolled] += 1;
        addReward({
          id: `snack:${rolled}`,
          name: SNACK_BY_KEY[rolled].label,
          count: 1,
          imagePath: SNACK_BY_KEY[rolled].imagePath,
          subtitle: "Base Snack Rule",
        });
      }
    }

    if (Math.random() < LUCKY_CHARACTER_BONUS_CHANCE && allCharacters.length > 0) {
      const randomIndex = Math.floor(Math.random() * allCharacters.length);
      const randomCharacter = allCharacters[randomIndex];
      const profile = profileByLabel.get(randomCharacter.name.toLowerCase());
      pendingCharacterDrops.push({
        characterId:
          profile?.id ??
          randomCharacter.name.trim().toLowerCase().replace(/\s+/g, "_"),
        fallbackName: profile?.label ?? randomCharacter.name,
        source: "Lucky Character Bonus (0.4%)",
        characterDbId: randomCharacter.id,
      });
    }

    const resolveCharacterDrop = async (
      drop: PendingCharacterDrop,
      index: number
    ) => {
      const profileFromId = profileById.get(drop.characterId.toLowerCase());
      const profileFromName = profileByLabel.get(drop.fallbackName.toLowerCase());
      const profile = profileFromId ?? profileFromName;

      const resolvedCharacterId =
        profile?.id ?? drop.characterId.trim().toLowerCase();
      const resolvedCharacterName =
        profile?.label ?? drop.fallbackName ?? resolvedCharacterId;
      const modelPath = profile
        ? `/assets/characters${profile.pathToken}${profile.id}.glb`
        : `/assets/characters/${resolvedCharacterId}/${resolvedCharacterId}.glb`;

      const dbCharacterId =
        drop.characterDbId ??
        characterIdByName.get(resolvedCharacterName.toLowerCase()) ??
        (profile
          ? characterIdByName.get(profile.label.toLowerCase())
          : undefined);
      if (!dbCharacterId) return;

      let isDuplicate = ownedCharacterIds.has(dbCharacterId);
      if (!isDuplicate) {
        const insertResult = await client.query(
          `
            INSERT INTO user_characters (user_id, character_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
          `,
          [userId, dbCharacterId]
        );
        if (insertResult.rowCount && insertResult.rowCount > 0) {
          ownedCharacterIds.add(dbCharacterId);
          addReward({
            id: `character:${resolvedCharacterId}:${index}`,
            name: resolvedCharacterName,
            count: 1,
            icon: "CHAR",
            subtitle: drop.source,
          });
        } else {
          isDuplicate = true;
          ownedCharacterIds.add(dbCharacterId);
        }
      }

      if (isDuplicate) {
        starCoinGain += DUPLICATE_CHARACTER_STAR_COIN_BONUS;
        addReward({
          id: `duplicate-character:${resolvedCharacterId}:star_coin`,
          name: "Star Coin",
          count: DUPLICATE_CHARACTER_STAR_COIN_BONUS,
          icon: "STAR",
          subtitle: `Duplicate: ${resolvedCharacterName}`,
        });
      }

      characterReveals.push({
        characterId: resolvedCharacterId,
        characterName: resolvedCharacterName,
        modelPath,
        isDuplicate,
        convertedStarCoin: isDuplicate ? DUPLICATE_CHARACTER_STAR_COIN_BONUS : 0,
      });
    };

    for (let i = 0; i < pendingCharacterDrops.length; i += 1) {
      await resolveCharacterDrop(pendingCharacterDrops[i], i);
    }

    const updatedResourcesResult = await client.query(
      `
        UPDATE user_resources
        SET
          energy_sugar = energy_sugar - $2 + $6,
          dream_fruit_dust = dream_fruit_dust - $3 + $7,
          core_crunch_seed = core_crunch_seed - $4 + $8,
          star_gel_essence = star_gel_essence - $5 + $9,
          star_coin = COALESCE(star_coin, 0) + $10,
          point = COALESCE(point, 0) + $11
        WHERE user_id = $1
        RETURNING
          COALESCE(energy_sugar, 0) AS energy_sugar,
          COALESCE(dream_fruit_dust, 0) AS dream_fruit_dust,
          COALESCE(core_crunch_seed, 0) AS core_crunch_seed,
          COALESCE(star_gel_essence, 0) AS star_gel_essence
      `,
      [
        userId,
        selected.energy_sugar,
        selected.dream_fruit_dust,
        selected.core_crunch_seed,
        selected.star_gel_essence,
        snackGains.energy_sugar,
        snackGains.dream_fruit_dust,
        snackGains.core_crunch_seed,
        snackGains.star_gel_essence,
        starCoinGain,
        pointGain,
      ]
    );

    await client.query("COMMIT");

    const rewards = Array.from(rewardsMap.values());
    const inventory = parseResourceRow(updatedResourcesResult.rows[0]);

    return NextResponse.json({
      success: true,
      used: selected,
      rewards,
      inventory,
      characterReveals,
      message:
        rewards.length > 0
          ? "Rewards granted based on RateList configuration."
          : "No rewards dropped from this roll.",
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(rollbackError);
    }
    console.error(error);
    return NextResponse.json(
      { error: "Failed to roll snack rewards" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
