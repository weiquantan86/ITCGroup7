"use client";

import { useState } from "react";
import { SNACK_DEFINITIONS, type SpecialRateEntry } from "./rateConfig";

type GachaManualProps = {
  onClose: () => void;
  snacksPerReward: number;
  specialRates: SpecialRateEntry[];
};

const buildRequirementText = (rule: SpecialRateEntry) => {
  const parts = SNACK_DEFINITIONS.filter(
    (snack) => rule.requirements[snack.key] > 0
  ).map((snack) => `${snack.label} x${rule.requirements[snack.key]}`);
  return parts.length > 0 ? parts.join(" + ") : "No requirement";
};

const buildRewardText = (rule: SpecialRateEntry) => {
  if (rule.reward.type === "character") {
    return `Character: ${rule.reward.name} x${rule.reward.count}`;
  }
  return `${rule.reward.name} x${rule.reward.count}`;
};

export default function GachaManual({
  onClose,
  snacksPerReward,
  specialRates,
}: GachaManualProps) {
  const [showSpecialEvents, setShowSpecialEvents] = useState(false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" />

      <div
        className="relative mx-6 w-full max-w-lg rounded-[32px] border border-white/15 bg-[#080d18] px-10 py-10 text-center shadow-[0_0_80px_rgba(167,139,250,0.35)]"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-slate-400 transition hover:border-white/40 hover:text-white"
        >
          x
        </button>

        <h2 className="mb-8 bg-gradient-to-r from-orange-400 via-pink-500 to-sky-400 bg-clip-text text-3xl font-black italic tracking-wide text-transparent drop-shadow-[0_0_20px_rgba(236,72,153,0.4)]">
          Snack Workshop Guide
        </h2>

        <p
          className="mb-8 text-lg font-semibold leading-relaxed"
          style={{
            background:
              "linear-gradient(135deg, #fb923c 0%, #f472b6 30%, #a78bfa 60%, #60a5fa 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Welcome to Snack Workshop! Here you can freely choose the quantity
          and ratio of snacks to create snack packs. The snack packs you create
          can drop random resources and random items! Your snack packs might
          even attract some greedy characters!
        </p>

        <div className="mb-6 h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent" />

        <p className="text-base font-black tracking-wide text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.6)]">
          Note: You need at least {snacksPerReward} snacks to make a snack pack!
        </p>

        <button
          type="button"
          onClick={() => setShowSpecialEvents(true)}
          className="mt-6 rounded-full border border-cyan-300/45 bg-cyan-500/20 px-6 py-3 text-base font-bold tracking-wide text-cyan-100 transition hover:bg-cyan-500/35"
        >
          Special Event List
        </button>

        {showSpecialEvents ? (
          <div
            className="absolute inset-0 z-20 flex items-center justify-center rounded-[32px] bg-black/80 px-4 py-4"
            onClick={(event) => {
              event.stopPropagation();
              setShowSpecialEvents(false);
            }}
          >
            <div
              className="max-h-[78vh] w-full rounded-2xl border border-cyan-300/35 bg-[#050a13] px-5 py-5 text-left shadow-[0_0_45px_rgba(34,211,238,0.25)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-black tracking-wide text-cyan-200">
                  Admin Special Events
                </h3>
                <button
                  type="button"
                  onClick={() => setShowSpecialEvents(false)}
                  className="rounded-full border border-white/30 px-3 py-1 text-sm font-semibold text-white transition hover:bg-white/15"
                >
                  Close
                </button>
              </div>

              {specialRates.length === 0 ? (
                <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 text-base text-slate-300">
                  No special events configured by admin yet.
                </p>
              ) : (
                <div className="max-h-[62vh] space-y-3 overflow-y-auto pr-1">
                  {specialRates.map((rule) => (
                    <div
                      key={rule.id}
                      className="rounded-xl border border-cyan-300/20 bg-cyan-400/5 px-4 py-4"
                    >
                      <p className="text-lg font-bold text-white">{rule.name}</p>
                      <p className="mt-1 text-sm font-semibold text-cyan-200">
                        Chance: {(rule.chance * 100).toFixed(4)}%
                      </p>
                      <p className="mt-2 text-sm text-slate-200">
                        Condition: {buildRequirementText(rule)}
                      </p>
                      <p className="mt-1 text-sm text-slate-200">
                        Reward: {buildRewardText(rule)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
