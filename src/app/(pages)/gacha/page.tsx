import { cookies } from "next/headers";
import pool from "../../../database/client";
import { loadRateList } from "@/app/components/gachaHandler/rateListStore";
import GachaClient from "./GachaClient";
import type { SnackInventory } from "../../components/gachaHandler/SnackMixer";
import {
  DEFAULT_GACHA_RATE_LIST,
  type GachaRateList,
} from "../../components/gachaHandler/rateConfig";

const ZERO_INVENTORY: SnackInventory = {
  energy_sugar: 0,
  dream_fruit_dust: 0,
  core_crunch_seed: 0,
  star_gel_essence: 0,
};

async function ensureUserResourcesForUser(userId: number) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_resources (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      energy_sugar INTEGER NOT NULL DEFAULT 0 CHECK (energy_sugar >= 0),
      dream_fruit_dust INTEGER NOT NULL DEFAULT 0 CHECK (dream_fruit_dust >= 0),
      core_crunch_seed INTEGER NOT NULL DEFAULT 0 CHECK (core_crunch_seed >= 0),
      star_gel_essence INTEGER NOT NULL DEFAULT 0 CHECK (star_gel_essence >= 0),
      star_coin INTEGER NOT NULL DEFAULT 0 CHECK (star_coin >= 0),
      point INTEGER NOT NULL DEFAULT 0 CHECK (point >= 0)
    );
  `);

  await pool.query(
    `
      INSERT INTO user_resources (user_id)
      VALUES ($1)
      ON CONFLICT (user_id) DO NOTHING;
    `,
    [userId]
  );
}

export default async function GachaPage() {
  let inventory: SnackInventory = ZERO_INVENTORY;
  let rateList: GachaRateList = DEFAULT_GACHA_RATE_LIST;

  try {
    const cookieStore = await cookies();
    const userIdValue = cookieStore.get("user_id")?.value;
    if (userIdValue) {
      const userId = Number.parseInt(userIdValue, 10);
      if (Number.isFinite(userId)) {
        await ensureUserResourcesForUser(userId);

        const result = await pool.query(
          `SELECT
            COALESCE(energy_sugar, 0)     AS energy_sugar,
            COALESCE(dream_fruit_dust, 0) AS dream_fruit_dust,
            COALESCE(core_crunch_seed, 0) AS core_crunch_seed,
            COALESCE(star_gel_essence, 0) AS star_gel_essence
          FROM user_resources WHERE user_id = $1 LIMIT 1`,
          [userId]
        );
        if (result.rows.length > 0) {
          inventory = result.rows[0] as SnackInventory;
        }
      }
    }

    rateList = await loadRateList();
  } catch (error) {
    console.error(error);
  }

  return (
    <main className="relative h-screen w-full overflow-hidden bg-[#05070d] text-slate-100">
      {/* grid dots */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)] bg-[length:38px_38px]" />
      {/* rainbow radial glows */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_20%,rgba(251,146,60,0.52),transparent_40%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_88%_16%,rgba(96,165,250,0.46),transparent_40%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_82%,rgba(167,139,250,0.40),transparent_40%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_86%_80%,rgba(52,211,153,0.38),transparent_40%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(236,72,153,0.18),transparent_55%)]" />
      {/* subtle vignette */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(2,4,10,0.55)_100%)]" />

      <div className="relative mx-auto flex h-full w-full max-w-[1920px] flex-col px-6 py-6 lg:px-12">
        {/* rainbow title */}
        <div className="flex items-center justify-center pb-4 pt-2">
          <h1 className="bg-gradient-to-r from-orange-400 via-pink-500 to-sky-400 bg-clip-text text-5xl font-bold italic tracking-[0.18em] text-transparent drop-shadow-[0_0_28px_rgba(236,72,153,0.4)] md:text-6xl">
            Snack Gacha
          </h1>
        </div>

        {/* main card - fills remaining height */}
        <div className="min-h-0 flex-1 overflow-hidden rounded-[36px] border border-white/10 bg-white/[0.03] shadow-[0_0_60px_rgba(59,130,246,0.2)] backdrop-blur-md">
          <GachaClient inventory={inventory} rateList={rateList} />
        </div>
      </div>
    </main>
  );
}
