import Link from "next/link";
import { cookies } from "next/headers";
import pool from "../../../../database/client";
import { characterProfiles } from "../../../asset/entity/character/general/player/registry";
import MadaCombatClient from "./MadaCombatClient";

type SelectedCharacter = {
  id: string;
  label: string;
  path: string;
};

function ErrorState({ message }: { message: string }) {
  return (
    <main className="min-h-screen w-full bg-[#04090d] text-slate-200">
      <div className="min-h-screen w-full bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[length:34px_34px]">
        <div className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-10 lg:px-8">
          <div className="w-full rounded-[28px] border border-cyan-300/20 bg-[#081117]/85 p-8 text-center shadow-[0_0_40px_rgba(34,211,238,0.18)]">
            <p className="text-lg font-semibold text-slate-100">{message}</p>
            <p className="mt-2 text-sm text-slate-300">
              Please unlock a character before entering the lab.
            </p>
            <Link
              href="/characterManagement"
              className="mt-6 inline-flex items-center justify-center rounded-full border border-slate-200/30 px-5 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-100/50 hover:bg-white/10"
            >
              Back to Character Management
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

const buildCharacterPath = (characterId: string) => {
  const profile = characterProfiles.find((entry) => entry.id === characterId);
  if (!profile) return "";
  return `/assets/characters${profile.pathToken}${profile.id}.glb`;
};

const buildSelectedCharacter = (characterId: string): SelectedCharacter | null => {
  const profile = characterProfiles.find((entry) => entry.id === characterId);
  if (!profile) return null;
  return {
    id: profile.id,
    label: profile.label,
    path: buildCharacterPath(profile.id),
  };
};

export default async function MadaCombatPage() {
  const cookieStore = await cookies();
  const userIdValue = cookieStore.get("user_id")?.value;
  if (!userIdValue) {
    return <ErrorState message="Load failed: no login information found." />;
  }

  const userId = Number.parseInt(userIdValue, 10);
  if (!Number.isFinite(userId)) {
    return <ErrorState message="Load failed: login information is invalid." />;
  }

  try {
    const { rows } = await pool.query<{ id: string }>(
      `
        SELECT LOWER(c.name) AS id
        FROM user_characters uc
        JOIN characters c ON c.id = uc.character_id
        WHERE uc.user_id = $1
        ORDER BY c.name;
      `,
      [userId]
    );
    const ownedSet = new Set(rows.map((row) => row.id));
    const fallbackCharacterId =
      characterProfiles.find((profile) => ownedSet.has(profile.id))?.id ?? "";
    if (!fallbackCharacterId) {
      return (
        <ErrorState message="Load failed: no unlocked characters for this account." />
      );
    }

    const selectedCharacterIdFromCookie =
      cookieStore.get("selected_character_id")?.value?.toLowerCase() ?? "";
    const selectedCharacterId = ownedSet.has(selectedCharacterIdFromCookie)
      ? selectedCharacterIdFromCookie
      : fallbackCharacterId;
    const selectedCharacter = buildSelectedCharacter(selectedCharacterId);
    if (!selectedCharacter?.path) {
      return <ErrorState message="Load failed: selected character asset is missing." />;
    }

    return <MadaCombatClient selectedCharacter={selectedCharacter} />;
  } catch (error) {
    console.error(error);
    return (
      <ErrorState message="Load failed: unable to read character ownership." />
    );
  }
}
