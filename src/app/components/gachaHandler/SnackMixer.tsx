"use client";

import { useEffect, useRef, useState } from "react";
import GachaManual from "./GachaManual";
import GachaResult from "./GachaResult";
import GachaCharacterRevealModal, {
  type CharacterRevealInfo,
} from "./GachaCharacterRevealModal";
import FoodMeshes, { FOOD_MESH_SHAPES } from "./FoodMeshes";
import {
  DEFAULT_SNACK_RATE_CONFIG,
  SNACK_BY_KEY,
  SNACK_DEFINITIONS,
  SNACK_KEYS,
  ZERO_SNACK_INVENTORY,
  type GachaDisplayReward,
  type GachaRateList,
  type SnackInventory,
  type SnackKey,
} from "./rateConfig";

export type { SnackInventory, SnackKey };

type Selected = SnackInventory;

const ZERO: Selected = { ...ZERO_SNACK_INVENTORY };
const BAG_TOP_CLOSE_SHIFT = 185;
const BAG_BOTTOM_CLOSE_SHIFT = BAG_TOP_CLOSE_SHIFT * 2;
const TRANSFER_DURATION_MS = 1600;
const CLOSE_DURATION_MS = 1850;
const SHAKE_DURATION_MS = 650;
const SMOKE_DURATION_MS = 2200;
const SMOKE_FADE_OUT_MS = 1800;
const OPEN_UNSEAL_DURATION_MS = 1000;
const OPEN_FLASH_DURATION_MS = 620;
const TRANSFER_TARGET_X = 50;
const TRANSFER_TARGET_Y = 47;

const PARTICLE_ORIGINS: Record<SnackKey, { x: number; y: number }> = {
  energy_sugar: { x: 14, y: 22 },
  dream_fruit_dust: { x: 86, y: 22 },
  core_crunch_seed: { x: 14, y: 78 },
  star_gel_essence: { x: 86, y: 78 },
};

const PLATE_MESH_SLOTS: Array<{ left: number; top: number }> = [
  { left: 20, top: 20 },
  { left: 37, top: 16 },
  { left: 54, top: 20 },
  { left: 71, top: 16 },
  { left: 88, top: 20 },
  { left: 28, top: 42 },
  { left: 45, top: 38 },
  { left: 62, top: 42 },
  { left: 79, top: 38 },
  { left: 36, top: 62 },
  { left: 53, top: 58 },
  { left: 70, top: 62 },
];

type TransferParticle = {
  id: number;
  key: SnackKey;
  startX: number;
  startY: number;
  size: number;
  delay: number;
};

type SmokeBubble = {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
  color: string;
};

const SMOKE_COLORS = [
  "#38bdf8",
  "#f472b6",
  "#f59e0b",
  "#34d399",
  "#a78bfa",
  "#22d3ee",
  "#fb7185",
  "#fde047",
];

const SMOKE_BUBBLES: SmokeBubble[] = Array.from({ length: 224 }, (_, i) => {
  const cols = 14;
  const rows = 8;
  const col = i % cols;
  const row = Math.floor(i / cols);
  const baseX = 1 + (98 / (cols - 1)) * col;
  const baseY = 3 + (94 / (rows - 1)) * row;
  const jitterX = Math.sin(i * 1.73) * 1.2;
  const jitterY = Math.cos(i * 1.21) * 1.15;
  return {
    id: i,
    x: baseX + jitterX,
    y: baseY + jitterY,
    size: 78 + (i % 5) * 14,
    delay: ((i * 53) % 37) * 32,
    duration: 1180 + (i % 4) * 240,
    color: SMOKE_COLORS[i % SMOKE_COLORS.length],
  };
});

function buildRequirementText(rule: GachaRateList["specialRates"][number]) {
  const parts = SNACK_DEFINITIONS.filter(
    (snack) => rule.requirements[snack.key] > 0
  ).map((snack) => `${snack.label} x${rule.requirements[snack.key]}`);
  return parts.length > 0
    ? parts.join(" + ")
    : "No requirement (rolled once per 5-snack pack)";
}

function buildRewardText(rule: GachaRateList["specialRates"][number]) {
  if (rule.reward.type === "character") {
    return `Character: ${rule.reward.name} x${rule.reward.count}`;
  }
  return `${rule.reward.name} x${rule.reward.count}`;
}

function buildTransferParticles(selected: Selected): TransferParticle[] {
  let id = 0;
  const particles: TransferParticle[] = [];

  SNACK_DEFINITIONS.forEach((snack) => {
    const amount = Math.min(6, Math.max(0, selected[snack.key]));
    const origin = PARTICLE_ORIGINS[snack.key];
    for (let i = 0; i < amount; i += 1) {
      const spreadX = ((i % 3) - 1) * 2.8;
      const spreadY = (Math.floor(i / 3) - 0.5) * 3.2;
      particles.push({
        id,
        key: snack.key,
        startX: origin.x + spreadX,
        startY: origin.y + spreadY,
        size: 44 + (i % 3) * 8,
        delay: i * 95,
      });
      id += 1;
    }
  });

  return particles;
}

type PlateMesh = {
  id: number;
  path: string;
  fill: string;
  size: number;
  left: number;
  top: number;
  rotation: number;
};

function buildPlateMeshes(selected: Selected): PlateMesh[] {
  const meshes: PlateMesh[] = [];
  let slotIndex = 0;
  let id = 0;

  SNACK_KEYS.forEach((key, snackIndex) => {
    const count = Math.max(0, selected[key]);
    const copies = Math.min(4, count);
    for (let i = 0; i < copies; i += 1) {
      if (slotIndex >= PLATE_MESH_SLOTS.length) break;
      const slot = PLATE_MESH_SLOTS[slotIndex];
      const shape =
        FOOD_MESH_SHAPES[
          (snackIndex * 7 + i * 3 + count) % FOOD_MESH_SHAPES.length
        ];
      meshes.push({
        id,
        path: shape.d,
        fill: shape.fill,
        size: 46 + ((snackIndex + i) % 3) * 9,
        left: slot.left,
        top: slot.top,
        rotation: (snackIndex * 53 + i * 41) % 360,
      });
      id += 1;
      slotIndex += 1;
    }
  });

  return meshes;
}

function SnackSlot({
  snack,
  count,
  max,
  onAdjust,
  onSetCount,
}: {
  snack: (typeof SNACK_DEFINITIONS)[number];
  count: number;
  max: number;
  onAdjust: (delta: number) => void;
  onSetCount: (next: number) => void;
}) {
  const active = count > 0;
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="relative flex h-40 w-40 items-center justify-center rounded-full border-2 transition-all duration-300"
        style={{
          borderColor: active ? snack.accent : "rgba(255,255,255,0.12)",
          background: active
            ? `radial-gradient(circle at 35% 35%, ${snack.accent}28, rgba(0,0,0,0.65))`
            : "rgba(255,255,255,0.03)",
          boxShadow: active
            ? `0 0 40px ${snack.glow}, inset 0 0 24px rgba(0,0,0,0.5)`
            : "inset 0 0 24px rgba(0,0,0,0.4)",
        }}
      >
        <img
          src={snack.imagePath}
          alt={snack.label}
          className="h-28 w-28 object-contain transition-all duration-300"
          style={{
            filter: active
              ? `drop-shadow(0 0 16px ${snack.glow})`
              : "grayscale(0.4) opacity(0.6)",
          }}
        />
        {active ? (
          <div
            className="absolute -right-1 -top-1 flex h-9 w-9 items-center justify-center rounded-full text-sm font-black text-white shadow-lg"
            style={{ background: snack.accent }}
          >
            {count}
          </div>
        ) : null}
      </div>
      <p className="max-w-[150px] text-center text-sm font-semibold leading-tight text-slate-200">
        {snack.label}
      </p>
      <p className="text-xs font-semibold text-slate-300">Stock: {max}</p>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => onAdjust(-1)}
          disabled={count <= 0}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-xl font-bold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-20"
        >
          -
        </button>
        <input
          type="number"
          min={0}
          max={max}
          step={1}
          inputMode="numeric"
          value={count}
          onChange={(event) => {
            const nextText = event.target.value.trim();
            if (!nextText) {
              onSetCount(0);
              return;
            }
            const parsed = Number.parseInt(nextText, 10);
            if (!Number.isFinite(parsed)) return;
            onSetCount(parsed);
          }}
          className="h-10 w-14 rounded-full border border-white/20 bg-white/5 text-center text-xl font-black tabular-nums text-white outline-none transition focus:border-white/45 focus:bg-white/10"
          aria-label={`${snack.label} quantity`}
        />
        <button
          type="button"
          onClick={() => onAdjust(1)}
          disabled={count >= max}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-xl font-bold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-20"
        >
          +
        </button>
      </div>
    </div>
  );
}

function Plate({ selected }: { selected: Selected }) {
  const plateMeshes = buildPlateMeshes(selected);
  return (
    <div
      className="relative flex h-[420px] w-[420px] flex-col items-center overflow-hidden rounded-full border border-slate-200/70 shadow-[inset_0_2px_14px_rgba(255,255,255,0.88),inset_0_-20px_70px_rgba(30,41,59,0.42),0_0_46px_rgba(148,163,184,0.5)]"
      style={{
        background:
          "radial-gradient(circle at 30% 18%, #ffffff 0%, #f4f7fb 19%, #d5dce5 45%, #a4afbd 69%, #79879a 100%)",
      }}
    >
      <div className="pointer-events-none absolute inset-[12px] rounded-full border border-white/35 shadow-[inset_0_18px_40px_rgba(255,255,255,0.35),inset_0_-26px_38px_rgba(15,23,42,0.28)]" />
      <div
        className="pointer-events-none absolute inset-0 rounded-full opacity-45"
        style={{
          background:
            "conic-gradient(from 210deg at 52% 48%, rgba(255,255,255,0.38) 0deg, rgba(255,255,255,0.06) 60deg, rgba(71,85,105,0.35) 130deg, rgba(255,255,255,0.22) 220deg, rgba(100,116,139,0.42) 310deg, rgba(255,255,255,0.38) 360deg)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 rounded-full opacity-30"
        style={{
          background:
            "repeating-linear-gradient(112deg, rgba(255,255,255,0.24) 0px, rgba(255,255,255,0.24) 2px, rgba(148,163,184,0.12) 2px, rgba(148,163,184,0.12) 7px)",
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_28%_22%,rgba(255,255,255,0.95),rgba(255,255,255,0)_58%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_78%,rgba(15,23,42,0.28),rgba(15,23,42,0)_52%)]" />

      <div className="relative mt-20 h-[190px] w-[320px]">
        {plateMeshes.map((mesh) => (
          <svg
            key={mesh.id}
            viewBox="0 0 40 40"
            width={mesh.size}
            height={mesh.size}
            className="absolute"
            style={{
              left: `${mesh.left}%`,
              top: `${mesh.top}%`,
              opacity: 0.92,
              transform: `translate(-50%, -50%) rotate(${mesh.rotation}deg)`,
              filter: "drop-shadow(0 0 8px rgba(255,255,255,0.45))",
            }}
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d={mesh.path} fill={mesh.fill} />
          </svg>
        ))}
      </div>
    </div>
  );
}

function BagTop() {
  const width = 500;
  const base = 80;
  const step = 50;
  let wave = `M0,${base}`;
  for (let x = 0; x < width; x += step) {
    const cp1x = x + step * 0.3;
    const cp2x = x + step * 0.7;
    wave += ` C${cp1x},0 ${cp2x},0 ${x + step},${base}`;
  }
  wave += ` L${width},330 L0,330 Z`;

  return (
    <svg viewBox="0 0 500 330" width="500" height="330" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="btG" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f472b6" />
          <stop offset="45%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#60a5fa" />
        </linearGradient>
        <linearGradient id="btGloss" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        <filter id="bshadow">
          <feDropShadow
            dx="0"
            dy="6"
            stdDeviation="14"
            floodColor="rgba(167,139,250,0.55)"
          />
        </filter>
      </defs>
      <path d={wave} fill="url(#btG)" filter="url(#bshadow)" />
      <rect x="0" y={base} width="500" height="90" fill="url(#btGloss)" />
      <path
        d={
          `M0,${base} ` +
          Array.from({ length: 10 }, (_, i) => {
            const x = i * step;
            return `C${x + step * 0.3},0 ${x + step * 0.7},0 ${x + step},${base}`;
          }).join(" ")
        }
        fill="none"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="2.5"
      />
    </svg>
  );
}

function BagBottom() {
  return (
    <svg viewBox="0 0 500 520" width="500" height="520" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bbG" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="50%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#f472b6" />
        </linearGradient>
        <linearGradient id="bbGloss" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.22)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        <filter id="bshadow2">
          <feDropShadow
            dx="0"
            dy="-5"
            stdDeviation="14"
            floodColor="rgba(96,165,250,0.5)"
          />
        </filter>
      </defs>
      <path
        d="M0,0 L500,0 L500,478 Q500,520 455,520 L45,520 Q0,520 0,478 Z"
        fill="url(#bbG)"
        filter="url(#bshadow2)"
      />
      <rect x="0" y="0" width="500" height="80" fill="url(#bbGloss)" />
    </svg>
  );
}

type RollResponse = {
  success?: boolean;
  rewards?: GachaDisplayReward[];
  inventory?: SnackInventory;
  characterReveals?: CharacterRevealInfo[];
  message?: string;
  error?: string;
};

type SettledRoll =
  | { ok: true; data: RollResponse }
  | { ok: false; error: unknown };

export default function SnackMixer({
  inventory,
  rateList,
}: {
  inventory: SnackInventory;
  rateList: GachaRateList;
}) {
  const [selected, setSelected] = useState<Selected>(ZERO);
  const [currentInventory, setCurrentInventory] =
    useState<SnackInventory>(inventory);
  const [bagsClosed, setBagsClosed] = useState(false);
  const [bagsGlowing, setBagsGlowing] = useState(false);
  const [bagShaking, setBagShaking] = useState(false);
  const [bagSmokeBurst, setBagSmokeBurst] = useState(false);
  const [bagSmokeFading, setBagSmokeFading] = useState(false);
  const [bagOpening, setBagOpening] = useState(false);
  const [plateFxActive, setPlateFxActive] = useState(false);
  const [plateWhiteFlash, setPlateWhiteFlash] = useState(false);
  const [showOpenBtn, setShowOpenBtn] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [specialEventsOpen, setSpecialEventsOpen] = useState(false);
  const [transferParticles, setTransferParticles] = useState<TransferParticle[]>([]);
  const [transferFlying, setTransferFlying] = useState(false);
  const [resultRewards, setResultRewards] = useState<GachaDisplayReward[]>([]);
  const [resultMessage, setResultMessage] = useState("");
  const [characterReveals, setCharacterReveals] = useState<CharacterRevealInfo[]>([]);
  const [activeRevealIndex, setActiveRevealIndex] = useState(0);
  const [actionError, setActionError] = useState("");
  const [rolling, setRolling] = useState(false);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    setCurrentInventory(inventory);
  }, [inventory]);

  const snacksPerReward = DEFAULT_SNACK_RATE_CONFIG.snacksPerReward;
  const total = Object.values(selected).reduce((sum, count) => sum + count, 0);
  const canMake = total >= snacksPerReward;
  const isSealing =
    bagsClosed ||
    bagsGlowing ||
    showOpenBtn ||
    plateFxActive ||
    bagShaking ||
    bagSmokeBurst ||
    bagSmokeFading ||
    bagOpening ||
    plateWhiteFlash ||
    transferParticles.length > 0 ||
    characterReveals.length > 0 ||
    rolling;
  const bagFxClass = `${bagShaking ? "animate-bag-shake" : ""} ${bagsGlowing ? "animate-bag-rainbow" : ""}`.trim();
  const activeCharacterReveal = characterReveals[activeRevealIndex] ?? null;

  const clearTimers = () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  };

  const queue = (fn: () => void, delay: number) => {
    const timer = window.setTimeout(fn, delay);
    timersRef.current.push(timer);
    return timer;
  };

  useEffect(() => () => clearTimers(), []);

  const adjust = (key: SnackKey, delta: number) => {
    if (isSealing) return;
    setSelected((prev) => ({
      ...prev,
      [key]: Math.max(0, Math.min(currentInventory[key], prev[key] + delta)),
    }));
  };

  const setCount = (key: SnackKey, next: number) => {
    if (isSealing) return;
    const normalized = Number.isFinite(next) ? Math.floor(next) : 0;
    setSelected((prev) => ({
      ...prev,
      [key]: Math.max(0, Math.min(currentInventory[key], normalized)),
    }));
  };

  const settleSnackRoll = async (selection: Selected) => {
    const response = await fetch("/api/gacha/snack-roll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(selection),
    });

    const data = (await response.json()) as RollResponse;
    if (!response.ok || !data.success || !data.inventory || !Array.isArray(data.rewards)) {
      throw new Error(data.error || "Failed to open snack pack.");
    }

    return data;
  };

  const handleMake = () => {
    if (!canMake || isSealing) return;

    clearTimers();
    setActionError("");
    setShowOpenBtn(false);
    setBagsGlowing(false);
    setBagShaking(false);
    setBagSmokeBurst(false);
    setBagSmokeFading(false);
    setBagOpening(false);
    setPlateFxActive(true);
    setPlateWhiteFlash(false);
    setCharacterReveals([]);
    setActiveRevealIndex(0);

    const particles = buildTransferParticles(selected);
    const lastDelay = particles.reduce(
      (maxDelay, item) => Math.max(maxDelay, item.delay),
      0
    );
    const transferDoneAt = TRANSFER_DURATION_MS + lastDelay + 120;
    const closeDoneAt = transferDoneAt + CLOSE_DURATION_MS;
    const shakeDoneAt = closeDoneAt + SHAKE_DURATION_MS;
    const smokeDoneAt = shakeDoneAt + SMOKE_DURATION_MS;

    setTransferParticles(particles);
    setTransferFlying(false);

    queue(() => setTransferFlying(true), 30);
    queue(() => {
      setTransferParticles([]);
      setTransferFlying(false);
      setBagsClosed(true);
    }, transferDoneAt);
    queue(() => setBagShaking(true), closeDoneAt);
    queue(() => {
      setBagShaking(false);
      setBagSmokeBurst(true);
    }, shakeDoneAt);
    queue(() => {
      setBagsGlowing(true);
      setShowOpenBtn(true);
      setBagSmokeFading(true);
    }, smokeDoneAt);
    queue(() => {
      setBagSmokeBurst(false);
      setBagSmokeFading(false);
    }, smokeDoneAt + SMOKE_FADE_OUT_MS);
  };

  const handleOpen = () => {
    if (rolling) return;

    clearTimers();
    setRolling(true);
    setActionError("");
    setShowOpenBtn(false);
    setBagShaking(false);
    setBagSmokeBurst(false);
    setBagSmokeFading(false);
    setBagsGlowing(false);
    setPlateFxActive(false);
    setPlateWhiteFlash(false);
    setTransferParticles([]);
    setTransferFlying(false);
    setCharacterReveals([]);
    setActiveRevealIndex(0);
    setBagOpening(true);
    setBagsClosed(false);
    setPlateWhiteFlash(true);

    const selectionSnapshot: Selected = { ...selected };
    const settlePromise: Promise<SettledRoll> = settleSnackRoll(selectionSnapshot)
      .then((data) => ({ ok: true as const, data }))
      .catch((error) => ({ ok: false as const, error }));

    queue(() => {
      void (async () => {
        const settled = await settlePromise;
        setPlateWhiteFlash(false);
        setBagOpening(false);

        if ("error" in settled) {
          const message =
            settled.error instanceof Error
              ? settled.error.message
              : "Failed to open snack pack.";
          setActionError(message);
          setRolling(false);
          return;
        }

        setCurrentInventory(settled.data.inventory!);
        setResultRewards(settled.data.rewards ?? []);
        setResultMessage(settled.data.message ?? "");
        setSelected(ZERO);
        const revealQueue = Array.isArray(settled.data.characterReveals)
          ? settled.data.characterReveals
          : [];
        if (revealQueue.length > 0) {
          setCharacterReveals(revealQueue);
          setActiveRevealIndex(0);
          setShowResult(false);
        } else {
          setCharacterReveals([]);
          setActiveRevealIndex(0);
          setShowResult(true);
        }
        setRolling(false);
      })();
    }, OPEN_UNSEAL_DURATION_MS + OPEN_FLASH_DURATION_MS);
  };

  const handleCharacterRevealClose = () => {
    if (characterReveals.length === 0) return;
    if (activeRevealIndex < characterReveals.length - 1) {
      setActiveRevealIndex((prev) => prev + 1);
      return;
    }
    setCharacterReveals([]);
    setActiveRevealIndex(0);
    setShowResult(true);
  };

  const handleResultClose = () => {
    clearTimers();
    setShowResult(false);
    setBagsClosed(false);
    setBagsGlowing(false);
    setBagShaking(false);
    setBagSmokeBurst(false);
    setBagSmokeFading(false);
    setBagOpening(false);
    setPlateFxActive(false);
    setPlateWhiteFlash(false);
    setShowOpenBtn(false);
    setTransferParticles([]);
    setTransferFlying(false);
    setResultRewards([]);
    setResultMessage("");
    setCharacterReveals([]);
    setActiveRevealIndex(0);
    setActionError("");
    setRolling(false);
    window.setTimeout(() => setSelected(ZERO), 700);
  };

  return (
    <div
      className="relative grid h-full w-full"
      style={{
        gridTemplateColumns: "1fr 540px 1fr",
        gridTemplateRows: "1fr 440px 1fr",
      }}
    >
      <FoodMeshes />

      {actionError ? (
        <div className="pointer-events-none absolute inset-x-0 top-4 z-[260] flex justify-center">
          <div className="rounded-lg border border-rose-400/45 bg-rose-500/85 px-4 py-2 text-sm font-semibold text-white shadow-lg">
            {actionError}
          </div>
        </div>
      ) : null}

      <div className="relative z-10 flex -translate-x-18 translate-y-8 items-center justify-start pl-4">
        <SnackSlot
          snack={SNACK_DEFINITIONS[0]}
          count={selected.energy_sugar}
          max={currentInventory.energy_sugar}
          onAdjust={(delta) => adjust("energy_sugar", delta)}
          onSetCount={(next) => setCount("energy_sugar", next)}
        />
      </div>

      <div
        className="relative flex items-end justify-center overflow-visible"
        style={{ zIndex: bagsClosed ? 50 : 10 }}
      >
        <div
          className={`transition-transform ease-in-out ${bagFxClass}`}
          style={{
            transform: `translateY(${bagsClosed ? `${BAG_TOP_CLOSE_SHIFT}px` : "0px"})`,
            zIndex: bagsClosed ? 30 : 10,
            position: "relative",
            transitionDuration: `${
              bagsClosed
                ? CLOSE_DURATION_MS
                : bagOpening
                  ? OPEN_UNSEAL_DURATION_MS
                  : 850
            }ms`,
          }}
        >
          <BagTop />
        </div>
      </div>

      <div className="relative z-10 flex translate-x-18 translate-y-8 items-center justify-end pr-4">
        <SnackSlot
          snack={SNACK_DEFINITIONS[1]}
          count={selected.dream_fruit_dust}
          max={currentInventory.dream_fruit_dust}
          onAdjust={(delta) => adjust("dream_fruit_dust", delta)}
          onSetCount={(next) => setCount("dream_fruit_dust", next)}
        />
      </div>

      <div className="relative z-10 flex -translate-x-18 -translate-y-8 items-center justify-start pl-10">
        <div className="flex flex-col items-center gap-1 rounded-2xl border border-white/10 bg-white/[0.03] px-7 py-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-500">
            Selected
          </p>
          <p
            className={`text-5xl font-black tabular-nums transition-colors duration-300 ${
              canMake
                ? "text-amber-400 drop-shadow-[0_0_14px_rgba(251,191,36,0.8)]"
                : "text-slate-200"
            }`}
          >
            {total}
          </p>
          <p className="text-xs text-slate-600">/ {snacksPerReward}</p>
          {canMake ? (
            <span className="mt-1 animate-pulse text-[10px] font-bold uppercase tracking-widest text-amber-400">
              Ready!
            </span>
          ) : null}
        </div>
      </div>

      <div
        className="relative z-10 flex items-center justify-center"
        style={{ zIndex: bagsClosed ? 5 : 10 }}
      >
        {!bagOpening && !plateWhiteFlash ? (
          <Plate selected={selected} />
        ) : null}

        {plateFxActive ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="absolute h-[500px] w-[500px] rounded-full border border-cyan-300/35 opacity-70 animate-plate-ring" />
            <div className="absolute h-[560px] w-[560px] rounded-full border border-pink-300/25 animate-plate-ring-slow" />
            <div className="absolute h-[440px] w-[440px] rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.26)_0%,rgba(217,70,239,0.2)_45%,rgba(255,255,255,0)_75%)] animate-plate-pulse" />
            <div className="absolute h-[620px] w-[620px] bg-[conic-gradient(from_0deg,rgba(56,189,248,0)_0deg,rgba(56,189,248,0.45)_45deg,rgba(244,114,182,0)_120deg,rgba(250,204,21,0.4)_220deg,rgba(56,189,248,0)_360deg)] opacity-65 blur-md animate-plate-rays" />
            <div className="absolute h-[590px] w-[590px] bg-[conic-gradient(from_180deg,rgba(168,85,247,0)_0deg,rgba(168,85,247,0.42)_56deg,rgba(236,72,153,0)_130deg,rgba(14,165,233,0.38)_238deg,rgba(168,85,247,0)_360deg)] opacity-60 blur-md animate-plate-rays-rev" />
          </div>
        ) : null}

        {plateWhiteFlash ? (
          <div className="pointer-events-none absolute inset-0 z-[60] flex items-center justify-center">
            <div className="h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.98)_0%,rgba(255,255,255,0.76)_28%,rgba(255,255,255,0.22)_55%,rgba(255,255,255,0)_78%)] animate-plate-white-flash" />
          </div>
        ) : null}

        {canMake && !bagsClosed && !bagOpening && !plateWhiteFlash ? (
          <div className="absolute left-1/2 top-[72%] -translate-x-1/2">
            <button
              type="button"
              onClick={handleMake}
              disabled={isSealing}
              className="rounded-full px-12 py-4 text-lg font-black tracking-widest text-white transition hover:brightness-110 active:scale-95 disabled:opacity-60"
              style={{
                background: "linear-gradient(135deg, #f43f5e, #f59e0b, #ec4899)",
                boxShadow:
                  "0 0 40px rgba(244,63,94,0.65), 0 0 70px rgba(236,72,153,0.4), 0 8px 24px rgba(0,0,0,0.5)",
              }}
            >
              MAKE
            </button>
          </div>
        ) : null}
      </div>

      <div className="relative z-10 flex -translate-y-8 translate-x-8 flex-col items-end justify-center gap-20 pr-3">
        <button
          type="button"
          onClick={() => setSpecialEventsOpen(true)}
          className="flex h-24 w-24 flex-col items-center justify-center rounded-2xl border-2 border-cyan-300/35 bg-cyan-400/10 text-cyan-100 shadow-[0_0_34px_rgba(34,211,238,0.42)] transition hover:scale-105 hover:border-cyan-300/70 hover:bg-cyan-400/20 active:scale-95"
          style={{ textShadow: "0 0 14px rgba(34,211,238,0.7)" }}
        >
          <span className="text-4xl font-black leading-none">&#10022;</span>
          <span className="mt-1 text-[11px] font-black tracking-[0.18em]">EVENT</span>
        </button>
        <button
          type="button"
          onClick={() => setManualOpen(true)}
          className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-white/20 bg-white/[0.04] text-5xl font-black text-white shadow-[0_0_28px_rgba(167,139,250,0.3)] transition hover:scale-105 hover:border-violet-400/60 hover:shadow-[0_0_40px_rgba(167,139,250,0.55)] active:scale-95"
          style={{ textShadow: "0 0 20px rgba(255,255,255,0.7)" }}
        >
          !
        </button>
      </div>

      <div className="relative z-20 flex -translate-x-18 -translate-y-12 items-start justify-start pl-4 pointer-events-auto">
        <SnackSlot
          snack={SNACK_DEFINITIONS[2]}
          count={selected.core_crunch_seed}
          max={currentInventory.core_crunch_seed}
          onAdjust={(delta) => adjust("core_crunch_seed", delta)}
          onSetCount={(next) => setCount("core_crunch_seed", next)}
        />
      </div>

      <div
        className="relative flex items-start justify-center overflow-visible"
        style={{ zIndex: showOpenBtn ? 120 : bagsClosed ? 40 : 10 }}
      >
        <div
          className={`transition-transform ease-in-out ${bagFxClass}`}
          style={{
            transform: `translateY(${bagsClosed ? `-${BAG_BOTTOM_CLOSE_SHIFT}px` : "0px"})`,
            zIndex: showOpenBtn ? 130 : bagsClosed ? 20 : 10,
            position: "relative",
            transitionDuration: `${
              bagsClosed
                ? CLOSE_DURATION_MS
                : bagOpening
                  ? OPEN_UNSEAL_DURATION_MS
                  : 850
            }ms`,
          }}
        >
          <BagBottom />
          {showOpenBtn ? (
            <div
              className="pointer-events-none absolute inset-x-0 top-[78%] flex justify-center"
              style={{ zIndex: 220 }}
            >
              <button
                type="button"
                onClick={handleOpen}
                disabled={rolling}
                className="pointer-events-auto rounded-full border border-amber-300/60 bg-amber-500/90 px-12 py-4 text-lg font-black tracking-widest text-slate-950 shadow-[0_0_40px_rgba(251,191,36,0.7)] transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {rolling ? "OPENING..." : "OPEN"}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="relative z-20 flex translate-x-18 -translate-y-12 items-start justify-end pr-4 pointer-events-auto">
        <SnackSlot
          snack={SNACK_DEFINITIONS[3]}
          count={selected.star_gel_essence}
          max={currentInventory.star_gel_essence}
          onAdjust={(delta) => adjust("star_gel_essence", delta)}
          onSetCount={(next) => setCount("star_gel_essence", next)}
        />
      </div>

      {transferParticles.length > 0 ? (
        <div className="pointer-events-none absolute inset-0 z-[80]">
          {transferParticles.map((particle) => {
            const snack = SNACK_BY_KEY[particle.key];
            return (
              <div
                key={particle.id}
                className="absolute flex items-center justify-center rounded-full border border-white/20 bg-black/20 backdrop-blur-sm"
                style={{
                  left: transferFlying
                    ? `${TRANSFER_TARGET_X}%`
                    : `${particle.startX}%`,
                  top: transferFlying
                    ? `${TRANSFER_TARGET_Y}%`
                    : `${particle.startY}%`,
                  width: `${particle.size}px`,
                  height: `${particle.size}px`,
                  opacity: transferFlying ? 0.06 : 0.98,
                  transform: `translate(-50%, -50%) scale(${transferFlying ? 0.42 : 1}) rotate(${transferFlying ? "180deg" : "0deg"})`,
                  boxShadow: `0 0 22px ${snack.glow}`,
                  transitionProperty: "left, top, opacity, transform",
                  transitionDuration: `${TRANSFER_DURATION_MS}ms`,
                  transitionTimingFunction: "cubic-bezier(0.2,0.92,0.16,1)",
                  transitionDelay: `${particle.delay}ms`,
                }}
              >
                <img
                  src={snack.imagePath}
                  alt=""
                  className="h-[72%] w-[72%] object-contain"
                />
              </div>
            );
          })}
        </div>
      ) : null}

      {bagSmokeBurst ? (
        <div
          className="pointer-events-none absolute inset-0 z-[170] flex items-center justify-center"
          style={{
            opacity: bagSmokeFading ? 0 : 1,
            transition: `opacity ${SMOKE_FADE_OUT_MS}ms ease-out`,
          }}
        >
          <div className="relative h-[1180px] w-[980px]">
            <div className="absolute inset-0 rounded-[42%] bg-[radial-gradient(circle,rgba(255,255,255,0.22)_0%,rgba(219,234,254,0.4)_28%,rgba(129,140,248,0.42)_52%,rgba(30,41,59,0.45)_78%,rgba(30,41,59,0)_100%)] animate-smoke-veil" />
            {SMOKE_BUBBLES.map((bubble) => (
              <span
                key={bubble.id}
                className="absolute rounded-full border border-white/20 animate-smoke-bubble"
                style={{
                  width: `${bubble.size}px`,
                  height: `${bubble.size}px`,
                  left: `${bubble.x}%`,
                  top: `${bubble.y}%`,
                  backgroundColor: bubble.color,
                  boxShadow: `0 0 22px ${bubble.color}99`,
                  animationDelay: `${bubble.delay}ms`,
                  animationDuration: `${bubble.duration}ms`,
                }}
              />
            ))}
          </div>
        </div>
      ) : null}

      {manualOpen ? (
        <GachaManual
          onClose={() => setManualOpen(false)}
          snacksPerReward={snacksPerReward}
        />
      ) : null}

      {specialEventsOpen ? (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center px-4 py-4"
          onClick={() => setSpecialEventsOpen(false)}
        >
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-6xl rounded-[26px] border border-cyan-300/35 bg-[#070d18] p-6 shadow-[0_0_80px_rgba(34,211,238,0.25)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-3xl font-black tracking-wide text-cyan-100">
                Special Event List
              </h3>
              <button
                type="button"
                onClick={() => setSpecialEventsOpen(false)}
                className="rounded-full border border-white/30 bg-white/10 px-4 py-2 text-base font-semibold text-white transition hover:bg-white/20"
              >
                Close
              </button>
            </div>
            <p className="mb-4 rounded-xl border border-cyan-300/25 bg-cyan-400/5 px-4 py-3 text-sm leading-relaxed text-cyan-100">
              Each event is checked independently. In one OPEN, a single event can be
              checked multiple times based on how many full requirement sets your selected
              snacks contain.
            </p>

            {rateList.specialRates.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-10 text-center text-xl font-semibold text-slate-300">
                No special events configured by admin yet.
              </div>
            ) : (
              <div className="max-h-[72dvh] overflow-auto rounded-xl border border-cyan-300/25">
                <table className="min-w-full table-auto text-base">
                  <thead className="bg-cyan-900/30 text-cyan-100">
                    <tr>
                      <th className="px-4 py-3 text-left font-bold">Event Name</th>
                      <th className="px-4 py-3 text-left font-bold">Chance</th>
                      <th className="px-4 py-3 text-left font-bold">Condition</th>
                      <th className="px-4 py-3 text-left font-bold">Reward</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cyan-300/15">
                    {rateList.specialRates.map((rule) => (
                      <tr key={rule.id} className="bg-slate-950/45 text-slate-100">
                        <td className="px-4 py-3 text-lg font-semibold">{rule.name}</td>
                        <td className="px-4 py-3 font-semibold text-cyan-200">
                          {(rule.chance * 100).toFixed(4)}%
                        </td>
                        <td className="px-4 py-3">{buildRequirementText(rule)}</td>
                        <td className="px-4 py-3">{buildRewardText(rule)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {showResult ? (
        <GachaResult
          rewards={resultRewards}
          message={resultMessage}
          onClose={handleResultClose}
        />
      ) : null}

      {activeCharacterReveal ? (
        <GachaCharacterRevealModal
          key={activeRevealIndex}
          reveal={activeCharacterReveal}
          index={activeRevealIndex}
          total={characterReveals.length}
          onClose={handleCharacterRevealClose}
        />
      ) : null}

      <style jsx>{`
        .animate-bag-shake {
          animation: bagShake 0.55s cubic-bezier(0.36, 0.07, 0.19, 0.97) infinite;
        }

        .animate-bag-rainbow {
          animation: bagRainbowShift 1.2s linear infinite;
          filter: saturate(1.35) brightness(1.14);
        }

        .animate-plate-ring {
          animation: plateRing 1.3s ease-in-out infinite;
        }

        .animate-plate-ring-slow {
          animation: plateRingSlow 1.9s ease-in-out infinite;
        }

        .animate-plate-pulse {
          animation: platePulse 1.05s ease-in-out infinite;
        }

        .animate-plate-rays {
          animation: plateRays 1.6s linear infinite;
        }

        .animate-plate-rays-rev {
          animation: plateRaysRev 1.9s linear infinite;
        }

        .animate-smoke-veil {
          animation: smokeVeilPulse 1.2s ease-in-out infinite;
        }

        .animate-smoke-bubble {
          animation: smokeBubbleCover 1.22s ease-in-out infinite both;
          opacity: 0.3;
          transform: translate(-50%, -34%) scale(0.5);
          will-change: transform, opacity;
        }

        .animate-plate-white-flash {
          animation: plateWhiteFlash 1.05s ease-in-out infinite;
        }

        @keyframes bagShake {
          0% {
            left: 0px;
          }
          20% {
            left: -6px;
          }
          40% {
            left: 6px;
          }
          60% {
            left: -5px;
          }
          80% {
            left: 5px;
          }
          100% {
            left: 0px;
          }
        }

        @keyframes bagRainbowShift {
          from {
            filter: hue-rotate(0deg) saturate(1.35) brightness(1.14);
          }
          to {
            filter: hue-rotate(360deg) saturate(1.35) brightness(1.14);
          }
        }

        @keyframes plateRing {
          0% {
            transform: scale(0.9);
            opacity: 0.25;
          }
          50% {
            transform: scale(1.04);
            opacity: 0.72;
          }
          100% {
            transform: scale(0.9);
            opacity: 0.25;
          }
        }

        @keyframes plateRingSlow {
          0% {
            transform: scale(0.88);
            opacity: 0.2;
          }
          50% {
            transform: scale(1.08);
            opacity: 0.58;
          }
          100% {
            transform: scale(0.88);
            opacity: 0.2;
          }
        }

        @keyframes platePulse {
          0% {
            opacity: 0.35;
            transform: scale(0.94);
          }
          50% {
            opacity: 0.95;
            transform: scale(1.08);
          }
          100% {
            opacity: 0.35;
            transform: scale(0.94);
          }
        }

        @keyframes plateRays {
          from {
            transform: rotate(0deg);
            opacity: 0.32;
          }
          to {
            transform: rotate(360deg);
            opacity: 0.62;
          }
        }

        @keyframes plateRaysRev {
          from {
            transform: rotate(360deg);
            opacity: 0.24;
          }
          to {
            transform: rotate(0deg);
            opacity: 0.58;
          }
        }

        @keyframes smokeBubbleCover {
          0% {
            opacity: 0;
            transform: translate(-50%, -26%) scale(0.5);
          }
          20% {
            opacity: 0.92;
            transform: translate(-50%, -40%) scale(0.9);
          }
          58% {
            opacity: 0.88;
            transform: translate(-46%, -62%) scale(1.32);
          }
          100% {
            opacity: 0;
            transform: translate(-54%, -95%) scale(1.72);
          }
        }

        @keyframes smokeVeilPulse {
          0% {
            opacity: 0.48;
            transform: scale(0.95);
          }
          50% {
            opacity: 0.76;
            transform: scale(1.03);
          }
          100% {
            opacity: 0.48;
            transform: scale(0.95);
          }
        }

        @keyframes plateWhiteFlash {
          0% {
            opacity: 0.34;
            transform: scale(0.84);
            filter: blur(18px);
          }
          50% {
            opacity: 1;
            transform: scale(1.05);
            filter: blur(7px);
          }
          100% {
            opacity: 0.42;
            transform: scale(0.9);
            filter: blur(15px);
          }
        }
      `}</style>
    </div>
  );
}
