"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_GACHA_RATE_LIST,
  DEFAULT_SNACK_RATE_CONFIG,
  LUCKY_CHARACTER_BONUS_CHANCE,
  SNACK_DEFINITIONS,
  SNACK_KEYS,
  ZERO_SNACK_INVENTORY,
  type GachaRateList,
  type SnackInventory,
  type SnackKey,
} from "./rateConfig";

type ApiResponse = {
  rateList?: GachaRateList;
  characterOptions?: CharacterOption[];
  error?: string;
};

type CharacterOption = {
  id: string;
  label: string;
};

type RuleReport = {
  id: string;
  name: string;
  rewardLabel: string;
  triggerAttempts: number;
  conditionText: string;
  chance: number;
  atLeastOneTriggerChance: number;
  expectedRewardCount: number;
};

type BaseSnackReport = {
  key: SnackKey;
  label: string;
  perRollChance: number;
  atLeastOneChance: number;
  expectedCount: number;
};

type CharacterChanceReport = {
  id: string;
  label: string;
  specialChance: number;
  luckyChance: number;
  totalChance: number;
};

type TestReport = {
  selected: SnackInventory;
  totalSelected: number;
  ratios: Record<SnackKey, number>;
  rules: RuleReport[];
  eligibleSpecialRuleCount: number;
  anySpecialRewardChance: number;
  rewardPacks: number;
  baseRollCount: number;
  baseResults: BaseSnackReport[];
  expectedTotalBaseRewards: number;
  anyCharacterChance: number;
  characterChances: CharacterChanceReport[];
};

const cloneInventory = (): SnackInventory => ({ ...ZERO_SNACK_INVENTORY });

const toNonNegativeInt = (value: string, fallback: number) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
};

const sumInventory = (inventory: SnackInventory) =>
  SNACK_KEYS.reduce((sum, key) => sum + inventory[key], 0);

const formatPercent = (value: number, digits = 3) =>
  `${(value * 100).toFixed(digits)}%`;

const formatExpected = (value: number) => value.toFixed(3);

const cloneRateList = (value: GachaRateList): GachaRateList =>
  JSON.parse(JSON.stringify(value)) as GachaRateList;

const getRewardLabel = (rule: GachaRateList["specialRates"][number]) => {
  if (rule.reward.type === "character") return `Character: ${rule.reward.name}`;
  return `Resource: ${rule.reward.name}`;
};

const normalizeCharacterId = (value: string) => value.trim().toLowerCase();

const buildReport = (
  selection: SnackInventory,
  rateList: GachaRateList,
  characterOptions: CharacterOption[]
): TestReport => {
  const selected: SnackInventory = { ...selection };
  const totalSelected = sumInventory(selected);
  const rewardPacks = Math.floor(
    totalSelected / DEFAULT_SNACK_RATE_CONFIG.snacksPerReward
  );
  const ratios = Object.fromEntries(
    SNACK_KEYS.map((key) => [
      key,
      totalSelected > 0 ? selected[key] / totalSelected : 0,
    ])
  ) as Record<SnackKey, number>;

  const getRuleTriggerAttempts = (requirements: SnackInventory) => {
    const requiredKeys = SNACK_KEYS.filter((key) => requirements[key] > 0);
    if (requiredKeys.length === 0) return rewardPacks;
    return requiredKeys.reduce((minAttempts, key) => {
      const requiredCount = requirements[key];
      if (requiredCount <= 0) return minAttempts;
      const attempts = Math.floor(selected[key] / requiredCount);
      return Math.min(minAttempts, attempts);
    }, Number.POSITIVE_INFINITY);
  };

  const rules: RuleReport[] = rateList.specialRates.map((rule) => {
    const requirementParts = SNACK_DEFINITIONS.filter(
      (snack) => rule.requirements[snack.key] > 0
    ).map((snack) => `${snack.label} x${rule.requirements[snack.key]}`);
    const conditionText = requirementParts.length > 0
      ? requirementParts.join(", ")
      : "No requirement (rolled once per 5-snack pack)";
    const safeChance = Math.min(1, Math.max(0, rule.chance));
    const triggerAttempts = getRuleTriggerAttempts(rule.requirements);
    const atLeastOneTriggerChance =
      triggerAttempts > 0 ? 1 - Math.pow(1 - safeChance, triggerAttempts) : 0;
    const expectedRewardCount =
      triggerAttempts > 0
        ? triggerAttempts * safeChance * rule.reward.count
        : 0;

    return {
      id: rule.id,
      name: rule.name,
      rewardLabel: getRewardLabel(rule),
      triggerAttempts,
      conditionText,
      chance: safeChance,
      atLeastOneTriggerChance,
      expectedRewardCount,
    };
  });

  const eligibleSpecialRuleCount = rules.filter(
    (rule) => rule.triggerAttempts > 0
  ).length;
  const anySpecialRewardChance =
    eligibleSpecialRuleCount > 0
      ? 1 -
        rules.reduce(
          (none, rule) =>
            none * Math.pow(1 - rule.chance, Math.max(0, rule.triggerAttempts)),
          1
        )
      : 0;

  const baseRollCount =
    rewardPacks *
    DEFAULT_SNACK_RATE_CONFIG.rewardCount *
    DEFAULT_SNACK_RATE_CONFIG.dropChance;

  const totalWeight = SNACK_KEYS.reduce(
    (sum, key) => sum + DEFAULT_SNACK_RATE_CONFIG.weights[key],
    0
  );

  const baseResults: BaseSnackReport[] = SNACK_DEFINITIONS.map((snack) => {
    const weight = DEFAULT_SNACK_RATE_CONFIG.weights[snack.key];
    const perRollChance = totalWeight > 0 ? weight / totalWeight : 0;
    const atLeastOneChance =
      baseRollCount > 0 ? 1 - Math.pow(1 - perRollChance, baseRollCount) : 0;
    const expectedCount = baseRollCount * perRollChance;
    return {
      key: snack.key,
      label: snack.label,
      perRollChance,
      atLeastOneChance,
      expectedCount,
    };
  });

  const characterMetaByNormalizedId = new Map<
    string,
    { id: string; label: string }
  >();
  const characterNormalizedIdsInOrder: string[] = [];
  const addCharacterMeta = (id: string, label: string) => {
    const normalizedId = normalizeCharacterId(id);
    if (!normalizedId) return;
    if (!characterMetaByNormalizedId.has(normalizedId)) {
      characterNormalizedIdsInOrder.push(normalizedId);
      characterMetaByNormalizedId.set(normalizedId, {
        id,
        label: label || id,
      });
      return;
    }
    const current = characterMetaByNormalizedId.get(normalizedId)!;
    characterMetaByNormalizedId.set(normalizedId, {
      id: current.id,
      label: current.label || label || id,
    });
  };

  characterOptions.forEach((character) =>
    addCharacterMeta(character.id, character.label)
  );
  rateList.specialRates.forEach((rule) => {
    if (rule.reward.type !== "character") return;
    addCharacterMeta(rule.reward.characterId, rule.reward.name || rule.reward.characterId);
  });

  const perCharacterLuckyChancePerPack =
    characterNormalizedIdsInOrder.length > 0
      ? LUCKY_CHARACTER_BONUS_CHANCE / characterNormalizedIdsInOrder.length
      : 0;

  const characterChances: CharacterChanceReport[] = characterNormalizedIdsInOrder.map(
    (normalizedCharacterId) => {
      const specialChanceNone = rateList.specialRates.reduce((none, rule) => {
        if (rule.reward.type !== "character") return none;
        if (
          normalizeCharacterId(rule.reward.characterId) !== normalizedCharacterId
        ) {
          return none;
        }
        const triggerAttempts = getRuleTriggerAttempts(rule.requirements);
        if (!Number.isFinite(triggerAttempts) || triggerAttempts <= 0) return none;
        const chance = Math.min(1, Math.max(0, rule.chance));
        return none * Math.pow(1 - chance, triggerAttempts);
      }, 1);

      const specialChance = 1 - specialChanceNone;
      const luckyChance =
        rewardPacks > 0
          ? 1 -
            Math.pow(
              1 - perCharacterLuckyChancePerPack,
              rewardPacks
            )
          : 0;
      const totalChance = 1 - (1 - specialChance) * (1 - luckyChance);
      const meta = characterMetaByNormalizedId.get(normalizedCharacterId);
      return {
        id: meta?.id ?? normalizedCharacterId,
        label: meta?.label ?? normalizedCharacterId,
        specialChance,
        luckyChance,
        totalChance,
      };
    }
  );

  const anyCharacterFromSpecialNone = rateList.specialRates.reduce((none, rule) => {
    if (rule.reward.type !== "character") return none;
    const triggerAttempts = getRuleTriggerAttempts(rule.requirements);
    if (!Number.isFinite(triggerAttempts) || triggerAttempts <= 0) return none;
    const chance = Math.min(1, Math.max(0, rule.chance));
    return none * Math.pow(1 - chance, triggerAttempts);
  }, 1);
  const luckyAnyCharacterChance =
    characterNormalizedIdsInOrder.length > 0 && rewardPacks > 0
      ? 1 - Math.pow(1 - LUCKY_CHARACTER_BONUS_CHANCE, rewardPacks)
      : 0;
  const anyCharacterChance =
    1 - anyCharacterFromSpecialNone * (1 - luckyAnyCharacterChance);

  return {
    selected,
    totalSelected,
    ratios,
    rules,
    eligibleSpecialRuleCount,
    anySpecialRewardChance,
    rewardPacks,
    baseRollCount,
    baseResults,
    expectedTotalBaseRewards: baseResults.reduce(
      (sum, entry) => sum + entry.expectedCount,
      0
    ),
    anyCharacterChance,
    characterChances,
  };
};

export default function GachaTest() {
  const [rateList, setRateList] = useState<GachaRateList>(
    cloneRateList(DEFAULT_GACHA_RATE_LIST)
  );
  const [characterOptions, setCharacterOptions] = useState<CharacterOption[]>([]);
  const [selection, setSelection] = useState<SnackInventory>(cloneInventory());
  const [report, setReport] = useState<TestReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/gacha-manager", {
        cache: "no-store",
      });
      const data = (await response.json()) as ApiResponse;
      if (!response.ok || !data.rateList) {
        setError(data.error ?? "Failed to load gacha manager config.");
        return;
      }
      setRateList(cloneRateList(data.rateList));
      setCharacterOptions(
        Array.isArray(data.characterOptions) ? data.characterOptions : []
      );
    } catch (loadError) {
      console.error(loadError);
      setError("Failed to load gacha manager config.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const totalSelected = useMemo(() => sumInventory(selection), [selection]);

  const handleSelectionChange = (key: SnackKey, value: string) => {
    setSelection((prev) => ({
      ...prev,
      [key]: toNonNegativeInt(value, prev[key]),
    }));
  };

  const handleConfirm = () => {
    setReport(buildReport(selection, rateList, characterOptions));
  };

  return (
    <section className="space-y-5 rounded-xl border border-slate-700 bg-slate-900/60 p-5">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-slate-100">Gacha Test</h2>
        <p className="text-xs text-slate-400">
          Test is based on current saved RateList and fixed base rule: every{" "}
          {DEFAULT_SNACK_RATE_CONFIG.snacksPerReward} snacks guarantees 1 snack.
        </p>
        <p className="text-xs text-slate-400">
          Special rules are independent, and each rule can be checked multiple times
          in one OPEN based on full requirement-set matches.
        </p>
        <p className="text-xs text-slate-400">
          Includes lucky random character chance: {formatPercent(LUCKY_CHARACTER_BONUS_CHANCE, 3)}
          {" "}per 5-snack pack.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {SNACK_DEFINITIONS.map((snack) => {
          const ratio = totalSelected > 0 ? selection[snack.key] / totalSelected : 0;
          return (
            <label
              key={snack.key}
              className="space-y-1 rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-3 text-xs"
            >
              <span className="flex items-center gap-2 text-slate-200">
                <img
                  src={snack.imagePath}
                  alt={snack.label}
                  className="h-5 w-5 object-contain"
                />
                {snack.label}
              </span>
              <input
                type="number"
                min={0}
                step={1}
                value={selection[snack.key]}
                onChange={(event) =>
                  handleSelectionChange(snack.key, event.target.value)
                }
                className="w-full rounded-md border border-slate-600 bg-slate-800 px-2 py-1.5 text-slate-100 outline-none transition focus:border-sky-400"
              />
              <p className="text-[11px] text-slate-400">
                Ratio: {formatPercent(ratio, 2)}
              </p>
            </label>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={loading}
          className="rounded-md border border-emerald-500/60 bg-emerald-900/45 px-4 py-2 text-sm text-emerald-100 transition hover:bg-emerald-800/60 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Confirm
        </button>
        <button
          type="button"
          onClick={() => void loadConfig()}
          disabled={loading}
          className="rounded-md border border-slate-600 bg-slate-800 px-4 py-2 text-sm text-slate-100 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Reload Rates
        </button>
        <span className="text-xs text-slate-400">Total Snacks: {totalSelected}</span>
      </div>

      {report ? (
        <div className="space-y-5 rounded-lg border border-slate-700 bg-slate-950/45 p-4 text-sm text-slate-200">
          <div className="space-y-2">
            <h3 className="text-base font-semibold text-slate-100">Selection Summary</h3>
            <div className="overflow-x-auto rounded-md border border-slate-700">
              <table className="min-w-full table-auto text-sm">
                <tbody className="divide-y divide-slate-700">
                  <tr>
                    <th className="w-64 bg-slate-900/70 px-3 py-2 text-left font-semibold text-slate-100">
                      Total Input Snacks
                    </th>
                    <td className="px-3 py-2">{report.totalSelected}</td>
                  </tr>
                  <tr>
                    <th className="bg-slate-900/70 px-3 py-2 text-left font-semibold text-slate-100">
                      Eligible Special Rules
                    </th>
                    <td className="px-3 py-2">{report.eligibleSpecialRuleCount}</td>
                  </tr>
                  <tr>
                    <th className="bg-slate-900/70 px-3 py-2 text-left font-semibold text-slate-100">
                      Any Special Reward Chance
                    </th>
                    <td className="px-3 py-2">
                      {formatPercent(report.anySpecialRewardChance)}
                    </td>
                  </tr>
                  <tr>
                    <th className="bg-slate-900/70 px-3 py-2 text-left font-semibold text-slate-100">
                      Base Packs From Total Snacks
                    </th>
                    <td className="px-3 py-2">
                      {report.totalSelected} total {"->"} {report.rewardPacks} packs
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="overflow-x-auto rounded-md border border-slate-700">
              <table className="min-w-full table-auto text-sm">
                <thead className="bg-slate-900/70 text-slate-100">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Snack</th>
                    <th className="px-3 py-2 text-left font-semibold">Input Count</th>
                    <th className="px-3 py-2 text-left font-semibold">Input Ratio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {SNACK_DEFINITIONS.map((snack) => (
                    <tr key={snack.key}>
                      <td className="px-3 py-2">{snack.label}</td>
                      <td className="px-3 py-2">{report.selected[snack.key]}</td>
                      <td className="px-3 py-2">
                        {formatPercent(report.ratios[snack.key], 2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-base font-semibold text-slate-100">
              Special Rule Probabilities
            </h3>
            {report.rules.length === 0 ? (
              <p className="rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-300">
                No special rate rules configured.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-slate-700">
                <table className="min-w-[980px] table-auto text-sm">
                  <thead className="bg-slate-900/70 text-slate-100">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Rule</th>
                      <th className="px-3 py-2 text-left font-semibold">Reward</th>
                      <th className="px-3 py-2 text-left font-semibold">Condition</th>
                      <th className="px-3 py-2 text-left font-semibold">Trigger Attempts This Open</th>
                      <th className="px-3 py-2 text-left font-semibold">Configured Chance</th>
                      <th className="px-3 py-2 text-left font-semibold">At Least One Trigger Chance This Open</th>
                      <th className="px-3 py-2 text-left font-semibold">Expected Reward Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {report.rules.map((rule) => (
                      <tr key={rule.id}>
                        <td className="px-3 py-2">{rule.name}</td>
                        <td className="px-3 py-2">{rule.rewardLabel}</td>
                        <td className="px-3 py-2">{rule.conditionText}</td>
                        <td className="px-3 py-2">{rule.triggerAttempts}</td>
                        <td className="px-3 py-2">{formatPercent(rule.chance)}</td>
                        <td className="px-3 py-2">
                          {formatPercent(rule.atLeastOneTriggerChance)}
                        </td>
                        <td className="px-3 py-2">
                          {formatExpected(rule.expectedRewardCount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-base font-semibold text-slate-100">Base Rule Probabilities</h3>
            <div className="overflow-x-auto rounded-md border border-slate-700">
              <table className="min-w-full table-auto text-sm">
                <tbody className="divide-y divide-slate-700">
                  <tr>
                    <th className="w-64 bg-slate-900/70 px-3 py-2 text-left font-semibold text-slate-100">
                      Base Roll Count
                    </th>
                    <td className="px-3 py-2">{report.baseRollCount}</td>
                  </tr>
                  <tr>
                    <th className="bg-slate-900/70 px-3 py-2 text-left font-semibold text-slate-100">
                      Expected Total Base Rewards
                    </th>
                    <td className="px-3 py-2">
                      {formatExpected(report.expectedTotalBaseRewards)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="overflow-x-auto rounded-md border border-slate-700">
              <table className="min-w-full table-auto text-sm">
                <thead className="bg-slate-900/70 text-slate-100">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Snack</th>
                    <th className="px-3 py-2 text-left font-semibold">Per Roll Chance</th>
                    <th className="px-3 py-2 text-left font-semibold">At Least One Chance</th>
                    <th className="px-3 py-2 text-left font-semibold">Expected Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {report.baseResults.map((entry) => (
                    <tr key={entry.key}>
                      <td className="px-3 py-2">{entry.label}</td>
                      <td className="px-3 py-2">{formatPercent(entry.perRollChance)}</td>
                      <td className="px-3 py-2">
                        {formatPercent(entry.atLeastOneChance)}
                      </td>
                      <td className="px-3 py-2">{formatExpected(entry.expectedCount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-base font-semibold text-slate-100">
              Total Character Obtain Probability
            </h3>
            <div className="overflow-x-auto rounded-md border border-slate-700">
              <table className="min-w-full table-auto text-sm">
                <tbody className="divide-y divide-slate-700">
                  <tr>
                    <th className="w-64 bg-slate-900/70 px-3 py-2 text-left font-semibold text-slate-100">
                      Any Character This Open
                    </th>
                    <td className="px-3 py-2">{formatPercent(report.anyCharacterChance, 4)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {report.characterChances.length === 0 ? (
              <p className="rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-300">
                No character list available.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-slate-700">
                <table className="min-w-full table-auto text-sm">
                  <thead className="bg-slate-900/70 text-slate-100">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Character</th>
                      <th className="px-3 py-2 text-left font-semibold">From Special Rules</th>
                      <th className="px-3 py-2 text-left font-semibold">From Lucky Random</th>
                      <th className="px-3 py-2 text-left font-semibold">Total This Open</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {report.characterChances.map((character) => (
                      <tr key={character.id}>
                        <td className="px-3 py-2">{character.label}</td>
                        <td className="px-3 py-2">
                          {formatPercent(character.specialChance, 4)}
                        </td>
                        <td className="px-3 py-2">
                          {formatPercent(character.luckyChance, 4)}
                        </td>
                        <td className="px-3 py-2 font-semibold text-emerald-300">
                          {formatPercent(character.totalChance, 4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
