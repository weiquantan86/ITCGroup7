"use client";

import { useEffect, useMemo, useState } from "react";
import type { GachaDisplayReward } from "./rateConfig";

type GachaResultProps = {
  rewards: GachaDisplayReward[];
  message?: string;
  onClose: () => void;
};

export default function GachaResult({ rewards, message, onClose }: GachaResultProps) {
  const entries = useMemo(
    () => rewards.filter((reward) => reward.count > 0),
    [rewards]
  );
  const [revealed, setRevealed] = useState<boolean[]>(
    Array.from({ length: entries.length }, () => false)
  );

  useEffect(() => {
    setRevealed(Array.from({ length: entries.length }, () => false));
    entries.forEach((_, index) => {
      window.setTimeout(() => {
        setRevealed((current) =>
          current.map((visible, i) => (i === index ? true : visible))
        );
      }, 260 + index * 180);
    });
  }, [entries]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />

      <div
        className="relative mx-6 w-full max-w-md rounded-[32px] border border-white/15 bg-[#060b14] px-8 py-10 shadow-[0_0_100px_rgba(167,139,250,0.45)]"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-slate-400 transition hover:border-white/40 hover:text-white"
        >
          x
        </button>

        <h2
          className="mb-1 text-center text-3xl font-black tracking-wide"
          style={{
            background: "linear-gradient(135deg, #fb923c, #f472b6, #a78bfa, #60a5fa)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Snack Pack Opened!
        </h2>
        <p className="mb-6 text-center text-xs font-semibold uppercase tracking-widest text-slate-600">
          {message || "Here is what you got"}
        </p>

        {entries.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-6 text-center text-sm text-slate-300">
            No snack dropped this time.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {entries.map((reward, index) => (
              <div
                key={reward.id}
                className="flex items-center gap-4 rounded-2xl border border-sky-300/30 bg-sky-400/5 px-5 py-4"
                style={{
                  opacity: revealed[index] ? 1 : 0,
                  transform: revealed[index] ? "translateY(0)" : "translateY(12px)",
                  transition: "all 0.45s cubic-bezier(0.22,1,0.36,1)",
                  boxShadow: revealed[index]
                    ? "0 0 18px rgba(56,189,248,0.35)"
                    : "none",
                }}
              >
                {reward.imagePath ? (
                  <img
                    src={reward.imagePath}
                    alt={reward.name}
                    className="h-10 w-10 object-contain"
                  />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-sky-300/40 bg-sky-400/10 text-xs font-black text-sky-100">
                    {reward.icon || "RWD"}
                  </span>
                )}
                <div className="flex-1">
                  <p className="font-bold text-white">{reward.name}</p>
                  <p className="text-[11px] font-black tracking-widest text-sky-300">
                    {reward.subtitle || "GACHA REWARD"}
                  </p>
                </div>
                <span className="text-xl font-black text-white">x{reward.count}</span>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-8 w-full rounded-full py-4 text-base font-black tracking-[0.2em] text-white transition hover:brightness-110 active:scale-95"
          style={{
            background: "linear-gradient(135deg, #f472b6, #a78bfa, #60a5fa)",
            boxShadow: "0 0 32px rgba(167,139,250,0.55)",
          }}
        >
          COLLECT
        </button>
      </div>
    </div>
  );
}
