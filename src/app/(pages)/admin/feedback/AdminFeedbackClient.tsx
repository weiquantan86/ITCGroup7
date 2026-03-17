"use client";

import { useMemo, useState } from "react";

type FeedbackRow = {
  id: number;
  user_id: number;
  username: string;
  status: string;
  report_date: string;
  settle_date: string | null;
  description: string | null;
};

type AdminFeedbackClientProps = {
  initialFeedbackRows: FeedbackRow[];
  rewardResourceKeys: string[];
};

type RewardDraftRow = {
  key: string;
  amount: string;
};

type FeedbackPatchResponse = {
  success?: boolean;
  emailed?: boolean;
  feedback?: FeedbackRow;
  error?: string;
};

type NotionSyncResponse = {
  success?: boolean;
  notionSynced?: boolean;
  syncedCount?: number;
  totalCount?: number;
  fullReplace?: boolean;
  archivedCount?: number;
  duplicateArchivedCount?: number;
  orphanArchivedCount?: number;
  failedRows?: Array<{ id?: number; reason?: string }>;
  error?: string;
  reason?: string;
};

const TERMINAL_STATUSES = new Set(["done", "in_valid"]);

const STATUS_COLORS: Record<string, string> = {
  not_started: "border-slate-500/40 bg-slate-500/15 text-slate-200",
  validating: "border-amber-400/40 bg-amber-400/15 text-amber-200",
  in_progress: "border-sky-400/40 bg-sky-400/15 text-sky-200",
  in_valid: "border-slate-400/40 bg-slate-400/15 text-slate-200",
  done: "border-emerald-400/40 bg-emerald-400/15 text-emerald-200",
};

const STATUS_OPTIONS = [
  { value: "validating", label: "validating" },
  { value: "in_progress", label: "in_progress" },
  { value: "in_valid", label: "in_valid (invalid)" },
  { value: "done", label: "done" },
];

const toTitleCase = (value: string) =>
  value
    .split("_")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

const formatStableDateTime = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toISOString().slice(0, 19).replace("T", " ")} UTC`;
};

export default function AdminFeedbackClient({
  initialFeedbackRows,
  rewardResourceKeys,
}: AdminFeedbackClientProps) {
  const [feedbackRows, setFeedbackRows] = useState<FeedbackRow[]>(initialFeedbackRows);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [nextStatus, setNextStatus] = useState("validating");
  const [emailTitle, setEmailTitle] = useState("");
  const [emailDescription, setEmailDescription] = useState("");
  const [rewardRows, setRewardRows] = useState<RewardDraftRow[]>(() => [
    {
      key: rewardResourceKeys[0] ?? "",
      amount: "",
    },
  ]);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [syncingTable, setSyncingTable] = useState(false);

  const editingFeedback = useMemo(
    () => feedbackRows.find((item) => item.id === editingId) ?? null,
    [feedbackRows, editingId]
  );

  const openEditor = (row: FeedbackRow) => {
    setEditingId(row.id);
    setNextStatus("validating");
    setEmailTitle("");
    setEmailDescription("");
    setRewardRows([
      {
        key: rewardResourceKeys[0] ?? "",
        amount: "",
      },
    ]);
    setErrorMessage("");
  };

  const closeEditor = () => {
    setEditingId(null);
    setSubmitting(false);
    setErrorMessage("");
  };

  const addRewardRow = () => {
    setRewardRows((previous) => [
      ...previous,
      {
        key: rewardResourceKeys[0] ?? "",
        amount: "",
      },
    ]);
  };

  const updateRewardRow = (
    index: number,
    field: keyof RewardDraftRow,
    value: string
  ) => {
    setRewardRows((previous) =>
      previous.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row
      )
    );
  };

  const removeRewardRow = (index: number) => {
    setRewardRows((previous) => previous.filter((_row, rowIndex) => rowIndex !== index));
  };

  const buildRewardPayload = () => {
    const reward: Record<string, number> = {};
    for (const row of rewardRows) {
      const key = row.key.trim();
      if (!key) continue;
      const amount = Number.parseInt(row.amount.trim(), 10);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      reward[key] = (reward[key] ?? 0) + amount;
    }
    return reward;
  };

  const handleSubmit = async () => {
    if (!editingFeedback || submitting) return;

    const payload: {
      status: string;
      email?: { title: string; description: string; reward: Record<string, number> };
    } = {
      status: nextStatus,
    };

    if (nextStatus === "done") {
      const title = emailTitle.trim();
      const description = emailDescription.trim();
      const reward = buildRewardPayload();
      if (!title || !description) {
        setErrorMessage("Done requires email title and description.");
        return;
      }
      if (Object.keys(reward).length === 0) {
        setErrorMessage("Done requires at least one reward.");
        return;
      }
      payload.email = { title, description, reward };
    }

    setSubmitting(true);
    setErrorMessage("");
    setStatusMessage("");
    try {
      const response = await fetch(`/api/admin/feedback/${editingFeedback.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as FeedbackPatchResponse;
      if (!response.ok || !data.success || !data.feedback) {
        throw new Error(data.error || "Failed to update feedback.");
      }

      setFeedbackRows((previous) =>
        previous.map((item) =>
          item.id === data.feedback!.id ? data.feedback! : item
        )
      );
      setStatusMessage(
        data.emailed
          ? "Feedback updated and email sent to player."
          : "Feedback status updated."
      );
      closeEditor();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to update feedback."
      );
      setSubmitting(false);
    }
  };

  const handleSyncTableToNotion = async () => {
    if (syncingTable || feedbackRows.length === 0) return;

    setSyncingTable(true);
    setErrorMessage("");
    setStatusMessage("");
    try {
      const response = await fetch("/api/admin/feedback/notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedbackIds: feedbackRows.map((item) => item.id),
          fullReplace: true,
        }),
      });
      const data = (await response.json()) as NotionSyncResponse;
      if (!response.ok || !data.success || !data.notionSynced) {
        const primaryReason =
          typeof data.reason === "string" && data.reason.trim()
            ? data.reason.trim()
            : typeof data.failedRows?.[0]?.reason === "string" &&
                data.failedRows[0].reason.trim()
              ? data.failedRows[0].reason.trim()
              : "";
        const primaryError =
          typeof data.error === "string" && data.error.trim()
            ? data.error.trim()
            : "Failed to sync the feedback table to Notion.";
        throw new Error(
          primaryReason ? `${primaryError} (${primaryReason})` : primaryError
        );
      }
      const syncedCount =
        Number.isFinite(data.syncedCount) && data.syncedCount != null
          ? data.syncedCount
          : feedbackRows.length;
      const archivedCount =
        Number.isFinite(data.archivedCount) && data.archivedCount != null
          ? data.archivedCount
          : 0;
      setStatusMessage(
        data.fullReplace
          ? `Synced ${syncedCount} rows and archived ${archivedCount} stale Notion rows.`
          : `Synced ${syncedCount} feedback rows to Notion.`
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to sync the feedback table to Notion."
      );
    } finally {
      setSyncingTable(false);
    }
  };

  return (
    <>
      <div className="space-y-3">
        {statusMessage ? (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
            {statusMessage}
          </div>
        ) : null}
        {errorMessage && editingId == null ? (
          <div className="rounded-lg border border-rose-500/40 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
            {errorMessage}
          </div>
        ) : null}

        {feedbackRows.length === 0 ? (
          <div className="rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-3 text-sm text-slate-300">
            No feedback reports found.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void handleSyncTableToNotion()}
                disabled={syncingTable}
                className="rounded-md border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {syncingTable ? "Syncing Table..." : "Update Table To Notion"}
              </button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-700">
              <table className="min-w-full divide-y divide-slate-700 text-sm">
                <thead className="bg-slate-900/90 text-slate-300">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">ID</th>
                    <th className="px-4 py-3 text-left font-semibold">Username</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                    <th className="px-4 py-3 text-left font-semibold">Report Date</th>
                    <th className="px-4 py-3 text-left font-semibold">Settle Date</th>
                    <th className="px-4 py-3 text-left font-semibold">Description</th>
                    <th className="px-4 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {feedbackRows.map((item) => {
                    const statusClassName =
                      STATUS_COLORS[item.status] ??
                      "border-slate-500/40 bg-slate-500/15 text-slate-200";
                    const canCheck = !TERMINAL_STATUSES.has(item.status);
                    return (
                      <tr key={item.id} className="bg-slate-900/30 align-top">
                        <td className="px-4 py-3 text-slate-300">{item.id}</td>
                        <td className="px-4 py-3 font-medium text-slate-100">
                          {item.username}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClassName}`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {formatStableDateTime(item.report_date)}
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {formatStableDateTime(item.settle_date)}
                        </td>
                        <td className="max-w-xl px-4 py-3 text-slate-200">
                          {item.description?.trim() ? item.description : "-"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {canCheck ? (
                            <button
                              type="button"
                              onClick={() => openEditor(item)}
                              className="rounded-md border border-sky-400/40 bg-sky-500/15 px-3 py-1.5 text-xs font-semibold text-sky-200 transition hover:bg-sky-500/25"
                            >
                              Check
                            </button>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {editingFeedback ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-sm"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeEditor();
            }
          }}
        >
          <div className="w-full max-w-3xl rounded-2xl border border-slate-700 bg-slate-900 p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-slate-100">
                  Feedback #{editingFeedback.id}
                </h2>
                <p className="text-sm text-slate-300">
                  Player: {editingFeedback.username}
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-slate-800"
              >
                Close
              </button>
            </div>

            <div className="grid gap-4">
              <label className="space-y-1">
                <span className="text-sm font-medium text-slate-200">Next Status</span>
                <select
                  value={nextStatus}
                  onChange={(event) => setNextStatus(event.target.value)}
                  className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              {nextStatus === "done" ? (
                <div className="space-y-3 rounded-lg border border-sky-500/30 bg-sky-950/20 p-4">
                  <p className="text-sm text-sky-200">
                    Done requires an email with reward to the bug reporter.
                  </p>
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-200">Email Title</span>
                    <input
                      type="text"
                      value={emailTitle}
                      onChange={(event) => setEmailTitle(event.target.value)}
                      className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-sm font-medium text-slate-200">Email Description</span>
                    <textarea
                      value={emailDescription}
                      onChange={(event) => setEmailDescription(event.target.value)}
                      rows={4}
                      className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400"
                    />
                  </label>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-200">Rewards</span>
                      <button
                        type="button"
                        onClick={addRewardRow}
                        className="rounded-md border border-slate-500 px-2.5 py-1 text-xs text-slate-200 transition hover:bg-slate-800"
                      >
                        Add Reward
                      </button>
                    </div>
                    {rewardRows.map((row, index) => (
                      <div key={`reward-${index}`} className="grid gap-2 sm:grid-cols-[1fr_120px_auto]">
                        <select
                          value={row.key}
                          onChange={(event) =>
                            updateRewardRow(index, "key", event.target.value)
                          }
                          className="rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400"
                        >
                          {rewardResourceKeys.map((key) => (
                            <option key={key} value={key}>
                              {toTitleCase(key)}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min={1}
                          value={row.amount}
                          onChange={(event) =>
                            updateRewardRow(index, "amount", event.target.value)
                          }
                          placeholder="Amount"
                          className="rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-400"
                        />
                        <button
                          type="button"
                          onClick={() => removeRewardRow(index)}
                          className="rounded-md border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/25"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {errorMessage ? (
                <div className="rounded-md border border-rose-500/40 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
                  {errorMessage}
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeEditor}
                className="rounded-md border border-slate-600 px-4 py-2 text-sm text-slate-200 transition hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={submitting}
                className="rounded-md border border-sky-400/40 bg-sky-500/20 px-4 py-2 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
