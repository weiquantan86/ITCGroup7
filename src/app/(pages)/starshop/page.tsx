import { cookies } from "next/headers";
import Link from "next/link";
import pool from "../../../database/client";
import StarShopClient, { type ShopCharacterOption } from "./StarShopClient";
import { characterProfiles } from "@/app/asset/entity/character/general/player/registry";
import {
  SNACK_KEYS,
  ZERO_SNACK_INVENTORY,
  type SnackInventory,
} from "../../components/gachaHandler/rateConfig";

type ResourceRow = {
  star_coin: number;
} & SnackInventory;

const profileByLabel = new Map(
  characterProfiles.map((profile) => [profile.label.toLowerCase(), profile])
);

const parseNonNegativeInt = (value: unknown) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
};

const parseSnackInventory = (row?: Record<string, unknown>): SnackInventory => {
  const parsed: SnackInventory = { ...ZERO_SNACK_INVENTORY };
  if (!row) return parsed;
  for (const key of SNACK_KEYS) {
    parsed[key] = parseNonNegativeInt(row[key]);
  }
  return parsed;
};

const ensureUserResourcesForUser = async (userId: number) => {
  await pool.query(`
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
  await pool.query(`
    ALTER TABLE user_resources
    ADD COLUMN IF NOT EXISTS star_coin INTEGER NOT NULL DEFAULT 0
  `);
  await pool.query(
    `
      INSERT INTO user_resources (user_id)
      VALUES ($1)
      ON CONFLICT (user_id) DO NOTHING
    `,
    [userId]
  );
};

function ErrorState({ message }: { message: string }) {
  return (
    <main className="min-h-screen w-full bg-[#04070d] text-slate-200">
      <div className="min-h-screen w-full bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[length:34px_34px]">
        <div className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-10 lg:px-8">
          <div className="w-full rounded-[28px] border border-slate-200/20 bg-[#0b111b]/80 p-8 text-center shadow-[0_0_44px_rgba(56,189,248,0.2)]">
            <p className="text-lg font-semibold text-slate-100">{message}</p>
            <p className="mt-2 text-sm text-slate-300">
              Please log in before visiting Star Shop.
            </p>
            <Link
              href="/userSystem/login"
              className="mt-6 inline-flex items-center justify-center rounded-full border border-slate-200/30 px-5 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-100/50 hover:bg-white/10"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

export default async function StarShopPage() {
  const cookieStore = await cookies();
  const userIdValue = cookieStore.get("user_id")?.value;
  if (!userIdValue) {
    return <ErrorState message="Load failed: no login information found." />;
  }

  const userId = Number.parseInt(userIdValue, 10);
  if (!Number.isFinite(userId) || userId <= 0) {
    return <ErrorState message="Load failed: login information is invalid." />;
  }

  let resource: ResourceRow = {
    ...ZERO_SNACK_INVENTORY,
    star_coin: 0,
  };
  let characters: ShopCharacterOption[] = [];

  try {
    await ensureUserResourcesForUser(userId);

    const resourceResult = await pool.query(
      `
        SELECT
          COALESCE(energy_sugar, 0) AS energy_sugar,
          COALESCE(dream_fruit_dust, 0) AS dream_fruit_dust,
          COALESCE(core_crunch_seed, 0) AS core_crunch_seed,
          COALESCE(star_gel_essence, 0) AS star_gel_essence,
          COALESCE(star_coin, 0) AS star_coin
        FROM user_resources
        WHERE user_id = $1
        LIMIT 1
      `,
      [userId]
    );

    if (resourceResult.rows.length > 0) {
      const row = resourceResult.rows[0] as Record<string, unknown>;
      resource = {
        ...parseSnackInventory(row),
        star_coin: parseNonNegativeInt(row.star_coin),
      };
    }

    const characterResult = await pool.query(
      `
        SELECT id, name
        FROM characters
        ORDER BY name ASC
      `
    );
    const ownedResult = await pool.query(
      `
        SELECT character_id
        FROM user_characters
        WHERE user_id = $1
      `,
      [userId]
    );
    const ownedSet = new Set<number>(
      ownedResult.rows.map((row) => parseNonNegativeInt(row.character_id))
    );

    characters = (characterResult.rows as Array<{ id: unknown; name: unknown }>)
      .map((row) => {
        const id = parseNonNegativeInt(row.id);
        const name = String(row.name ?? `Character #${id}`);
        const profile = profileByLabel.get(name.toLowerCase());
        const normalizedName = name.trim().toLowerCase().replace(/\s+/g, "_");
        return {
          id,
          name,
          modelPath: profile
            ? `/assets/characters${profile.pathToken}${profile.id}.glb`
            : `/assets/characters/${normalizedName}/${normalizedName}.glb`,
          owned: ownedSet.has(id),
        };
      })
      .filter((entry) => entry.id > 0);
  } catch (error) {
    console.error(error);
    return <ErrorState message="Load failed: unable to load star shop data." />;
  }

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[#04070d] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.038)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.038)_1px,transparent_1px)] bg-[length:36px_36px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_20%,rgba(251,146,60,0.42),transparent_36%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_14%,rgba(96,165,250,0.38),transparent_34%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_82%,rgba(217,70,239,0.34),transparent_36%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_80%,rgba(52,211,153,0.28),transparent_34%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_42%,rgba(2,6,23,0.7)_100%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1600px] flex-col px-6 py-8 lg:px-12">
        <header className="mb-6 flex items-center justify-between rounded-[24px] border border-white/10 bg-white/[0.03] px-6 py-4 backdrop-blur-md">
          <h1 className="bg-gradient-to-r from-orange-400 via-pink-500 to-cyan-300 bg-clip-text text-4xl font-black tracking-[0.12em] text-transparent md:text-5xl">
            STAR SHOP
          </h1>
          <Link
            href="/gacha"
            className="rounded-full border border-cyan-300/40 bg-cyan-500/15 px-5 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/25"
          >
            Back to Gacha
          </Link>
        </header>

        <StarShopClient
          initialInventory={{
            energy_sugar: resource.energy_sugar,
            dream_fruit_dust: resource.dream_fruit_dust,
            core_crunch_seed: resource.core_crunch_seed,
            star_gel_essence: resource.star_gel_essence,
          }}
          initialStarCoin={resource.star_coin}
          characters={characters}
        />
      </div>
    </main>
  );
}
