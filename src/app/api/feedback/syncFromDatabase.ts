import "server-only";

import pool from "@/database/client";
import {
  type FeedbackSyncRecord,
  type FeedbackSyncResult,
  upsertFeedbackToNotion,
} from "@/app/components/notion/feedbackSync";

const DEFAULT_MAX_SYNC_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 300;

type Queryable = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: unknown[] }>;
};

export type FeedbackDatabaseRow = {
  id: number;
  user_id: number;
  username: string;
  status: string;
  report_date: string | Date;
  settle_date: string | Date | null;
  description: string | null;
};

export type FeedbackDatabaseSyncResult = FeedbackSyncResult & {
  attempts: number;
};

type SyncOptions = {
  maxAttempts?: number;
  retryDelayMs?: number;
};

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const toPositiveInteger = (value: unknown, field: string) => {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${field} for feedback Notion sync.`);
  }
  return parsed;
};

const toRequiredString = (value: unknown, field: string) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    throw new Error(`Invalid ${field} for feedback Notion sync.`);
  }
  return normalized;
};

const toIsoString = (value: string | Date | null, field: string) => {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${field} for feedback Notion sync.`);
  }
  return date.toISOString();
};

export const mapFeedbackDatabaseRowToSyncRecord = (
  row: FeedbackDatabaseRow
): FeedbackSyncRecord => {
  const reportDateIso = toIsoString(row.report_date, "feedback report date");
  if (!reportDateIso) {
    throw new Error("Missing feedback report date for Notion sync.");
  }

  return {
    id: toPositiveInteger(row.id, "feedback id"),
    userId: toPositiveInteger(row.user_id, "feedback user id"),
    username: toRequiredString(row.username, "feedback username"),
    status: toRequiredString(row.status, "feedback status"),
    reportDate: reportDateIso,
    settleDate: toIsoString(row.settle_date, "feedback settle date"),
    description: typeof row.description === "string" ? row.description : null,
  };
};

export const fetchFeedbackDatabaseRowById = async (
  feedbackId: number,
  queryable: Queryable = pool
) => {
  const result = await queryable.query(
    `
      SELECT
        uf.id,
        uf.user_id,
        u.username,
        uf.status,
        uf.report_date,
        uf.settle_date,
        uf.description
      FROM user_feedback uf
      INNER JOIN users u ON u.id = uf.user_id
      WHERE uf.id = $1
      LIMIT 1
    `,
    [feedbackId]
  );

  if (result.rows.length === 0) return null;
  return result.rows[0] as FeedbackDatabaseRow;
};

export const syncFeedbackRowToNotion = async (
  row: FeedbackDatabaseRow,
  options: SyncOptions = {}
): Promise<FeedbackDatabaseSyncResult> => {
  const maxAttempts = Math.max(
    1,
    Math.floor(options.maxAttempts ?? DEFAULT_MAX_SYNC_ATTEMPTS)
  );
  const retryDelayMs = Math.max(
    0,
    Math.floor(options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS)
  );
  const feedback = mapFeedbackDatabaseRowToSyncRecord(row);

  let lastResult: FeedbackSyncResult = {
    synced: false,
    pageId: null,
    reason: "Unknown Notion sync error.",
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await upsertFeedbackToNotion(feedback);
    if (result.synced) {
      return {
        ...result,
        attempts: attempt,
      };
    }

    lastResult = result;
    if (attempt < maxAttempts && retryDelayMs > 0) {
      await sleep(retryDelayMs * attempt);
    }
  }

  return {
    synced: false,
    pageId: null,
    reason:
      lastResult.reason ??
      `Notion sync failed after ${String(maxAttempts)} attempts.`,
    attempts: maxAttempts,
  };
};

export const syncFeedbackByIdToNotion = async (
  feedbackId: number,
  options: SyncOptions = {}
): Promise<FeedbackDatabaseSyncResult> => {
  const row = await fetchFeedbackDatabaseRowById(feedbackId);
  if (!row) {
    return {
      synced: false,
      pageId: null,
      reason: `Feedback #${String(feedbackId)} not found for Notion sync.`,
      attempts: 0,
    };
  }

  return syncFeedbackRowToNotion(row, options);
};
