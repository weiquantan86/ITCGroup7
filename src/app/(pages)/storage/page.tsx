import Link from "next/link";
import { cookies } from "next/headers";
import pool from "../../../database/client";

type ResourceRow = {
  energy_sugar: number;
  dream_fruit_dust: number;
  core_crunch_seed: number;
  star_gel_essence: number;
  point: number;
};

type ResourceCard = {
  key: keyof ResourceRow;
  name: string;
  imagePath: string;
  chipClass: string;
  glowClass: string;
};

const resourceCards: ResourceCard[] = [
  {
    key: "energy_sugar",
    name: "Energy Sugar",
    imagePath: "/snack/energy-sugar.svg",
    chipClass:
      "bg-gradient-to-r from-cyan-400/25 to-sky-500/25 text-cyan-200 border-cyan-300/30",
    glowClass: "shadow-[0_0_26px_rgba(56,189,248,0.18)]",
  },
  {
    key: "dream_fruit_dust",
    name: "Dream Fruit Dust",
    imagePath: "/snack/dream-fruit-dust.svg",
    chipClass:
      "bg-gradient-to-r from-fuchsia-400/25 to-pink-500/25 text-fuchsia-200 border-fuchsia-300/30",
    glowClass: "shadow-[0_0_26px_rgba(217,70,239,0.2)]",
  },
  {
    key: "core_crunch_seed",
    name: "Core Crunch Seed",
    imagePath: "/snack/core-crunch-seed.svg",
    chipClass:
      "bg-gradient-to-r from-amber-300/25 to-yellow-500/25 text-amber-100 border-amber-300/30",
    glowClass: "shadow-[0_0_26px_rgba(245,158,11,0.2)]",
  },
  {
    key: "star_gel_essence",
    name: "Star Gel Essence",
    imagePath: "/snack/star-gel-essence.svg",
    chipClass:
      "bg-gradient-to-r from-teal-300/25 to-cyan-500/25 text-teal-100 border-teal-300/30",
    glowClass: "shadow-[0_0_26px_rgba(45,212,191,0.2)]",
  },
  {
    key: "point",
    name: "Point",
    imagePath: "/snack/point.svg",
    chipClass:
      "bg-gradient-to-r from-slate-300/25 to-zinc-300/25 text-slate-100 border-slate-200/30",
    glowClass: "shadow-[0_0_26px_rgba(148,163,184,0.2)]",
  },
];

function ErrorState({ message }: { message: string }) {
  return (
    <main className="min-h-screen w-full bg-[#06080b] text-slate-200">
      <div className="min-h-screen w-full bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[length:32px_32px]">
        <div className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-10 lg:px-8">
          <div className="w-full rounded-[28px] border border-slate-200/20 bg-[#0b1016]/80 p-8 text-center shadow-[0_0_40px_rgba(70,120,210,0.18)]">
            <p className="text-lg font-semibold text-slate-100">{message}</p>
            <p className="mt-2 text-sm text-slate-300">
              Please log in before entering storage.
            </p>
            <a
              href="/userSystem/login"
              className="mt-6 inline-flex items-center justify-center rounded-full border border-slate-200/30 px-5 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-100/50 hover:bg-white/10"
            >
              Back to Login
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}

export default async function StoragePage() {
  const cookieStore = await cookies();
  const userIdValue = cookieStore.get("user_id")?.value;
  if (!userIdValue) {
    return <ErrorState message="Load failed: no login information found." />;
  }

  const userId = Number.parseInt(userIdValue, 10);
  if (!Number.isFinite(userId)) {
    return <ErrorState message="Load failed: login information is invalid." />;
  }

  let resource: ResourceRow = {
    energy_sugar: 0,
    dream_fruit_dust: 0,
    core_crunch_seed: 0,
    star_gel_essence: 0,
    point: 0,
  };

  try {
    const result = await pool.query(
      `
        SELECT
          COALESCE(energy_sugar, 0) AS energy_sugar,
          COALESCE(dream_fruit_dust, 0) AS dream_fruit_dust,
          COALESCE(core_crunch_seed, 0) AS core_crunch_seed,
          COALESCE(star_gel_essence, 0) AS star_gel_essence,
          COALESCE(point, 0) AS point
        FROM user_resources
        WHERE user_id = $1
        LIMIT 1
      `,
      [userId]
    );
    if (result.rows.length > 0) {
      resource = result.rows[0] as ResourceRow;
    }
  } catch (error) {
    console.error(error);
    return <ErrorState message="Load failed: unable to read user resources." />;
  }

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[#05070d] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)] bg-[length:38px_38px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_28%,rgba(251,146,60,0.52),transparent_44%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,rgba(96,165,250,0.44),transparent_42%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,23,0.12)_0%,rgba(2,6,23,0.66)_48%,rgba(2,6,23,0.88)_66%,rgba(2,6,23,0.95)_100%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col justify-center px-6 py-12 lg:px-10">
        <section className="text-center">
          <h1 className="mx-auto max-w-5xl bg-gradient-to-r from-orange-500 via-pink-500 to-sky-400 bg-clip-text text-5xl font-bold tracking-tight text-transparent md:text-7xl">
            My Storage
          </h1>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/userSystem/user"
              className="inline-flex h-14 items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-pink-500 px-9 text-lg font-semibold text-white shadow-[0_10px_38px_rgba(236,72,153,0.38)] transition hover:scale-[1.02] hover:brightness-105"
            >
              Back to User Home
            </Link>
            <Link
              href="/gacha"
              className="inline-flex h-14 items-center justify-center rounded-full bg-gradient-to-r from-sky-500 to-cyan-400 px-9 text-lg font-semibold text-white shadow-[0_10px_38px_rgba(14,165,233,0.36)] transition hover:scale-[1.02] hover:brightness-105"
            >
              Snack Gacha
            </Link>
          </div>
        </section>

        <section className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-12">
          {resourceCards.map((card, index) => (
            <article
              key={card.key}
              className={`group relative overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-md transition hover:-translate-y-0.5 hover:border-white/25 lg:col-span-4 ${
                index === 3 ? "lg:col-start-3" : ""
              } ${index === 4 ? "lg:col-start-7" : ""} ${card.glowClass}`}
            >
              <div className="absolute inset-[6px] rounded-[18px] border border-white/10" />
              <div className="relative z-10 flex flex-col items-center text-center">
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${card.chipClass}`}
                >
                  {card.name}
                </span>
                <div className="mt-4 flex h-20 w-20 items-center justify-center rounded-2xl border border-white/15 bg-black/25 shadow-[inset_0_0_26px_rgba(255,255,255,0.08)]">
                  <img
                    src={card.imagePath}
                    alt={card.name}
                    className="h-14 w-14 drop-shadow-[0_0_14px_rgba(255,255,255,0.45)]"
                  />
                </div>
                <p className="mt-4 text-3xl font-bold text-white">{resource[card.key]}</p>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
