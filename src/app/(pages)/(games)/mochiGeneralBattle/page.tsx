import { cookies } from "next/headers";
import pool from "../../../../database/client";
import { characterProfiles } from "../../../asset/entity/character/general/player/registry";
import MochiGeneralBattleClient from "./MochiGeneralBattleClient";

type GameCharacterOption = {
  id: string;
  label: string;
  path: string;
  basicAttackDescription: string;
  skills: Array<{
    key: "q" | "e" | "r";
    label: string;
    description: string;
  }>;
};

const buildCharacterOption = (
  profile: (typeof characterProfiles)[number]
): GameCharacterOption => ({
  id: profile.id,
  label: profile.label,
  path: `/assets/characters${profile.pathToken}${profile.id}.glb`,
  basicAttackDescription: profile.kit?.basicAttack?.description || "No description.",
  skills: (["q", "e", "r"] as const).map((key) => ({
    key,
    label: profile.kit?.skills?.[key]?.label || key.toUpperCase(),
    description: profile.kit?.skills?.[key]?.description || "No description.",
  })),
});

const loadOwnedCharacterIds = async (): Promise<Set<string>> => {
  const cookieStore = await cookies();
  const userIdValue = cookieStore.get("user_id")?.value;
  if (!userIdValue) return new Set();

  const userId = Number.parseInt(userIdValue, 10);
  if (!Number.isFinite(userId)) return new Set();

  try {
    const { rows } = await pool.query(
      `
        SELECT LOWER(c.name) AS id
        FROM user_characters uc
        JOIN characters c ON c.id = uc.character_id
        WHERE uc.user_id = $1
        ORDER BY c.name;
      `,
      [userId]
    );
    return new Set(rows.map((row) => row.id));
  } catch (error) {
    console.error(error);
    return new Set();
  }
};

export default async function MochiGeneralBattlePage() {
  const ownedSet = await loadOwnedCharacterIds();
  const allOptions = characterProfiles.map(buildCharacterOption);
  const characterOptions = allOptions.filter((option) => ownedSet.has(option.id));

  return <MochiGeneralBattleClient characterOptions={characterOptions} />;
}
