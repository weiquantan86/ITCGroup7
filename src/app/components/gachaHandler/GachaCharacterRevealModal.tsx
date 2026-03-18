"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const CharacterScene = dynamic(
  () => import("@/app/(pages)/characterManagement/characterScene/CharacterScene"),
  { ssr: false }
);

export type CharacterRevealInfo = {
  characterId: string;
  characterName: string;
  modelPath: string;
  isDuplicate: boolean;
  convertedStarCoin: number;
};

type GachaCharacterRevealModalProps = {
  reveal: CharacterRevealInfo;
  index: number;
  total: number;
  onClose: () => void;
};

const FLICKER_MS = 2000;

export default function GachaCharacterRevealModal({
  reveal,
  index,
  total,
  onClose,
}: GachaCharacterRevealModalProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    const timer = window.setTimeout(() => setReady(true), FLICKER_MS);
    return () => window.clearTimeout(timer);
  }, [index, reveal.characterId, reveal.characterName, reveal.modelPath, reveal.isDuplicate]);

  return (
    <div className="fixed inset-0 z-[340] flex items-center justify-center px-4 py-6">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" />

      <div className="relative w-full max-w-[1200px] overflow-hidden rounded-[32px] border border-cyan-200/25 bg-[#080c17] shadow-[0_0_120px_rgba(56,189,248,0.25)]">
        {!ready ? (
          <div className="relative h-[620px] overflow-hidden bg-black">
            <div className="absolute inset-0 animate-tv-screen bg-[radial-gradient(circle,rgba(210,235,255,0.2)_0%,rgba(60,120,180,0.18)_36%,rgba(8,12,22,0.88)_72%)]" />
            <div className="absolute inset-0 animate-tv-noise bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.12)_0px,rgba(255,255,255,0.12)_1px,rgba(255,255,255,0)_2px,rgba(255,255,255,0)_4px)] opacity-55 mix-blend-screen" />
            <div className="absolute inset-0 animate-tv-bars bg-[linear-gradient(90deg,rgba(255,0,60,0.2)_0%,rgba(0,255,255,0.2)_35%,rgba(255,255,255,0)_70%)]" />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <p className="animate-tv-text text-sm font-black tracking-[0.32em] text-cyan-100">
                SIGNAL TUNING
              </p>
              <p className="mt-5 text-lg font-semibold text-slate-200">
                Decoding character signal...
              </p>
            </div>
          </div>
        ) : (
          <div className="relative px-8 pb-8 pt-8 md:px-10 md:pb-10 md:pt-9">
            <h3 className="text-center text-4xl font-black leading-tight text-transparent md:text-5xl bg-gradient-to-r from-orange-400 via-pink-500 via-violet-400 to-cyan-300 bg-clip-text drop-shadow-[0_0_24px_rgba(236,72,153,0.35)]">
              Congratulations! You got: {reveal.characterName}
            </h3>

            <div className="relative mt-6 h-[420px] w-full overflow-hidden rounded-2xl border border-cyan-300/30 bg-[#070b12] md:h-[500px]">
              <CharacterScene characterPath={reveal.modelPath} />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(251,146,60,0.26),transparent_42%),radial-gradient(circle_at_82%_18%,rgba(96,165,250,0.26),transparent_40%),radial-gradient(circle_at_15%_82%,rgba(236,72,153,0.2),transparent_45%),radial-gradient(circle_at_84%_80%,rgba(52,211,153,0.2),transparent_44%)] opacity-65 mix-blend-screen" />
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0)_35%,rgba(255,255,255,0.08)_100%)]" />
            </div>

            {reveal.isDuplicate ? (
              <p className="mt-6 rounded-xl border border-amber-300/35 bg-amber-500/10 px-5 py-4 text-center text-lg font-semibold text-amber-100">
                You already own this character, so it has been converted into{" "}
                {reveal.convertedStarCoin} Star Coin.
              </p>
            ) : (
              <p className="mt-6 rounded-xl border border-emerald-300/35 bg-emerald-500/10 px-5 py-4 text-center text-lg font-semibold text-emerald-100">
                This character has been added to your collection.
              </p>
            )}

            <div className="mt-7 flex justify-center">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-cyan-300/45 bg-cyan-500/20 px-12 py-4 text-lg font-black tracking-[0.18em] text-cyan-50 transition hover:brightness-110 active:scale-95"
              >
                CONTINUE
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .animate-tv-screen {
          animation: tvFlicker 130ms steps(2, end) infinite;
        }

        .animate-tv-noise {
          animation: tvNoise 210ms steps(2, end) infinite;
        }

        .animate-tv-bars {
          animation: tvBars 0.6s linear infinite;
        }

        .animate-tv-text {
          animation: tvText 0.28s steps(2, end) infinite;
        }

        @keyframes tvFlicker {
          0% {
            opacity: 0.3;
            filter: contrast(1.1) brightness(0.9);
          }
          20% {
            opacity: 0.92;
            filter: contrast(1.35) brightness(1.12);
          }
          46% {
            opacity: 0.42;
            filter: contrast(1.08) brightness(0.8);
          }
          72% {
            opacity: 0.86;
            filter: contrast(1.28) brightness(1.16);
          }
          100% {
            opacity: 0.36;
            filter: contrast(1.12) brightness(0.88);
          }
        }

        @keyframes tvNoise {
          0% {
            transform: translateY(0);
            opacity: 0.42;
          }
          50% {
            transform: translateY(-2px);
            opacity: 0.8;
          }
          100% {
            transform: translateY(2px);
            opacity: 0.5;
          }
        }

        @keyframes tvBars {
          0% {
            transform: translateX(-52%);
            opacity: 0.12;
          }
          40% {
            transform: translateX(10%);
            opacity: 0.26;
          }
          100% {
            transform: translateX(62%);
            opacity: 0.08;
          }
        }

        @keyframes tvText {
          0% {
            opacity: 0.3;
            transform: translateX(-1px);
          }
          50% {
            opacity: 1;
            transform: translateX(1px);
          }
          100% {
            opacity: 0.45;
            transform: translateX(-0.5px);
          }
        }
      `}</style>
    </div>
  );
}
