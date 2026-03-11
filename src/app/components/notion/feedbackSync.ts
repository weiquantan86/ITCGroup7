import "server-only";

const NOTION_API_BASE_URL = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RICH_TEXT_LENGTH = 1_900;

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

type NotionQueryResponse = {
  results?: Array<{ id?: string }>;
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
  const aliasSet = new Set(aliases.map(normalizeToken));
  return (
    properties.find(
      (property) =>
        allowedTypes.has(property.type) && aliasSet.has(normalizeToken(property.name))
    ) ?? null
  );
};

const buildRichTextPayload = (value: string) => [
  {
    type: "text",
    text: {
      content: trimRichText(value),
    },
  },
];

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
    new Set(["number"]),
    ["feedback_id", "feedback id", "id", "report_id", "report id"]
  );
  if (feedbackIdProperty) {
    notionProperties[feedbackIdProperty.name] = { number: feedback.id };
  }

  const userIdProperty = findProperty(
    properties,
    new Set(["number"]),
    ["user_id", "user id", "player_id", "player id"]
  );
  if (userIdProperty) {
    notionProperties[userIdProperty.name] = { number: feedback.userId };
  }

  const usernameProperty = findProperty(
    properties,
    new Set(["rich_text"]),
    ["username", "user", "player", "player_name", "player name"]
  );
  if (usernameProperty && feedback.username.trim()) {
    notionProperties[usernameProperty.name] = {
      rich_text: buildRichTextPayload(feedback.username),
    };
  }

  const descriptionProperty = findProperty(
    properties,
    new Set(["rich_text"]),
    ["description", "details", "feedback", "report"]
  );
  if (descriptionProperty && feedback.description?.trim()) {
    notionProperties[descriptionProperty.name] = {
      rich_text: buildRichTextPayload(feedback.description),
    };
  }

  const statusProperty = findProperty(
    properties,
    new Set(["status", "select", "rich_text"]),
    ["status", "state"]
  );
  if (statusProperty && feedback.status.trim()) {
    if (statusProperty.type === "rich_text") {
      notionProperties[statusProperty.name] = {
        rich_text: buildRichTextPayload(feedback.status),
      };
    } else {
      const candidates = normalizeStatusCandidates(feedback.status);
      const optionName =
        statusProperty.type === "status"
          ? pickStatusOption(statusProperty.status?.options, candidates)
          : pickStatusOption(statusProperty.select?.options, candidates);
      if (optionName) {
        notionProperties[statusProperty.name] =
          statusProperty.type === "status"
            ? { status: { name: optionName } }
            : { select: { name: optionName } };
      }
    }
  }

  const reportDateProperty = findProperty(
    properties,
    new Set(["date"]),
    ["report_date", "report date", "created_at", "created at", "date"]
  );
  const reportDateIso = toIsoString(feedback.reportDate);
  if (reportDateProperty && reportDateIso) {
    notionProperties[reportDateProperty.name] = {
      date: {
        start: reportDateIso,
      },
    };
  }

  const settleDateProperty = findProperty(
    properties,
    new Set(["date"]),
    ["settle_date", "settle date", "resolved_at", "resolved at"]
  );
  const settleDateIso = toIsoString(feedback.settleDate);
  if (settleDateProperty && settleDateIso) {
    notionProperties[settleDateProperty.name] = {
      date: {
        start: settleDateIso,
      },
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
    new Set(["number"]),
    ["feedback_id", "feedback id", "id", "report_id", "report id"]
  );

  const filter = feedbackIdProperty
    ? {
        property: feedbackIdProperty.name,
        number: {
          equals: feedback.id,
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
