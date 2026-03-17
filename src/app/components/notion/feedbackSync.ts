import "server-only";

const NOTION_API_BASE_URL = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RICH_TEXT_LENGTH = 1_900;
const MAX_QUERY_PAGES = 200;

type NotionConfig = {
  apiKey: string;
  databaseId: string;
};

type NotionDatabaseProperty = {
  id: string;
  type: string;
  select?: {
    options?: Array<{ name?: string }>;
  };
  status?: {
    options?: Array<{ name?: string }>;
  };
};

type NotionDatabaseResponse = {
  properties: Record<string, NotionDatabaseProperty>;
};

type NotionPagePropertyValue = {
  type?: string;
  number?: number | null;
  title?: Array<{ plain_text?: string }>;
  rich_text?: Array<{ plain_text?: string }>;
};

type NotionPageObject = {
  id?: string;
  properties?: Record<string, NotionPagePropertyValue>;
};

type NotionQueryResponse = {
  results?: NotionPageObject[];
  has_more?: boolean;
  next_cursor?: string | null;
};

type NamedNotionProperty = NotionDatabaseProperty & {
  name: string;
};

export type FeedbackSyncRecord = {
  id: number;
  userId: number;
  username: string;
  status: string;
  reportDate: string | Date;
  settleDate: string | Date | null;
  description: string | null;
};

export type FeedbackSyncResult = {
  synced: boolean;
  pageId: string | null;
  reason: string | null;
};

export type NotionProbeResult = {
  ok: boolean;
  reason: string | null;
};

export type NotionFeedbackPruneResult = {
  pruned: boolean;
  archivedCount: number;
  duplicateArchivedCount: number;
  orphanArchivedCount: number;
  reason: string | null;
};

const normalizeToken = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

const trimRichText = (value: string) => value.trim().slice(0, MAX_RICH_TEXT_LENGTH);

const buildTitle = (feedbackId: number) => `Feedback #${feedbackId}`;

const toIsoString = (value: string | Date | null): string | null => {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const normalizeEnvValue = (value: string | undefined) => {
  if (typeof value !== "string") return "";
  return value.trim().replace(/^['"]+|['"]+$/g, "");
};

const getNotionConfig = (): NotionConfig | null => {
  const apiKey = normalizeEnvValue(
    process.env.NOTION_API_KEY ?? process.env.NOTION_TOKEN
  );
  const databaseId = normalizeEnvValue(process.env.NOTION_DATABASE_ID);
  if (!apiKey || !databaseId) return null;
  return { apiKey, databaseId };
};

const getNamedProperties = (properties: Record<string, NotionDatabaseProperty>) =>
  Object.entries(properties).map(([name, property]) => ({
    ...property,
    name,
  }));

const findProperty = (
  properties: NamedNotionProperty[],
  allowedTypes: Set<string>,
  aliases: string[]
): NamedNotionProperty | null => {
  const normalizedAliases = aliases
    .map(normalizeToken)
    .filter((token) => token.length > 0);

  let matched: NamedNotionProperty | null = null;
  let bestRank = Number.POSITIVE_INFINITY;

  for (const property of properties) {
    if (!allowedTypes.has(property.type)) continue;
    const token = normalizeToken(property.name);
    const rank = normalizedAliases.indexOf(token);
    if (rank === -1) continue;
    if (rank < bestRank) {
      matched = property;
      bestRank = rank;
      if (rank === 0) break;
    }
  }

  return matched;
};

const buildRichTextPayload = (value: string) => [
  {
    type: "text",
    text: {
      content: trimRichText(value),
    },
  },
];

const buildOptionalRichTextPayload = (value: string | null | undefined) => {
  const trimmed = typeof value === "string" ? trimRichText(value) : "";
  if (!trimmed) return [];
  return buildRichTextPayload(trimmed);
};

const parseIntegerFromUnknown = (value: unknown): number | null => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

const getPlainText = (chunks: Array<{ plain_text?: string }> | undefined) =>
  (chunks ?? [])
    .map((chunk) => String(chunk?.plain_text ?? ""))
    .join("")
    .trim();

const extractFeedbackIdFromTitle = (title: string): number | null => {
  const matched = /feedback\s*#\s*(\d+)/i.exec(title);
  return matched ? parseIntegerFromUnknown(matched[1]) : null;
};

const normalizeStatusCandidates = (status: string) => {
  const normalized = normalizeToken(status);
  const humanReadable = normalized.replace(/_/g, " ");
  const titleCase = humanReadable.replace(/\b\w/g, (char) => char.toUpperCase());
  const aliasMap: Record<string, string[]> = {
    in_valid: ["invalid", "in valid", "Invalid"],
    in_progress: ["inprogress", "in progress", "In Progress"],
    not_started: ["not started", "Not Started"],
  };

  const aliases = aliasMap[normalized] ?? [];
  return Array.from(
    new Set([status, normalized, humanReadable, titleCase, ...aliases])
  );
};

const pickStatusOption = (
  options: Array<{ name?: string }> | undefined,
  candidates: string[]
) => {
  if (!Array.isArray(options) || options.length === 0) return null;

  for (const candidate of candidates) {
    const matched = options.find(
      (option) =>
        typeof option.name === "string" &&
        normalizeToken(option.name) === normalizeToken(candidate)
    );
    if (matched?.name) return matched.name;
  }
  return null;
};

const buildNotionProperties = (
  databaseProperties: Record<string, NotionDatabaseProperty>,
  feedback: FeedbackSyncRecord
) => {
  const properties = getNamedProperties(databaseProperties);
  const titleProperty = properties.find((property) => property.type === "title");
  if (!titleProperty) {
    throw new Error("Notion database has no title property.");
  }

  const notionProperties: Record<string, unknown> = {
    [titleProperty.name]: {
      title: buildRichTextPayload(buildTitle(feedback.id)),
    },
  };

  const feedbackIdProperty = findProperty(
    properties,
    new Set(["number", "rich_text"]),
    ["feedback_id", "feedback id", "id", "report_id", "report id"]
  );
  if (feedbackIdProperty) {
    notionProperties[feedbackIdProperty.name] =
      feedbackIdProperty.type === "number"
        ? { number: feedback.id }
        : { rich_text: buildRichTextPayload(String(feedback.id)) };
  }

  const userIdProperty = findProperty(
    properties,
    new Set(["number", "rich_text"]),
    ["user_id", "user id", "player_id", "player id"]
  );
  if (userIdProperty) {
    notionProperties[userIdProperty.name] =
      userIdProperty.type === "number"
        ? { number: feedback.userId }
        : { rich_text: buildRichTextPayload(String(feedback.userId)) };
  }

  const usernameProperty = findProperty(
    properties,
    new Set(["rich_text"]),
    ["username", "user", "player", "player_name", "player name"]
  );
  if (usernameProperty) {
    notionProperties[usernameProperty.name] = {
      rich_text: buildOptionalRichTextPayload(feedback.username),
    };
  }

  const descriptionProperty = findProperty(
    properties,
    new Set(["rich_text"]),
    ["description", "details", "feedback", "report"]
  );
  if (descriptionProperty) {
    notionProperties[descriptionProperty.name] = {
      rich_text: buildOptionalRichTextPayload(feedback.description),
    };
  }

  const statusProperty = findProperty(
    properties,
    new Set(["status", "select", "rich_text"]),
    ["status", "state"]
  );
  if (statusProperty) {
    if (statusProperty.type === "rich_text") {
      notionProperties[statusProperty.name] = {
        rich_text: buildOptionalRichTextPayload(feedback.status),
      };
    } else {
      const rawStatus = feedback.status.trim();
      if (!rawStatus) {
        throw new Error("Feedback status is empty.");
      }
      const candidates = normalizeStatusCandidates(rawStatus);
      const optionName =
        statusProperty.type === "status"
          ? pickStatusOption(statusProperty.status?.options, candidates)
          : pickStatusOption(statusProperty.select?.options, candidates);
      if (optionName) {
        notionProperties[statusProperty.name] =
          statusProperty.type === "status"
            ? { status: { name: optionName } }
            : { select: { name: optionName } };
      } else {
        notionProperties[statusProperty.name] =
          statusProperty.type === "status"
            ? { status: { name: rawStatus } }
            : { select: { name: rawStatus } };
      }
    }
  }

  const reportDateProperty = findProperty(
    properties,
    new Set(["date", "rich_text"]),
    [
      "report_date",
      "report date",
      "reported_date",
      "reported date",
      "report_time",
      "report time",
      "reported_at",
      "reported at",
      "reported_on",
      "reported on",
      "created_at",
      "created at",
      "date",
    ]
  );
  if (!reportDateProperty) {
    throw new Error(
      "Notion Reported Date property not found. Expected aliases: report_date/reported_date/created_at."
    );
  }
  const reportDateIso = toIsoString(feedback.reportDate);
  if (!reportDateIso) {
    throw new Error("Feedback report date is invalid.");
  }
  notionProperties[reportDateProperty.name] =
    reportDateProperty.type === "date"
      ? {
          date: {
            start: reportDateIso,
          },
        }
      : {
          rich_text: buildRichTextPayload(reportDateIso),
        };

  const settleDateProperty = findProperty(
    properties,
    new Set(["date", "rich_text"]),
    [
      "settle_date",
      "settle date",
      "settled_date",
      "settled date",
      "resolved_at",
      "resolved at",
    ]
  );
  const settleDateIso = toIsoString(feedback.settleDate);
  if (settleDateProperty) {
    notionProperties[settleDateProperty.name] =
      settleDateProperty.type === "date"
        ? {
            date: settleDateIso
              ? {
                  start: settleDateIso,
                }
              : null,
          }
        : {
            rich_text: buildOptionalRichTextPayload(settleDateIso),
          };
  }

  return notionProperties;
};

const notionRequest = async <T>(
  config: NotionConfig,
  path: string,
  init: RequestInit
): Promise<T> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${NOTION_API_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorBody = (await response.text()).slice(0, 1000);
      throw new Error(`Notion API ${response.status}: ${errorBody}`);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
};

export const probeNotionConnection = async (): Promise<NotionProbeResult> => {
  const config = getNotionConfig();
  if (!config) {
    return {
      ok: false,
      reason: "NOTION_API_KEY/NOTION_TOKEN or NOTION_DATABASE_ID is not configured.",
    };
  }

  try {
    await notionRequest(config, "/users/me", { method: "GET" });
    await notionRequest(
      config,
      `/databases/${encodeURIComponent(config.databaseId)}`,
      { method: "GET" }
    );
    return {
      ok: true,
      reason: null,
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Unknown Notion connection error",
    };
  }
};

const findExistingPageId = async (
  config: NotionConfig,
  databaseProperties: Record<string, NotionDatabaseProperty>,
  feedback: FeedbackSyncRecord
) => {
  const properties = getNamedProperties(databaseProperties);
  const titleProperty = properties.find((property) => property.type === "title");
  if (!titleProperty) {
    throw new Error("Notion database has no title property.");
  }

  const feedbackIdProperty = findProperty(
    properties,
    new Set(["number", "rich_text"]),
    ["feedback_id", "feedback id", "id", "report_id", "report id"]
  );

  const filter = feedbackIdProperty
    ? feedbackIdProperty.type === "number"
      ? {
          property: feedbackIdProperty.name,
          number: {
            equals: feedback.id,
          },
        }
      : {
          property: feedbackIdProperty.name,
          rich_text: {
            equals: String(feedback.id),
          },
        }
    : {
        property: titleProperty.name,
        title: {
          equals: buildTitle(feedback.id),
        },
      };

  const queryResult = await notionRequest<NotionQueryResponse>(
    config,
    `/databases/${encodeURIComponent(config.databaseId)}/query`,
    {
      method: "POST",
      body: JSON.stringify({
        page_size: 1,
        filter,
      }),
    }
  );

  const pageId = queryResult.results?.[0]?.id;
  return typeof pageId === "string" && pageId ? pageId : null;
};

const listAllDatabasePages = async (config: NotionConfig) => {
  const pages: NotionPageObject[] = [];
  let cursor: string | null = null;

  for (let pageIndex = 0; pageIndex < MAX_QUERY_PAGES; pageIndex += 1) {
    const queryResult = await notionRequest<NotionQueryResponse>(
      config,
      `/databases/${encodeURIComponent(config.databaseId)}/query`,
      {
        method: "POST",
        body: JSON.stringify({
          page_size: 100,
          ...(cursor ? { start_cursor: cursor } : {}),
        }),
      }
    );

    if (Array.isArray(queryResult.results) && queryResult.results.length > 0) {
      pages.push(...queryResult.results);
    }

    if (!queryResult.has_more || !queryResult.next_cursor) {
      return pages;
    }

    cursor = queryResult.next_cursor;
  }

  throw new Error("Notion feedback page query exceeded pagination safety limit.");
};

const extractFeedbackIdFromPage = (
  page: NotionPageObject,
  feedbackIdProperty: NamedNotionProperty | null,
  titleProperty: NamedNotionProperty
) => {
  if (feedbackIdProperty) {
    const value = page.properties?.[feedbackIdProperty.name];
    if (feedbackIdProperty.type === "number") {
      const parsed = parseIntegerFromUnknown(value?.number);
      if (parsed != null) return parsed;
    }
    if (feedbackIdProperty.type === "rich_text") {
      const parsed = parseIntegerFromUnknown(getPlainText(value?.rich_text));
      if (parsed != null) return parsed;
    }
  }

  const titleValue = page.properties?.[titleProperty.name];
  const titleText = getPlainText(titleValue?.title);
  return extractFeedbackIdFromTitle(titleText);
};

const archiveNotionPage = async (config: NotionConfig, pageId: string) => {
  await notionRequest(config, `/pages/${encodeURIComponent(pageId)}`, {
    method: "PATCH",
    body: JSON.stringify({
      archived: true,
    }),
  });
};

export const pruneFeedbackPagesInNotion = async (
  feedbackIds: number[]
): Promise<NotionFeedbackPruneResult> => {
  const config = getNotionConfig();
  if (!config) {
    return {
      pruned: false,
      archivedCount: 0,
      duplicateArchivedCount: 0,
      orphanArchivedCount: 0,
      reason: "NOTION_API_KEY or NOTION_DATABASE_ID is not configured.",
    };
  }

  try {
    const keepFeedbackIds = new Set(
      feedbackIds
        .map((id) => parseIntegerFromUnknown(id))
        .filter((id): id is number => id != null)
    );

    const database = await notionRequest<NotionDatabaseResponse>(
      config,
      `/databases/${encodeURIComponent(config.databaseId)}`,
      { method: "GET" }
    );

    const properties = getNamedProperties(database.properties);
    const titleProperty = properties.find((property) => property.type === "title");
    if (!titleProperty) {
      throw new Error("Notion database has no title property.");
    }

    const feedbackIdProperty = findProperty(
      properties,
      new Set(["number", "rich_text"]),
      ["feedback_id", "feedback id", "id", "report_id", "report id"]
    );

    const allPages = await listAllDatabasePages(config);
    const deduplicatedFeedbackIds = new Set<number>();

    const duplicatePageIds: string[] = [];
    const orphanPageIds: string[] = [];

    for (const page of allPages) {
      const pageId = typeof page.id === "string" ? page.id : "";
      if (!pageId) continue;

      const feedbackId = extractFeedbackIdFromPage(
        page,
        feedbackIdProperty,
        titleProperty
      );

      if (feedbackId == null || !keepFeedbackIds.has(feedbackId)) {
        orphanPageIds.push(pageId);
        continue;
      }

      if (deduplicatedFeedbackIds.has(feedbackId)) {
        duplicatePageIds.push(pageId);
        continue;
      }

      deduplicatedFeedbackIds.add(feedbackId);
    }

    for (const pageId of duplicatePageIds) {
      await archiveNotionPage(config, pageId);
    }
    for (const pageId of orphanPageIds) {
      await archiveNotionPage(config, pageId);
    }

    return {
      pruned: true,
      archivedCount: duplicatePageIds.length + orphanPageIds.length,
      duplicateArchivedCount: duplicatePageIds.length,
      orphanArchivedCount: orphanPageIds.length,
      reason: null,
    };
  } catch (error) {
    console.error("[notion/feedbackSync] Failed to prune feedback pages:", error);
    return {
      pruned: false,
      archivedCount: 0,
      duplicateArchivedCount: 0,
      orphanArchivedCount: 0,
      reason: error instanceof Error ? error.message : "Unknown prune error",
    };
  }
};

export const upsertFeedbackToNotion = async (
  feedback: FeedbackSyncRecord
): Promise<FeedbackSyncResult> => {
  const config = getNotionConfig();
  if (!config) {
    return {
      synced: false,
      pageId: null,
      reason: "NOTION_API_KEY or NOTION_DATABASE_ID is not configured.",
    };
  }

  try {
    const database = await notionRequest<NotionDatabaseResponse>(
      config,
      `/databases/${encodeURIComponent(config.databaseId)}`,
      { method: "GET" }
    );

    const properties = buildNotionProperties(database.properties, feedback);
    const existingPageId = await findExistingPageId(
      config,
      database.properties,
      feedback
    );

    if (existingPageId) {
      await notionRequest(
        config,
        `/pages/${encodeURIComponent(existingPageId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ properties }),
        }
      );
      return {
        synced: true,
        pageId: existingPageId,
        reason: null,
      };
    }

    const created = await notionRequest<{ id?: string }>(config, "/pages", {
      method: "POST",
      body: JSON.stringify({
        parent: { database_id: config.databaseId },
        properties,
      }),
    });

    return {
      synced: true,
      pageId: typeof created.id === "string" ? created.id : null,
      reason: null,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown sync error";
    console.error("[notion/feedbackSync] Failed to sync feedback:", error);
    return {
      synced: false,
      pageId: null,
      reason,
    };
  }
};
