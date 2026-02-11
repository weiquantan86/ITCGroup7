import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import pool from "../../../../database/client";
import { characterProfiles } from "../../../asset/entity/character/player/registry";
import {
  CHARACTER_RARITY,
  RARITY_CONFIG,
  getCharacterRarity,
} from "../../../asset/entity/character/gachaConfig";

export async function POST() {
  const cookieStore = await cookies();
  const userIdValue = cookieStore.get("user_id")?.value;

  if (!userIdValue) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const userId = parseInt(userIdValue, 10);
  if (isNaN(userId)) {
    return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
  }

  try {
    // 1. Get owned characters
    const ownedResult = await pool.query(
      `SELECT LOWER(c.name) as id FROM user_characters uc
       JOIN characters c ON c.id = uc.character_id
       WHERE uc.user_id = $1`,
      [userId]
    );
    const ownedIds = new Set(ownedResult.rows.map((r) => r.id));

    // 2. Determine pool of unowned characters (excluding Adam if not owned, though he should be default)
    // Adam is default, so we usually exclude him from Gacha anyway.
    const poolCandidates = characterProfiles.filter((profile) => {
      const id = profile.id.toLowerCase();
      if (id === "adam") return false; // Never roll Adam
      return !ownedIds.has(id);
    });

    if (poolCandidates.length === 0) {
      return NextResponse.json({
        success: false,
        message: "All characters unlocked!",
        allUnlocked: true,
      });
    }

    // 3. Calculate weights
    let totalWeight = 0;
    const weightedPool = poolCandidates.map((profile) => {
      const rarity = getCharacterRarity(profile.id);
      const weight = RARITY_CONFIG[rarity].weight;
      totalWeight += weight;
      return { profile, weight, rarity };
    });

    // 4. Roll
    let random = Math.random() * totalWeight;
    let selected = weightedPool[0];

    for (const candidate of weightedPool) {
      if (random < candidate.weight) {
        selected = candidate;
        break;
      }
      random -= candidate.weight;
    }

    // 5. Grant character
    // We need the DB ID for the character name
    // Assuming DB names are Capitalized (Adam, Grant) but IDs are lowercase (adam, grant)
    // We need to map back or query carefully. DB names seem to be Title Case in initDB.
    
    // Let's query the ID for the name
    // profile.label is usually "Adam", "Grant".
    const charName = selected.profile.label; 
    
    const charDbResult = await pool.query(
      "SELECT id FROM characters WHERE name = $1",
      [charName]
    );

    if (charDbResult.rows.length === 0) {
      throw new Error(`Character ${charName} not found in database`);
    }

    const charDbId = charDbResult.rows[0].id;

    await pool.query(
      "INSERT INTO user_characters (user_id, character_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [userId, charDbId]
    );

    return NextResponse.json({
      success: true,
      character: {
        id: selected.profile.id,
        name: selected.profile.label,
        rarity: selected.rarity,
        rarityLabel: RARITY_CONFIG[selected.rarity].label,
        rarityColor: RARITY_CONFIG[selected.rarity].color,
        pathToken: selected.profile.pathToken,
      },
    });
  } catch (error) {
    console.error("Gacha error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
