"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_GACHA_RATE_LIST,
  DEFAULT_SNACK_RATE_CONFIG,
  LUCKY_CHARACTER_BONUS_CHANCE,
  SNACK_DEFINITIONS,
  SNACK_KEYS,
  type GachaRateList,
  type ResourceKey,
  type SpecialRateEntry,
} from "./rateConfig";

type ApiResponse = {
  rateList?: GachaRateList;
  characterOptions?: Array<{ id: string; label: string }>;
  error?: string;
};

type EditableSpecialRateEntry = SpecialRateEntry & {
  localRowId: string;
};

type EditableRateList = Omit<GachaRateList, "specialRates"> & {
  specialRates: EditableSpecialRateEntry[];
};

const RESOURCE_OPTIONS: Array<{ key: ResourceKey; label: string }> = [
  { key: "energy_sugar", label: "Energy Sugar" },
  { key: "dream_fruit_dust", label: "Dream Fruit Dust" },
  { key: "core_crunch_seed", label: "Core Crunch Seed" },
  { key: "star_gel_essence", label: "Star Gel Essence" },
  { key: "star_coin", label: "Star Coin" },
  { key: "point", label: "Point" },
];

const toNonNegativeInt = (value: string, fallback: number) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
};

const toPositiveInt = (value: string, fallback: number) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const toChancePercent = (value: string, fallback: number) => {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(100, Math.max(0, parsed));
};

const cloneDeep = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const cloneRateList = (value: GachaRateList): GachaRateList => cloneDeep(value);
const cloneEditableRateList = (value: EditableRateList): EditableRateList =>
  cloneDeep(value);

const ensureUniqueSpecialRateIds = (rates: SpecialRateEntry[]) => {
  const usedIds = new Set<string>();
  return rates.map((rule, index) => {
    const baseId = rule.id?.trim() || `special-rate-${index + 1}`;
    let nextId = baseId;
    let suffix = 2;
    while (usedIds.has(nextId)) {
      nextId = `${baseId}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(nextId);
    return nextId === rule.id ? rule : { ...rule, id: nextId };
  });
};

const normalizeRateList = (value: GachaRateList): GachaRateList => {
  const next = cloneRateList(value);
  next.specialRates = ensureUniqueSpecialRateIds(next.specialRates);
  return next;
};

const createSpecialRateId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `special-${crypto.randomUUID()}`;
  }
  return `special-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

const createLocalRowId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `local-${crypto.randomUUID()}`;
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

const buildNewSpecialRate = (): SpecialRateEntry => ({
  id: createSpecialRateId(),
  name: "New Special Rate",
  requirements: {
    energy_sugar: 1,
    dream_fruit_dust: 0,
    core_crunch_seed: 0,
    star_gel_essence: 0,
  },
  chance: 0.001,
  reward: {
    type: "resource",
    resourceKey: "star_coin",
    name: "Star Coin",
    count: 1,
    icon: "STAR",
  },
});

const toEditableRateList = (value: GachaRateList): EditableRateList => {
  const normalized = normalizeRateList(value);
  return {
    ...normalized,
    specialRates: normalized.specialRates.map((rule) => ({
      ...rule,
      localRowId: createLocalRowId(),
    })),
  };
};

const formatPercent = (value: number, digits = 3) =>
  `${(Math.min(1, Math.max(0, value)) * 100).toFixed(digits)}%`;

const buildRequirementText = (rule: SpecialRateEntry) => {
  const parts = SNACK_DEFINITIONS.filter(
    (snack) => rule.requirements[snack.key] > 0
  ).map((snack) => `${snack.label} x${rule.requirements[snack.key]}`);
  return parts.length > 0
    ? parts.join(" + ")
    : "No snack requirement (rolled once per 5-snack pack)";
};

const buildRewardText = (rule: SpecialRateEntry) => {
  const reward = rule.reward;
  if (reward.type === "character") {
    return `Character: ${reward.name} x${reward.count}`;
  }
  const resourceLabel =
    RESOURCE_OPTIONS.find((option) => option.key === reward.resourceKey)?.label ??
    reward.resourceKey;
  return `Resource: ${resourceLabel} x${reward.count}`;
};

const validateSpecialRates = (rates: SpecialRateEntry[]) => {
  const errors: string[] = [];
  const usedIds = new Set<string>();

  rates.forEach((rule, index) => {
    const row = index + 1;
    if (!rule.id || !rule.id.trim()) {
      errors.push(`Rule #${row}: missing rule ID.`);
      return;
    }
    if (usedIds.has(rule.id)) {
      errors.push(`Rule #${row}: duplicated rule ID "${rule.id}".`);
    }
    usedIds.add(rule.id);

    if (!Number.isFinite(rule.chance) || rule.chance < 0 || rule.chance > 1) {
      errors.push(`Rule #${row}: chance must be between 0% and 100%.`);
    }

    if (!Number.isFinite(rule.reward.count) || rule.reward.count <= 0) {
      errors.push(`Rule #${row}: reward count must be a positive integer.`);
    }

    if (rule.reward.type === "character" && !rule.reward.characterId.trim()) {
      errors.push(`Rule #${row}: character reward is missing character selection.`);
    }
  });

  return errors;
};

export default function RateManager() {
  const [rateList, setRateList] = useState<EditableRateList>(
    toEditableRateList(DEFAULT_GACHA_RATE_LIST)
  );
  const [savedRateList, setSavedRateList] = useState<EditableRateList>(
    toEditableRateList(DEFAULT_GACHA_RATE_LIST)
  );
  const [characterOptions, setCharacterOptions] = useState<
    Array<{ id: string; label: string }>
  >([]);
  const [editingRowIds, setEditingRowIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/gacha-manager", {
        cache: "no-store",
      });
      const data = (await response.json()) as ApiResponse;
      if (!response.ok || !data.rateList) {
        setError(data.error ?? "Failed to load gacha manager config.");
        return;
      }
      const editableRateList = toEditableRateList(data.rateList);
      setRateList(editableRateList);
      setSavedRateList(cloneEditableRateList(editableRateList));
      setEditingRowIds([]);
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

  const minComboRequirement = useMemo(() => {
    const combos = rateList.specialRates.map((rule) =>
      SNACK_KEYS.reduce((sum, key) => sum + rule.requirements[key], 0)
    );
    if (combos.length === 0) return DEFAULT_SNACK_RATE_CONFIG.snacksPerReward;
    return Math.min(DEFAULT_SNACK_RATE_CONFIG.snacksPerReward, ...combos);
  }, [rateList.specialRates]);

  const handleSave = async () => {
    const ratesToSave: SpecialRateEntry[] = rateList.specialRates.map(
      ({ localRowId: _ignored, ...rule }) => rule
    );
    const validationErrors = validateSpecialRates(ratesToSave);
    if (validationErrors.length > 0) {
      setError(validationErrors[0]);
      setMessage("");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    const ruleCountBeforeSave = ratesToSave.length;

    try {
      const response = await fetch("/api/admin/gacha-manager", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          specialRates: ratesToSave,
        }),
      });
      const data = (await response.json()) as ApiResponse;
      if (!response.ok || !data.rateList) {
        setError(data.error ?? "Failed to save gacha manager config.");
        return;
      }
      const editableRateList = toEditableRateList(data.rateList);
      setRateList(editableRateList);
      setSavedRateList(cloneEditableRateList(editableRateList));
      setEditingRowIds([]);
      if (data.rateList.specialRates.length !== ruleCountBeforeSave) {
        setError(
          `Saved ${data.rateList.specialRates.length}/${ruleCountBeforeSave} rules. Please check for invalid entries.`
        );
        return;
      }
      setMessage(`RateList updated. ${data.rateList.specialRates.length} combo rules saved.`);
    } catch (saveError) {
      console.error(saveError);
      setError("Failed to save gacha manager config.");
    } finally {
      setSaving(false);
    }
  };

  const updateSpecialRate = (
    localRowId: string,
    updater: (current: EditableSpecialRateEntry) => EditableSpecialRateEntry
  ) => {
    setRateList((prev) => {
      const next = cloneEditableRateList(prev);
      const targetIndex = next.specialRates.findIndex(
        (entry) => entry.localRowId === localRowId
      );
      if (targetIndex < 0) return prev;
      next.specialRates[targetIndex] = updater(next.specialRates[targetIndex]);
      return next;
    });
  };

  const addSpecialRate = () => {
    const newLocalRowId = createLocalRowId();
    setRateList((prev) => {
      const next = cloneEditableRateList(prev);
      let newRule = buildNewSpecialRate();
      while (next.specialRates.some((entry) => entry.id === newRule.id)) {
        newRule = { ...newRule, id: createSpecialRateId() };
      }
      next.specialRates.push({
        ...newRule,
        localRowId: newLocalRowId,
      });
      return next;
    });
    setEditingRowIds((prev) =>
      prev.includes(newLocalRowId) ? prev : [...prev, newLocalRowId]
    );
  };

  const removeSpecialRate = (localRowId: string) => {
    setRateList((prev) => {
      const next = cloneEditableRateList(prev);
      const targetIndex = next.specialRates.findIndex(
        (entry) => entry.localRowId === localRowId
      );
      if (targetIndex < 0) return prev;
      next.specialRates.splice(targetIndex, 1);
      return next;
    });
    setEditingRowIds((prev) => prev.filter((entry) => entry !== localRowId));
  };

  const startEditing = (localRowId: string) => {
    setEditingRowIds((prev) =>
      prev.includes(localRowId) ? prev : [...prev, localRowId]
    );
  };

  const stopEditing = (localRowId: string) => {
    setEditingRowIds((prev) => prev.filter((entry) => entry !== localRowId));
  };

  if (loading) {
    return <p className="text-slate-300">Loading gacha manager config...</p>;
  }

  return (
    <div className="space-y-5">
      {error ? (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">
          {message}
        </div>
      ) : null}

      <section className="space-y-4 rounded-lg border border-slate-700 bg-slate-900/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-200">
            Special Combo Rates
          </h2>
          <button
            type="button"
            onClick={addSpecialRate}
            className="rounded-md border border-violet-500/60 bg-violet-900/40 px-3 py-1.5 text-xs text-violet-100 transition hover:bg-violet-800/60"
          >
            Add Combo Rule
          </button>
        </div>

        {rateList.specialRates.length === 0 ? (
          <div className="rounded-lg border border-slate-700 bg-slate-950/40 px-4 py-4 text-sm text-slate-400">
            No special combo rule yet.
          </div>
        ) : (
          <div className="space-y-4">
            {rateList.specialRates.map((rule) => {
              const isEditing = editingRowIds.includes(rule.localRowId);
              if (!isEditing) {
                return (
                  <div
                    key={rule.localRowId}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-950/45 px-4 py-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-semibold text-slate-100">
                        {rule.name || "Unnamed Rule"}
                      </p>
                      <p className="text-xs text-slate-400">
                        {formatPercent(rule.chance, 4)} | {buildRequirementText(rule)} |{" "}
                        {buildRewardText(rule)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startEditing(rule.localRowId)}
                        className="rounded-md border border-amber-500/60 bg-amber-900/45 px-3 py-1.5 text-xs text-amber-100 transition hover:bg-amber-800/65"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => removeSpecialRate(rule.localRowId)}
                        className="rounded-md border border-rose-500/60 bg-rose-900/45 px-3 py-1.5 text-xs text-rose-100 transition hover:bg-rose-800/65"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={rule.localRowId}
                  className="space-y-3 rounded-lg border border-slate-700 bg-slate-950/45 p-4"
                >
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="space-y-2 text-xs">
                    <span className="text-slate-300">Rule Name</span>
                    <input
                      type="text"
                      value={rule.name}
                      onChange={(event) =>
                        updateSpecialRate(rule.localRowId, (current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none transition focus:border-sky-400"
                    />
                  </label>

                  <label className="space-y-2 text-xs">
                    <span className="text-slate-300">Chance (%)</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.001}
                      value={Number((rule.chance * 100).toFixed(4))}
                      onChange={(event) =>
                        updateSpecialRate(rule.localRowId, (current) => ({
                          ...current,
                          chance: toChancePercent(event.target.value, current.chance * 100) / 100,
                        }))
                      }
                      className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none transition focus:border-sky-400"
                    />
                  </label>

                  <div className="flex items-end justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => stopEditing(rule.localRowId)}
                      className="rounded-md border border-slate-500/70 bg-slate-800 px-3 py-2 text-xs text-slate-100 transition hover:bg-slate-700"
                    >
                      Done
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSpecialRate(rule.localRowId)}
                      className="rounded-md border border-rose-500/60 bg-rose-900/45 px-3 py-2 text-xs text-rose-100 transition hover:bg-rose-800/65"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                    Required Snacks (Condition Per Make)
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {SNACK_DEFINITIONS.map((snack) => (
                      <label key={snack.key} className="space-y-1 text-xs">
                        <span className="text-slate-300">{snack.label}</span>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={rule.requirements[snack.key]}
                          onChange={(event) =>
                            updateSpecialRate(rule.localRowId, (current) => ({
                              ...current,
                              requirements: {
                                ...current.requirements,
                                [snack.key]: toNonNegativeInt(
                                  event.target.value,
                                  current.requirements[snack.key]
                                ),
                              },
                            }))
                          }
                          className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none transition focus:border-sky-400"
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                    Reward
                  </p>

                  <div className="grid gap-3 sm:grid-cols-4">
                    <label className="space-y-1 text-xs">
                      <span className="text-slate-300">Type</span>
                      <select
                        value={rule.reward.type}
                        onChange={(event) =>
                          updateSpecialRate(rule.localRowId, (current) => {
                            if (event.target.value === "character") {
                              const defaultCharacter = characterOptions[0];
                              return {
                                ...current,
                                reward: {
                                  type: "character",
                                  characterId: defaultCharacter?.id ?? "",
                                  name: defaultCharacter?.label ?? "Character",
                                  count: 1,
                                  icon: "CHAR",
                                },
                              };
                            }
                            return {
                              ...current,
                              reward: {
                                type: "resource",
                                resourceKey: "star_coin",
                                name: "Star Coin",
                                count: 1,
                                icon: "STAR",
                              },
                            };
                          })
                        }
                        className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none transition focus:border-sky-400"
                      >
                        <option value="resource">Resource</option>
                        <option value="character">Character</option>
                      </select>
                    </label>

                    {rule.reward.type === "resource" ? (
                      <label className="space-y-1 text-xs">
                        <span className="text-slate-300">Resource Key</span>
                        <select
                          value={rule.reward.resourceKey}
                          onChange={(event) =>
                            updateSpecialRate(rule.localRowId, (current) => {
                              if (current.reward.type !== "resource") return current;
                              return {
                                ...current,
                                reward: {
                                  ...current.reward,
                                  resourceKey: event.target.value as ResourceKey,
                                },
                              };
                            })
                          }
                          className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none transition focus:border-sky-400"
                        >
                          {RESOURCE_OPTIONS.map((option) => (
                            <option key={option.key} value={option.key}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      (() => {
                        const currentCharacterId =
                          "characterId" in rule.reward ? rule.reward.characterId : "";
                        const hasOption = characterOptions.some(
                          (option) => option.id === currentCharacterId
                        );
                        return (
                          <label className="space-y-1 text-xs">
                            <span className="text-slate-300">Character</span>
                            <select
                              value={currentCharacterId}
                              onChange={(event) =>
                                updateSpecialRate(rule.localRowId, (current) => {
                                  if (current.reward.type !== "character") return current;
                                  const selectedCharacter = characterOptions.find(
                                    (option) => option.id === event.target.value
                                  );
                                  return {
                                    ...current,
                                    reward: {
                                      ...current.reward,
                                      characterId: event.target.value,
                                      name: selectedCharacter?.label ?? current.reward.name,
                                    },
                                  };
                                })
                              }
                              disabled={characterOptions.length === 0 && !currentCharacterId}
                              className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none transition focus:border-sky-400"
                            >
                              {currentCharacterId && !hasOption ? (
                                <option value={currentCharacterId}>
                                  {rule.reward.name || currentCharacterId}
                                </option>
                              ) : null}
                              {characterOptions.length === 0 ? (
                                <option value="">
                                  No character options available
                                </option>
                              ) : null}
                              {characterOptions.map((option) => (
                                <option key={option.id} value={option.id}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        );
                      })()
                    )}

                    <label className="space-y-1 text-xs">
                      <span className="text-slate-300">Reward Name</span>
                      <input
                        type="text"
                        value={rule.reward.name}
                        onChange={(event) =>
                          updateSpecialRate(rule.localRowId, (current) => ({
                            ...current,
                            reward: {
                              ...current.reward,
                              name: event.target.value,
                            },
                          }))
                        }
                        className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none transition focus:border-sky-400"
                      />
                    </label>

                    <label className="space-y-1 text-xs">
                      <span className="text-slate-300">Count</span>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={rule.reward.count}
                        onChange={(event) =>
                          updateSpecialRate(rule.localRowId, (current) => ({
                            ...current,
                            reward: {
                              ...current.reward,
                              count: toPositiveInt(event.target.value, current.reward.count),
                            },
                          }))
                        }
                        className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none transition focus:border-sky-400"
                      />
                    </label>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-300">
        <p>
          Global gacha rates are loaded from <code>gachaHandler/RateList.json</code>.
        </p>
        <p className="mt-2">
          Base rule is fixed: every {DEFAULT_SNACK_RATE_CONFIG.snacksPerReward} snacks guarantees 1 snack reward.
        </p>
        <p className="mt-2">
          Special rules are rolled independently. A single rule can be rolled multiple times
          in one OPEN according to how many full requirement sets match the selected snacks.
        </p>
        <p className="mt-2">
          Fixed lucky rule: every {DEFAULT_SNACK_RATE_CONFIG.snacksPerReward} snacks gives
          one independent {(LUCKY_CHARACTER_BONUS_CHANCE * 100).toFixed(1)}% random character roll.
        </p>
        <p className="mt-2">
          Current minimum snacks to trigger at least one rule: {minComboRequirement}
        </p>
        {rateList.updatedAt ? (
          <p className="mt-2 text-xs text-slate-500">
            Last updated: {new Date(rateList.updatedAt).toLocaleString()}
          </p>
        ) : null}
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void loadConfig()}
          disabled={saving}
          className="rounded-md border border-slate-500 bg-slate-800 px-4 py-2 text-sm text-slate-100 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Reload
        </button>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="rounded-md border border-sky-500/60 bg-sky-900/50 px-4 py-2 text-sm text-sky-100 transition hover:bg-sky-800/70 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save RateList"}
        </button>
      </div>

      <section className="min-h-[440px] rounded-lg border border-slate-700 bg-slate-900/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold text-slate-100">
            All Current Special Combo Rates
          </h3>
          <span className="text-xs text-slate-400">
            {savedRateList.specialRates.length} saved rule
            {savedRateList.specialRates.length === 1 ? "" : "s"}
          </span>
        </div>

        {savedRateList.specialRates.length === 0 ? (
          <p className="mt-4 rounded-md border border-slate-700 bg-slate-950/40 px-4 py-3 text-sm text-slate-400">
            No special combo rates configured.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-md border border-slate-700">
            <table className="min-w-[980px] table-auto text-sm">
              <thead className="bg-slate-900/70 text-slate-100">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">#</th>
                  <th className="px-3 py-2 text-left font-semibold">Rule Name</th>
                  <th className="px-3 py-2 text-left font-semibold">Chance</th>
                  <th className="px-3 py-2 text-left font-semibold">Condition</th>
                  <th className="px-3 py-2 text-left font-semibold">Reward</th>
                  <th className="px-3 py-2 text-left font-semibold">Rule ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700 text-slate-200">
                {savedRateList.specialRates.map((rule, index) => (
                  <tr key={`summary-${rule.localRowId}`}>
                    <td className="px-3 py-2 font-medium text-slate-300">{index + 1}</td>
                    <td className="px-3 py-2">{rule.name || `Rule ${index + 1}`}</td>
                    <td className="px-3 py-2">{formatPercent(rule.chance, 4)}</td>
                    <td className="px-3 py-2">{buildRequirementText(rule)}</td>
                    <td className="px-3 py-2">{buildRewardText(rule)}</td>
                    <td className="px-3 py-2 text-xs text-slate-400">{rule.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
