"use client";

import { useEffect, useMemo, useState } from "react";
import GachaCharacterRevealModal, {
  type CharacterRevealInfo,
} from "../../components/gachaHandler/GachaCharacterRevealModal";
import {
  SNACK_BY_KEY,
  SNACK_DEFINITIONS,
  SNACK_KEYS,
  type SnackInventory,
  type SnackKey,
} from "../../components/gachaHandler/rateConfig";

export type ShopCharacterOption = {
  id: number;
  name: string;
  modelPath: string;
  owned: boolean;
};

type StarShopClientProps = {
  initialInventory: SnackInventory;
  initialStarCoin: number;
  characters: ShopCharacterOption[];
};

type BuyCharacterResponse = {
  success?: boolean;
  starCoin?: number;
  character?: { id: number; name: string };
  error?: string;
};

type ExchangeSnackResponse = {
  success?: boolean;
  inventory?: SnackInventory;
  starCoin?: number;
  spentFrom?: number;
  receivedTo?: number;
  error?: string;
};

const CHARACTER_COST = 1000;
const SNACK_EXCHANGE_RATIO = 2;

const toPositiveInt = (value: string, fallback = 1) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.trunc(parsed);
};

export default function StarShopClient({
  initialInventory,
  initialStarCoin,
  characters,
}: StarShopClientProps) {
  const [inventory, setInventory] = useState<SnackInventory>(initialInventory);
  const [starCoin, setStarCoin] = useState(initialStarCoin);
  const [characterOptions, setCharacterOptions] =
    useState<ShopCharacterOption[]>(characters);
  const [fromSnack, setFromSnack] = useState<SnackKey>("energy_sugar");
  const [toSnack, setToSnack] = useState<SnackKey>("dream_fruit_dust");
  const [targetSnackCount, setTargetSnackCount] = useState(1);
  const [selectedCharacterId, setSelectedCharacterId] = useState<number>(0);
  const [characterReveal, setCharacterReveal] = useState<CharacterRevealInfo | null>(
    null
  );
  const [submittingAction, setSubmittingAction] = useState<"" | "character" | "snack">(
    ""
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const unownedCharacters = useMemo(
    () => characterOptions.filter((character) => !character.owned),
    [characterOptions]
  );

  useEffect(() => {
    if (selectedCharacterId > 0) return;
    const fallback = unownedCharacters[0]?.id ?? 0;
    if (fallback > 0) setSelectedCharacterId(fallback);
  }, [selectedCharacterId, unownedCharacters]);

  const canBuyCharacter =
    selectedCharacterId > 0 &&
    starCoin >= CHARACTER_COST &&
    submittingAction === "";

  const requiredSourceSnack = targetSnackCount * SNACK_EXCHANGE_RATIO;
  const canExchangeSnack =
    fromSnack !== toSnack &&
    targetSnackCount > 0 &&
    inventory[fromSnack] >= requiredSourceSnack &&
    submittingAction === "";

  const handleBuyCharacter = async () => {
    if (!canBuyCharacter) return;
    setSubmittingAction("character");
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/starshop/buy-character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId: selectedCharacterId }),
      });
      const data = (await response.json()) as BuyCharacterResponse;
      if (!response.ok || !data.success || typeof data.starCoin !== "number") {
        throw new Error(data.error || "Failed to buy character.");
      }

      const boughtCharacter = characterOptions.find(
        (character) => character.id === selectedCharacterId
      );
      const boughtCharacterName =
        data.character?.name ?? boughtCharacter?.name ?? "Character";
      const boughtCharacterModelPath =
        boughtCharacter?.modelPath ??
        `/assets/characters/${String(boughtCharacterName)
          .trim()
          .toLowerCase()
          .replace(/\s+/g, "_")}/${String(boughtCharacterName)
          .trim()
          .toLowerCase()
          .replace(/\s+/g, "_")}.glb`;

      setStarCoin(data.starCoin);
      setCharacterOptions((prev) => {
        const next = prev.map((character) =>
          character.id === selectedCharacterId
            ? { ...character, owned: true }
            : character
        );
        const nextUnowned = next.find((character) => !character.owned);
        setSelectedCharacterId(nextUnowned?.id ?? 0);
        return next;
      });
      setCharacterReveal({
        characterId: String(data.character?.id ?? selectedCharacterId),
        characterName: boughtCharacterName,
        modelPath: boughtCharacterModelPath,
        isDuplicate: false,
        convertedStarCoin: 0,
      });
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : "Failed to buy character."
      );
    } finally {
      setSubmittingAction("");
    }
  };

  const handleExchangeSnack = async () => {
    if (!canExchangeSnack) return;
    setSubmittingAction("snack");
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/starshop/exchange-snack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromSnack,
          toSnack,
          targetCount: targetSnackCount,
        }),
      });
      const data = (await response.json()) as ExchangeSnackResponse;
      if (!response.ok || !data.success || !data.inventory) {
        throw new Error(data.error || "Failed to exchange snacks.");
      }

      setInventory(data.inventory);
      if (typeof data.starCoin === "number") {
        setStarCoin(data.starCoin);
      }
      setMessage(
        `Success: spent ${data.spentFrom ?? requiredSourceSnack} ${SNACK_BY_KEY[fromSnack].label}, got ${
          data.receivedTo ?? targetSnackCount
        } ${SNACK_BY_KEY[toSnack].label}.`
      );
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Failed to exchange snacks."
      );
    } finally {
      setSubmittingAction("");
    }
  };

  return (
    <section className="grid min-h-0 flex-1 gap-6 xl:grid-cols-[420px_1fr]">
      <aside className="rounded-[26px] border border-white/10 bg-[#0b1019]/80 p-6 shadow-[0_0_44px_rgba(96,165,250,0.18)] backdrop-blur-md">
        <div className="relative h-[320px] overflow-hidden rounded-[22px] border border-white/12 bg-[#060b13]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_24%,rgba(192,132,252,0.35),transparent_36%),radial-gradient(circle_at_20%_78%,rgba(251,146,60,0.22),transparent_42%),radial-gradient(circle_at_84%_76%,rgba(56,189,248,0.24),transparent_42%)]" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute left-1/2 top-[44px] h-20 w-20 -translate-x-1/2 rounded-full border border-cyan-200/35 bg-gradient-to-b from-violet-300/50 to-cyan-300/20 shadow-[0_0_30px_rgba(168,85,247,0.55)]" />
          <div className="absolute left-[calc(50%-68px)] top-[116px] h-[150px] w-[136px] rounded-[42%] border border-cyan-200/25 bg-gradient-to-b from-violet-500/35 via-sky-500/24 to-emerald-400/20 shadow-[0_0_36px_rgba(56,189,248,0.32)]" />
          <div className="absolute left-1/2 top-[80px] h-2 w-2 -translate-x-6 rounded-full bg-cyan-100 shadow-[0_0_8px_rgba(34,211,238,0.9)]" />
          <div className="absolute left-1/2 top-[80px] h-2 w-2 translate-x-4 rounded-full bg-cyan-100 shadow-[0_0_8px_rgba(34,211,238,0.9)]" />
        </div>

        <div className="mt-5 rounded-xl border border-amber-200/25 bg-amber-400/10 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-amber-100/85">Star Coin</p>
          <p className="mt-1 text-4xl font-black text-amber-100">{starCoin}</p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {SNACK_DEFINITIONS.map((snack) => (
            <div
              key={snack.key}
              className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2"
            >
              <p className="text-[10px] uppercase tracking-[0.12em] text-slate-300">
                {snack.label}
              </p>
              <p className="mt-1 text-lg font-bold text-slate-100">
                {inventory[snack.key]}
              </p>
            </div>
          ))}
        </div>
      </aside>

      <div className="grid min-h-0 gap-6 lg:grid-rows-2">
        <article className="rounded-[26px] border border-white/10 bg-[#0b1019]/80 p-6 shadow-[0_0_44px_rgba(96,165,250,0.18)] backdrop-blur-md">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-black text-slate-100">Character Trade</h2>
            <span className="rounded-full border border-amber-200/30 bg-amber-400/15 px-3 py-1 text-xs font-semibold text-amber-100">
              1000 Star Coin
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-300">
            Trade 1000 Star Coin for one character you choose.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto]">
            <select
              value={selectedCharacterId > 0 ? String(selectedCharacterId) : ""}
              onChange={(event) =>
                setSelectedCharacterId(Number.parseInt(event.target.value, 10) || 0)
              }
              className="h-12 rounded-xl border border-cyan-300/35 bg-[#060b13] px-4 text-base font-semibold text-slate-100 outline-none transition focus:border-cyan-300/70"
              disabled={submittingAction !== "" || unownedCharacters.length === 0}
            >
              {unownedCharacters.length === 0 ? (
                <option value="">All characters already owned</option>
              ) : (
                unownedCharacters.map((character) => (
                  <option key={character.id} value={character.id}>
                    {character.name}
                  </option>
                ))
              )}
            </select>
            <button
              type="button"
              onClick={handleBuyCharacter}
              disabled={!canBuyCharacter || unownedCharacters.length === 0}
              className="h-12 rounded-xl border border-cyan-300/45 bg-cyan-500/20 px-6 text-base font-black text-cyan-50 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55"
            >
              {submittingAction === "character" ? "Trading..." : "Trade Character"}
            </button>
          </div>
        </article>

        <article className="rounded-[26px] border border-white/10 bg-[#0b1019]/80 p-6 shadow-[0_0_44px_rgba(96,165,250,0.18)] backdrop-blur-md">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-black text-slate-100">Snack Exchange</h2>
            <span className="rounded-full border border-fuchsia-200/30 bg-fuchsia-500/15 px-3 py-1 text-xs font-semibold text-fuchsia-100">
              2 : 1
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-300">
            Spend 2 source snacks to get 1 target snack.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_auto]">
            <select
              value={fromSnack}
              onChange={(event) => setFromSnack(event.target.value as SnackKey)}
              className="h-12 rounded-xl border border-fuchsia-300/35 bg-[#060b13] px-4 text-base font-semibold text-slate-100 outline-none transition focus:border-fuchsia-300/70"
              disabled={submittingAction !== ""}
            >
              {SNACK_KEYS.map((key) => (
                <option key={key} value={key}>
                  Spend {SNACK_BY_KEY[key].label}
                </option>
              ))}
            </select>

            <select
              value={toSnack}
              onChange={(event) => setToSnack(event.target.value as SnackKey)}
              className="h-12 rounded-xl border border-fuchsia-300/35 bg-[#060b13] px-4 text-base font-semibold text-slate-100 outline-none transition focus:border-fuchsia-300/70"
              disabled={submittingAction !== ""}
            >
              {SNACK_KEYS.map((key) => (
                <option key={key} value={key}>
                  Receive {SNACK_BY_KEY[key].label}
                </option>
              ))}
            </select>

            <input
              type="number"
              min={1}
              step={1}
              value={targetSnackCount}
              onChange={(event) =>
                setTargetSnackCount(toPositiveInt(event.target.value, targetSnackCount))
              }
              className="h-12 w-full rounded-xl border border-fuchsia-300/35 bg-[#060b13] px-4 text-base font-bold text-slate-100 outline-none transition focus:border-fuchsia-300/70 md:w-32"
              disabled={submittingAction !== ""}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-300">
              Cost:{" "}
              <span className="font-bold text-fuchsia-200">
                {requiredSourceSnack} x {SNACK_BY_KEY[fromSnack].label}
              </span>{" "}
              {"->"} Get{" "}
              <span className="font-bold text-emerald-200">
                {targetSnackCount} x {SNACK_BY_KEY[toSnack].label}
              </span>
            </p>
            <button
              type="button"
              onClick={handleExchangeSnack}
              disabled={!canExchangeSnack}
              className="h-11 rounded-xl border border-fuchsia-300/45 bg-fuchsia-500/20 px-6 text-base font-black text-fuchsia-50 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55"
            >
              {submittingAction === "snack" ? "Exchanging..." : "Exchange Snacks"}
            </button>
          </div>
        </article>

        {message ? (
          <div className="rounded-xl border border-emerald-300/35 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-xl border border-rose-300/35 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-100">
            {error}
          </div>
        ) : null}
      </div>

      {characterReveal ? (
        <GachaCharacterRevealModal
          reveal={characterReveal}
          index={0}
          total={1}
          onClose={() => setCharacterReveal(null)}
        />
      ) : null}
    </section>
  );
}
