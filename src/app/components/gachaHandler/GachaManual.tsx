"use client";

type GachaManualProps = {
  onClose: () => void;
  snacksPerReward: number;
};

export default function GachaManual({
  onClose,
  snacksPerReward,
}: GachaManualProps) {
  return (
    <div
      className="fixed inset-0 z-[420] flex items-center justify-center"
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

        <p className="mb-3 text-xl font-black leading-relaxed tracking-wide text-cyan-100 drop-shadow-[0_0_16px_rgba(34,211,238,0.7)]">
          Please keep an eye on our events. Different combinations can update at
          any time, bringing new characters closer and closer to you!
        </p>
        <p className="text-sm font-semibold leading-relaxed text-cyan-200">
          Event rules are independent, and each event can trigger multiple times in one
          OPEN based on how many full requirement sets your selected snacks contain.
        </p>
        <p className="mt-2 text-sm font-semibold leading-relaxed text-cyan-200">
          Fixed lucky rule: every {snacksPerReward} selected snacks gives one independent
          0.1% random character roll.
        </p>
        <p className="text-base font-black tracking-wide text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.6)]">
          Note: You need at least {snacksPerReward} snacks to make a snack pack!
        </p>
      </div>
    </div>
  );
}
