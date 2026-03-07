const CONNECTION_ERROR_CODES = new Set([
  "ETIMEDOUT",
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "EAI_AGAIN",
  "08001",
  "08006",
  "57P01",
]);

type ErrorWithDetails = {
  code?: unknown;
  message?: unknown;
  cause?: unknown;
  errors?: unknown;
};

function collectErrorContext(
  value: unknown,
  codes: Set<string>,
  messages: Set<string>
) {
  if (!value || typeof value !== "object") {
    return;
  }

  const maybeError = value as ErrorWithDetails;

  if (typeof maybeError.code === "string" && maybeError.code.length > 0) {
    codes.add(maybeError.code);
  }

  if (typeof maybeError.message === "string" && maybeError.message.length > 0) {
    messages.add(maybeError.message);
  }

  if (Array.isArray(maybeError.errors)) {
    for (const child of maybeError.errors) {
      collectErrorContext(child, codes, messages);
    }
  }

  if (maybeError.cause) {
    collectErrorContext(maybeError.cause, codes, messages);
  }
}

export function getDatabaseErrorDetails(error: unknown) {
  const codes = new Set<string>();
  const messages = new Set<string>();
  collectErrorContext(error, codes, messages);

  const codeList = [...codes];
  const messageList = [...messages];
  const normalizedMessageBlob = messageList.join(" ").toLowerCase();
  const hasConnectionPattern =
    normalizedMessageBlob.includes("connect") ||
    normalizedMessageBlob.includes("connection") ||
    normalizedMessageBlob.includes("socket") ||
    normalizedMessageBlob.includes("timeout");

  const isConnectionError = codeList.some((code) =>
    CONNECTION_ERROR_CODES.has(code)
  ) || hasConnectionPattern;
  const isTimeout =
    codeList.includes("ETIMEDOUT") ||
    normalizedMessageBlob.includes("timeout");

  return {
    message: error instanceof Error ? error.message : String(error),
    codes: codeList,
    messages: messageList,
    isConnectionError,
    isTimeout,
  };
}
