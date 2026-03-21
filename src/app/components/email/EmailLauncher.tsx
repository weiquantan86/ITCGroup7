"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type EmailLauncherProps = {
  username: string;
  initialHasUnreadEmail?: boolean;
};

type UserEmailItem = {
  id: number;
  userId: number | null;
  title: string;
  description: string;
  reward: string | null;
  rewardLabel: string;
  sendDate: string;
  isRead: boolean;
  hasClaimableReward: boolean;
  canDelete: boolean;
};

type EmailListResponse = {
  emails?: UserEmailItem[];
  error?: string;
};

type ClaimedRewardMap = Record<string, number>;

type EmailClaimResponse = {
  success?: boolean;
  claimed?: boolean;
  title?: string;
  rewardSummary?: string;
  claimedRewards?: ClaimedRewardMap;
  message?: string;
  canDelete?: boolean;
  error?: string;
};

type EmailMutationResponse = {
  success?: boolean;
  email?: {
    id: number;
    isRead: boolean;
    canDelete: boolean;
  };
  deletedEmailId?: number;
  error?: string;
};

type ClaimSuccessReward = {
  key: string;
  label: string;
  amount: number;
};

type ClaimSuccessState = {
  emailTitle: string;
  rewardSummary: string;
  rewards: ClaimSuccessReward[];
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
};

const formatRewardLabel = (value: string) =>
  value
    .split("_")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

const toClaimSuccessRewards = (claimedRewards?: ClaimedRewardMap) => {
  if (!claimedRewards || typeof claimedRewards !== "object") {
    return [] as ClaimSuccessReward[];
  }

  return Object.entries(claimedRewards)
    .map(([key, amount]) => ({
      key,
      label: formatRewardLabel(key),
      amount: Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0,
    }))
    .filter((entry) => entry.amount > 0);
};

const hasReward = (item: UserEmailItem) => item.hasClaimableReward;

export default function EmailLauncher({
  username: _username,
  initialHasUnreadEmail = false,
}: EmailLauncherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [emails, setEmails] = useState<UserEmailItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedEmailId, setSelectedEmailId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [claimingEmailId, setClaimingEmailId] = useState<number | null>(null);
  const [markingReadEmailId, setMarkingReadEmailId] = useState<number | null>(null);
  const [deletingEmailId, setDeletingEmailId] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [hasLoadedEmails, setHasLoadedEmails] = useState(false);
  const [hasUnreadEmail, setHasUnreadEmail] = useState(initialHasUnreadEmail);
  const [claimSuccessState, setClaimSuccessState] = useState<ClaimSuccessState | null>(null);

  const selectedEmail = useMemo(
    () => emails.find((item) => item.id === selectedEmailId) ?? null,
    [emails, selectedEmailId]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedEmails) return;
    setHasUnreadEmail(emails.some((item) => !item.isRead));
  }, [emails, hasLoadedEmails]);

  const closeModal = () => {
    setIsOpen(false);
    setErrorMessage("");
    setStatusMessage("");
    setClaimingEmailId(null);
    setMarkingReadEmailId(null);
    setDeletingEmailId(null);
    setClaimSuccessState(null);
  };

  useEffect(() => {
    if (!isOpen) return;

    const controller = new AbortController();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeModal();
      }
    };
    window.addEventListener("keydown", onKeyDown);

    const loadEmails = async () => {
      setIsLoading(true);
      setErrorMessage("");
      setStatusMessage("");
      try {
        const response = await fetch("/api/user/email", {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });
        const data = (await response.json()) as EmailListResponse;
        if (!response.ok) {
          throw new Error(data.error || "Failed to load emails.");
        }

        const list = Array.isArray(data.emails) ? data.emails : [];
        setHasLoadedEmails(true);
        setEmails(list);
        setSelectedEmailId((previousId) => {
          if (previousId && list.some((item) => item.id === previousId)) {
            return previousId;
          }
          return list[0]?.id ?? null;
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        setEmails([]);
        setSelectedEmailId(null);
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to load emails."
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    void loadEmails();

    return () => {
      controller.abort();
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const handleMarkAsRead = async (email: UserEmailItem) => {
    if (email.isRead || markingReadEmailId === email.id) return;

    setMarkingReadEmailId(email.id);
    try {
      const response = await fetch(`/api/user/email/${email.id}`, {
        method: "PATCH",
      });
      const data = (await response.json()) as EmailMutationResponse;
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to mark email as read.");
      }

      setEmails((previous) =>
        previous.map((item) =>
          item.id === email.id
            ? {
                ...item,
                isRead: data.email?.isRead ?? true,
                canDelete: item.canDelete || Boolean(data.email?.canDelete),
              }
            : item
        )
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to mark email as read."
      );
    } finally {
      setMarkingReadEmailId(null);
    }
  };

  useEffect(() => {
    if (!isOpen || !selectedEmail || selectedEmail.isRead) return;
    void handleMarkAsRead(selectedEmail);
  }, [isOpen, selectedEmail]);

  const handleClaimReward = async () => {
    if (!selectedEmail || !hasReward(selectedEmail)) return;

    setClaimingEmailId(selectedEmail.id);
    setErrorMessage("");
    setStatusMessage("");
    try {
      const response = await fetch(`/api/user/email/${selectedEmail.id}/claim`, {
        method: "POST",
      });
      const data = (await response.json()) as EmailClaimResponse;
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to claim reward.");
      }

      setEmails((previous) =>
        previous.map((item) =>
          item.id === selectedEmail.id
            ? {
                ...item,
                reward: null,
                rewardLabel: "No reward",
                isRead: true,
                hasClaimableReward: false,
                canDelete:
                  typeof data.canDelete === "boolean"
                    ? data.canDelete
                    : item.userId != null,
              }
            : item
        )
      );

      if (data.claimed) {
        const rewardSummary = data.rewardSummary?.trim()
          ? data.rewardSummary
          : "Reward claimed successfully.";
        setStatusMessage(`Reward claimed: ${rewardSummary}`);
        setClaimSuccessState({
          emailTitle: data.title?.trim() ? data.title : "System Mail",
          rewardSummary,
          rewards: toClaimSuccessRewards(data.claimedRewards),
        });
      } else {
        setStatusMessage(data.message || "This email has no claimable reward.");
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to claim reward."
      );
    } finally {
      setClaimingEmailId(null);
    }
  };

  const handleDeleteEmail = async () => {
    if (!selectedEmail || !selectedEmail.canDelete || deletingEmailId != null) {
      return;
    }

    const confirmed = window.confirm(
      `Delete email "${selectedEmail.title || "Untitled"}"?`
    );
    if (!confirmed) return;

    setDeletingEmailId(selectedEmail.id);
    setErrorMessage("");
    setStatusMessage("");
    try {
      const response = await fetch(`/api/user/email/${selectedEmail.id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as EmailMutationResponse;
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to delete email.");
      }

      const currentIndex = emails.findIndex((item) => item.id === selectedEmail.id);
      const nextEmails = emails.filter((item) => item.id !== selectedEmail.id);
      const nextSelectedEmail =
        nextEmails[currentIndex] ??
        nextEmails[Math.max(0, currentIndex - 1)] ??
        nextEmails[0] ??
        null;

      setEmails(nextEmails);
      setSelectedEmailId(nextSelectedEmail?.id ?? null);
      setStatusMessage("Email deleted.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to delete email."
      );
    } finally {
      setDeletingEmailId(null);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Open user email inbox"
        className="group relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[16px] border border-orange-200/35 bg-gradient-to-br from-orange-400/50 to-pink-500/40 text-orange-50 shadow-[0_10px_28px_rgba(251,146,60,0.34)] transition duration-200 hover:-translate-y-0.5 hover:brightness-110"
      >
        {hasUnreadEmail ? (
          <span className="absolute right-2.5 top-2.5 h-3.5 w-3.5 rounded-full border border-white/80 bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.9)]" />
        ) : null}
        <svg
          viewBox="0 0 24 24"
          className="h-8 w-8 drop-shadow-[0_0_8px_rgba(253,186,116,0.7)] transition duration-200 group-hover:scale-105"
          aria-hidden="true"
        >
          <path
            d="M3.5 7.25A2.75 2.75 0 0 1 6.25 4.5h11.5a2.75 2.75 0 0 1 2.75 2.75v9.5a2.75 2.75 0 0 1-2.75 2.75H6.25a2.75 2.75 0 0 1-2.75-2.75v-9.5zm1.5.32v.18l6.55 4.79a.75.75 0 0 0 .9 0L19 7.75v-.18A1.25 1.25 0 0 0 17.75 6.3H6.25A1.25 1.25 0 0 0 5 7.57zm14 1.98l-5.67 4.14a2.25 2.25 0 0 1-2.66 0L5 9.55v7.2c0 .69.56 1.25 1.25 1.25h11.5c.69 0 1.25-.56 1.25-1.25v-7.2z"
            fill="currentColor"
          />
        </svg>
      </button>

      {isOpen && mounted
        ? createPortal(
            <div
              className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/74 px-4 py-8 backdrop-blur-md"
              role="presentation"
              onClick={(event) => {
                if (event.target === event.currentTarget) {
                  closeModal();
                }
              }}
            >
              <div className="relative flex h-[min(84dvh,760px)] w-[min(1180px,96vw)] min-h-[620px] flex-col overflow-hidden rounded-[44px] border border-white/20 bg-[linear-gradient(160deg,#060a13_0%,#090f1c_52%,#060912_100%)] p-6 shadow-[0_0_76px_rgba(56,189,248,0.25)] md:p-8">
                <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-cyan-400/12 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-orange-400/12 blur-3xl" />

                <div className="mb-5 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="text-4xl font-semibold tracking-wide text-slate-100 md:text-6xl">
                      My Email
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={closeModal}
                    aria-label="Close email modal"
                    className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/35 bg-white/[0.03] text-slate-100 transition hover:border-sky-300/80 hover:bg-sky-300/10 hover:text-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      aria-hidden="true"
                    >
                      <path
                        d="M6.75 6.75L17.25 17.25M17.25 6.75L6.75 17.25"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>

                <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[0.98fr_1fr]">
                  <section className="flex min-h-0 flex-col rounded-[34px] border border-white/20 bg-slate-950/35 p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] md:p-6">
                    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                      {isLoading ? (
                        <div className="rounded-[14px] border border-white/15 bg-white/[0.03] px-4 py-6 text-sm text-slate-300">
                          Loading emails...
                        </div>
                      ) : null}

                      {!isLoading && emails.length === 0 ? (
                        <div className="rounded-[14px] border border-white/15 bg-white/[0.03] px-4 py-6 text-sm text-slate-400">
                          No email found for this player.
                        </div>
                      ) : null}

                      {!isLoading
                        ? emails.map((item) => {
                            const selected = item.id === selectedEmailId;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                  setSelectedEmailId(item.id);
                                  setStatusMessage("");
                                  setErrorMessage("");
                                }}
                                className={`flex w-full items-center justify-between rounded-[12px] border px-4 py-4 text-left transition ${
                                  selected
                                    ? "border-sky-300/75 bg-sky-400/12 shadow-[0_0_20px_rgba(56,189,248,0.22)]"
                                    : "border-white/20 bg-white/[0.01] hover:border-white/40 hover:bg-white/[0.05]"
                                }`}
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    {!item.isRead ? (
                                      <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
                                    ) : null}
                                    <p className="truncate text-xl font-semibold text-slate-100">
                                      {item.title || "Untitled"}
                                    </p>
                                  </div>
                                  <p className="mt-1 text-xs text-slate-400">
                                    Admin - {formatDate(item.sendDate)}
                                  </p>
                                </div>
                                <div className="ml-4 flex shrink-0 items-center gap-2">
                                  {item.canDelete ? (
                                    <span className="rounded-full border border-slate-300/30 bg-slate-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-200">
                                      Delete
                                    </span>
                                  ) : null}
                                  {hasReward(item) ? (
                                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-sky-200/70 text-2xl font-semibold text-sky-100">
                                      G
                                    </span>
                                  ) : null}
                                </div>
                              </button>
                            );
                          })
                        : null}
                    </div>
                  </section>

                  <section className="grid min-h-0 grid-rows-[auto_1fr_auto] rounded-[34px] border border-white/20 bg-slate-950/35 p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] md:p-6">
                    <div className="border-b border-white/20 pb-3">
                      <div className="flex items-center justify-between gap-4">
                        <div className="text-center text-3xl font-semibold text-slate-100 md:text-4xl">
                          {selectedEmail?.title || "Title"}
                        </div>
                        {selectedEmail ? (
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                              selectedEmail.isRead
                                ? "border-slate-400/35 bg-slate-500/10 text-slate-200"
                                : "border-red-400/35 bg-red-500/10 text-red-200"
                            }`}
                          >
                            {markingReadEmailId === selectedEmail.id
                              ? "Opening"
                              : selectedEmail.isRead
                                ? "Read"
                                : "Unread"}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="min-h-0 overflow-y-auto py-4">
                      <div className="text-2xl font-semibold text-slate-100 md:text-3xl">
                        Description
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-lg leading-relaxed text-slate-200/90">
                        {selectedEmail?.description?.trim()
                          ? selectedEmail.description
                          : "No description in this email."}
                      </p>
                    </div>

                    {selectedEmail ? (
                      <div className="mt-2 flex flex-col gap-3">
                        {hasReward(selectedEmail) ? (
                          <button
                            type="button"
                            onClick={() => void handleClaimReward()}
                            disabled={claimingEmailId === selectedEmail.id}
                            className="flex min-h-[92px] w-full flex-col items-start justify-center rounded-[14px] border border-sky-300/70 bg-gradient-to-r from-sky-500/16 to-cyan-400/14 px-4 text-left transition hover:from-sky-500/22 hover:to-cyan-400/18 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            <span className="text-sm font-semibold uppercase tracking-wide text-sky-200">
                              {claimingEmailId === selectedEmail.id
                                ? "Claiming..."
                                : "Click to claim reward"}
                            </span>
                            <span className="mt-1 text-base text-slate-100">
                              {selectedEmail.rewardLabel || "Reward available"}
                            </span>
                          </button>
                        ) : (
                          <div className="flex min-h-[92px] w-full items-center rounded-[14px] border border-white/20 bg-white/[0.02] px-4 text-slate-400">
                            No reward in this email.
                          </div>
                        )}

                        {selectedEmail.canDelete ? (
                          <button
                            type="button"
                            onClick={() => void handleDeleteEmail()}
                            disabled={deletingEmailId === selectedEmail.id}
                            className="flex min-h-[60px] w-full items-center justify-center rounded-[14px] border border-slate-300/30 bg-slate-400/10 px-4 text-sm font-semibold uppercase tracking-wide text-slate-100 transition hover:bg-slate-300/15 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {deletingEmailId === selectedEmail.id
                              ? "Deleting..."
                              : "Delete this email"}
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <div className="mt-2 flex min-h-[92px] w-full items-center rounded-[14px] border border-white/20 bg-white/[0.02] px-4 text-slate-400">
                        Select an email from the left side.
                      </div>
                    )}
                  </section>
                </div>

                <div className="mt-4 min-h-6 px-1 text-sm">
                  {errorMessage ? (
                    <p className="font-medium text-rose-300">{errorMessage}</p>
                  ) : statusMessage ? (
                    <p className="font-medium text-emerald-300">{statusMessage}</p>
                  ) : null}
                </div>

                {claimSuccessState ? (
                  <div
                    className="absolute inset-0 z-[50] flex items-center justify-center bg-slate-950/72 px-4 backdrop-blur-sm"
                    role="presentation"
                    onClick={(event) => {
                      if (event.target === event.currentTarget) {
                        setClaimSuccessState(null);
                      }
                    }}
                  >
                    <div className="w-full max-w-lg rounded-2xl border border-emerald-300/40 bg-slate-900/95 p-6 shadow-[0_0_40px_rgba(74,222,128,0.25)]">
                      <h3 className="text-2xl font-semibold text-emerald-200">
                        Reward Claimed
                      </h3>
                      <p className="mt-1 text-sm text-slate-300">
                        Mail: {claimSuccessState.emailTitle}
                      </p>
                      <div className="mt-4 rounded-lg border border-emerald-300/25 bg-emerald-500/10 px-4 py-3 text-slate-100">
                        Successfully received: {claimSuccessState.rewardSummary}
                      </div>
                      {claimSuccessState.rewards.length > 0 ? (
                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          {claimSuccessState.rewards.map((reward) => (
                            <div
                              key={reward.key}
                              className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-100"
                            >
                              <span>{reward.label}</span>
                              <span className="font-semibold text-emerald-200">
                                x{reward.amount}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      <div className="mt-5 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setClaimSuccessState(null)}
                          className="rounded-md border border-emerald-300/45 bg-emerald-400/15 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/25"
                        >
                          OK
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
