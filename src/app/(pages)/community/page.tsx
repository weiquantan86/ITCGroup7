"use client";

import { FormEvent, useEffect, useState } from "react";

type CommentSort = "newest" | "oldest" | "username_asc" | "username_desc";
type CommentDays = "all" | "1" | "7" | "30";

type FilterState = {
  keyword: string;
  username: string;
  sort: CommentSort;
  days: CommentDays;
};

type CommunityComment = {
  id: number;
  username: string;
  comment: string;
  commented_date: string;
};

type BugReportForm = {
  description: string;
  rewardAcknowledged: boolean;
};

const DEFAULT_FILTERS: FilterState = {
  keyword: "",
  username: "",
  sort: "newest",
  days: "all",
};

const INITIAL_BUG_REPORT_FORM: BugReportForm = {
  description: "",
  rewardAcknowledged: false,
};

function formatDateTime(input: string): string {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.valueOf())) {
    return input;
  }
  return new Intl.DateTimeFormat("en-SG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

export default function CommunityPage() {
  const [draftFilters, setDraftFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [activeFilters, setActiveFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentSubmitError, setCommentSubmitError] = useState<string | null>(null);

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [bugReportForm, setBugReportForm] = useState<BugReportForm>(
    INITIAL_BUG_REPORT_FORM
  );
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportSuccess, setReportSuccess] = useState<string | null>(null);

  const loadComments = async (filters: FilterState) => {
    setCommentsLoading(true);
    setCommentsError(null);

    try {
      const searchParams = new URLSearchParams({
        sort: filters.sort,
        days: filters.days,
      });

      if (filters.keyword.trim()) {
        searchParams.set("keyword", filters.keyword.trim());
      }
      if (filters.username.trim()) {
        searchParams.set("username", filters.username.trim());
      }

      const response = await fetch(`/api/community/comments?${searchParams.toString()}`, {
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to load comments.");
      }

      setComments(Array.isArray(payload.comments) ? payload.comments : []);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load comments.";
      setCommentsError(message);
    } finally {
      setCommentsLoading(false);
    }
  };

  useEffect(() => {
    void loadComments(activeFilters);
  }, [activeFilters]);

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActiveFilters({
      keyword: draftFilters.keyword.trim(),
      username: draftFilters.username.trim(),
      sort: draftFilters.sort,
      days: draftFilters.days,
    });
  };

  const resetFilters = () => {
    setDraftFilters(DEFAULT_FILTERS);
    setActiveFilters(DEFAULT_FILTERS);
  };

  const submitBugReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setReportSubmitting(true);
    setReportError(null);
    setReportSuccess(null);

    try {
      const response = await fetch("/api/community/bug-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          description: bugReportForm.description.trim(),
          rewardAcknowledged: bugReportForm.rewardAcknowledged,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to submit report.");
      }

      const reportId = payload?.report?.id;
      const submittedAt = payload?.report?.report_date
        ? formatDateTime(payload.report.report_date)
        : "just now";

      setReportSuccess(
        `Report #${reportId ?? "N/A"} submitted at ${submittedAt}. Thank you for helping improve the game.`
      );
      setBugReportForm(INITIAL_BUG_REPORT_FORM);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to submit report.";
      setReportError(message);
    } finally {
      setReportSubmitting(false);
    }
  };

  const submitComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCommentSubmitError(null);

    const trimmed = commentDraft.trim();
    if (!trimmed) {
      setCommentSubmitError("Comment cannot be empty.");
      return;
    }

    setCommentSubmitting(true);
    try {
      const response = await fetch("/api/community/comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          comment: trimmed,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to post comment.");
      }

      setCommentDraft("");
      await loadComments(activeFilters);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to post comment.";
      setCommentSubmitError(message);
    } finally {
      setCommentSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen w-full bg-[#060a11] font-sans text-slate-100">
      <div className="min-h-screen w-full bg-[radial-gradient(circle_at_16%_16%,rgba(34,211,238,0.2),transparent_38%),radial-gradient(circle_at_88%_20%,rgba(251,146,60,0.25),transparent_35%),linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[length:auto,auto,30px_30px,30px_30px]">
        <div className="mx-auto w-full max-w-[1720px] px-4 py-10 md:px-6 lg:px-8 xl:px-10 2xl:px-12">
          <section className="rounded-[30px] border border-white/15 bg-slate-900/70 px-6 py-7 shadow-[0_0_42px_rgba(56,189,248,0.17)] backdrop-blur-md md:px-8 lg:px-10 lg:py-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-4xl font-semibold tracking-tight text-slate-100 md:text-5xl">
                  Community
                </h1>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsReportModalOpen(true);
                    setReportError(null);
                    setReportSuccess(null);
                  }}
                  className="inline-flex h-12 items-center justify-center rounded-full border border-red-300/35 bg-gradient-to-r from-rose-600/90 to-red-600/85 px-6 text-base font-semibold text-white shadow-[0_10px_28px_rgba(239,68,68,0.35)] transition hover:brightness-110"
                >
                  Report gaming bug
                </button>
              </div>
            </div>
          </section>

          <section className="mt-6 grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[390px_minmax(0,1fr)]">
            <aside className="rounded-[26px] border border-white/15 bg-slate-900/70 p-5 shadow-[0_0_34px_rgba(15,23,42,0.45)] backdrop-blur-md md:p-6">
              <h2 className="text-xl font-semibold text-slate-100 md:text-2xl">Sort & Filter</h2>
              <form className="mt-4 space-y-4" onSubmit={applyFilters}>
                <div className="space-y-1.5">
                  <label
                    htmlFor="comment-keyword"
                    className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-300"
                  >
                    Keyword
                  </label>
                  <input
                    id="comment-keyword"
                    value={draftFilters.keyword}
                    onChange={(event) =>
                      setDraftFilters((prev) => ({ ...prev, keyword: event.target.value }))
                    }
                    placeholder="Search comment text"
                    className="w-full rounded-xl border border-slate-300/20 bg-slate-950/70 px-4 py-3 text-base text-slate-100 outline-none transition focus:border-cyan-300/50"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="comment-username"
                    className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-300"
                  >
                    Username
                  </label>
                  <input
                    id="comment-username"
                    value={draftFilters.username}
                    onChange={(event) =>
                      setDraftFilters((prev) => ({ ...prev, username: event.target.value }))
                    }
                    placeholder="Filter by user"
                    className="w-full rounded-xl border border-slate-300/20 bg-slate-950/70 px-4 py-3 text-base text-slate-100 outline-none transition focus:border-cyan-300/50"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="comment-days"
                    className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-300"
                  >
                    Time range
                  </label>
                  <select
                    id="comment-days"
                    value={draftFilters.days}
                    onChange={(event) =>
                      setDraftFilters((prev) => ({
                        ...prev,
                        days: event.target.value as CommentDays,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-300/20 bg-slate-950/70 px-4 py-3 text-base text-slate-100 outline-none transition focus:border-cyan-300/50"
                  >
                    <option value="all">All time</option>
                    <option value="1">Last 24 hours</option>
                    <option value="7">Last 7 days</option>
                    <option value="30">Last 30 days</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="comment-sort"
                    className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-300"
                  >
                    Sort by
                  </label>
                  <select
                    id="comment-sort"
                    value={draftFilters.sort}
                    onChange={(event) =>
                      setDraftFilters((prev) => ({
                        ...prev,
                        sort: event.target.value as CommentSort,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-300/20 bg-slate-950/70 px-4 py-3 text-base text-slate-100 outline-none transition focus:border-cyan-300/50"
                  >
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="username_asc">Username A to Z</option>
                    <option value="username_desc">Username Z to A</option>
                  </select>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    className="inline-flex flex-1 items-center justify-center rounded-xl border border-cyan-300/35 bg-cyan-500/25 px-4 py-3 text-base font-semibold text-cyan-100 transition hover:bg-cyan-400/30"
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="inline-flex flex-1 items-center justify-center rounded-xl border border-slate-300/25 bg-slate-800/70 px-4 py-3 text-base font-semibold text-slate-200 transition hover:bg-slate-700/80"
                  >
                    Reset
                  </button>
                </div>
              </form>
            </aside>

            <section className="rounded-[26px] border border-white/15 bg-slate-900/70 p-5 shadow-[0_0_34px_rgba(15,23,42,0.45)] backdrop-blur-md md:p-6 lg:p-7">
              <form
                className="mb-5 rounded-2xl border border-slate-200/15 bg-slate-950/60 p-5"
                onSubmit={submitComment}
              >
                <label htmlFor="comment-draft" className="mb-2 block text-base font-semibold text-slate-200 md:text-lg">
                  Write a comment
                </label>
                <textarea
                  id="comment-draft"
                  value={commentDraft}
                  onChange={(event) => setCommentDraft(event.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="Share your idea, feedback, or game experience..."
                  className="w-full rounded-xl border border-slate-300/20 bg-slate-950/80 px-4 py-3 text-base leading-7 text-slate-100 outline-none transition focus:border-cyan-300/50"
                />
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-400">{commentDraft.trim().length}/2000</span>
                  <button
                    type="submit"
                    disabled={commentSubmitting}
                    className="inline-flex h-10 items-center justify-center rounded-lg border border-cyan-300/35 bg-cyan-500/20 px-5 text-base font-semibold text-cyan-100 transition hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {commentSubmitting ? "Posting..." : "Post comment"}
                  </button>
                </div>
                {commentSubmitError ? (
                  <p className="mt-2 rounded-lg border border-rose-300/35 bg-rose-500/10 px-3 py-2 text-base text-rose-200">
                    {commentSubmitError}
                  </p>
                ) : null}
              </form>

              <div className="mb-4 flex items-center justify-between gap-4">
                <h2 className="text-2xl font-semibold text-slate-100 md:text-[1.75rem]">
                  Community comments
                </h2>
                <button
                  type="button"
                  onClick={() => void loadComments(activeFilters)}
                  disabled={commentsLoading}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200/30 px-4 text-base font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {commentsLoading ? "Loading..." : "Refresh"}
                </button>
              </div>

              {commentsError ? (
                <div className="rounded-xl border border-rose-300/35 bg-rose-500/10 px-4 py-3 text-base text-rose-200">
                  {commentsError}
                </div>
              ) : null}

              {!commentsError && commentsLoading ? (
                <p className="text-base text-slate-300">Loading comments...</p>
              ) : null}

              {!commentsError && !commentsLoading && comments.length === 0 ? (
                <div className="rounded-xl border border-slate-300/20 bg-slate-950/70 px-4 py-6 text-center text-base text-slate-300">
                  No comments found for the current filters.
                </div>
              ) : null}

              {!commentsError && !commentsLoading && comments.length > 0 ? (
                <ul className="space-y-3">
                  {comments.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-2xl border border-slate-200/15 bg-slate-950/65 p-5"
                    >
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <span className="inline-flex items-center rounded-full border border-cyan-300/30 bg-cyan-500/10 px-3.5 py-1.5 text-sm font-semibold tracking-wide text-cyan-100">
                          {item.username}
                        </span>
                        <span className="text-sm text-slate-400">
                          {formatDateTime(item.commented_date)}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-base leading-7 text-slate-200 md:text-[1.05rem]">
                        {item.comment}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          </section>
        </div>
      </div>

      {isReportModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[24px] border border-white/20 bg-slate-900/95 shadow-[0_0_42px_rgba(34,211,238,0.2)]">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-slate-900/95 px-5 py-4 backdrop-blur">
              <h3 className="text-xl font-semibold text-slate-100 md:text-2xl">
                Report gaming bug
              </h3>
              <button
                type="button"
                onClick={() => setIsReportModalOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300/30 text-lg text-slate-200 transition hover:bg-white/10"
                aria-label="Close report modal"
              >
                x
              </button>
            </div>

            <div className="space-y-5 px-5 py-5">
              <div className="rounded-xl border border-amber-300/30 bg-amber-500/10 p-4 text-base leading-7 text-amber-100">
                <p className="font-semibold md:text-lg">Bug report reward rules</p>
                <p className="mt-1">
                  Valid, reproducible, and non-duplicate game bugs can receive in-game
                  rewards after verification by the team.
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-100/90">
                  <li>Describe the issue clearly and explain its impact.</li>
                  <li>Duplicate reports may not receive additional rewards.</li>
                  <li>Rewards are settled after technical validation.</li>
                </ul>
              </div>

              <form className="space-y-4" onSubmit={submitBugReport}>
                <div className="space-y-1.5">
                  <label
                    htmlFor="bug-description"
                    className="text-base font-medium text-slate-200 md:text-lg"
                  >
                    Bug description
                  </label>
                  <textarea
                    id="bug-description"
                    value={bugReportForm.description}
                    onChange={(event) =>
                      setBugReportForm((prev) => ({
                        ...prev,
                        description: event.target.value,
                      }))
                    }
                    rows={4}
                    placeholder="What happened, and how does it affect gameplay?"
                    className="w-full rounded-xl border border-slate-300/20 bg-slate-950/75 px-4 py-3 text-base leading-7 text-slate-100 outline-none transition focus:border-cyan-300/50"
                    required
                  />
                </div>

                <label className="flex items-start gap-3 rounded-xl border border-slate-300/20 bg-slate-950/65 px-4 py-3 text-base leading-7 text-slate-200">
                  <input
                    type="checkbox"
                    checked={bugReportForm.rewardAcknowledged}
                    onChange={(event) =>
                      setBugReportForm((prev) => ({
                        ...prev,
                        rewardAcknowledged: event.target.checked,
                      }))
                    }
                    className="mt-1 h-4 w-4 accent-amber-500"
                  />
                  <span>
                    I understand the reward rules: only valid and non-duplicate bug reports are eligible for rewards after verification.
                  </span>
                </label>

                {reportError ? (
                  <p className="rounded-lg border border-rose-300/35 bg-rose-500/10 px-3 py-2 text-base text-rose-200">
                    {reportError}
                  </p>
                ) : null}

                {reportSuccess ? (
                  <p className="rounded-lg border border-emerald-300/35 bg-emerald-500/10 px-3 py-2 text-base text-emerald-200">
                    {reportSuccess}
                  </p>
                ) : null}

                <div className="flex flex-wrap justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsReportModalOpen(false)}
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300/25 px-5 text-base font-semibold text-slate-200 transition hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={reportSubmitting}
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-amber-300/35 bg-gradient-to-r from-amber-500/85 to-orange-500/85 px-5 text-base font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-65"
                  >
                    {reportSubmitting ? "Submitting..." : "Submit report"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
