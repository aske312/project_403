import { config } from "../config/appConfig";

export const API_URL = config.app.server.frontendApiUrl;
export const SERVICE_UNAVAILABLE_MESSAGE = "\u0421\u0435\u0440\u0432\u0438\u0441 \u0432\u0440\u0435\u043c\u0435\u043d\u043d\u043e \u043d\u0435 \u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d";

const inFlightJsonRequests = new Map();

function normalizeHeaders(headers) {
  if (!headers) return "";

  if (headers instanceof Headers) {
    return [...headers.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}:${value}`)
      .join("|");
  }

  if (Array.isArray(headers)) {
    return [...headers]
      .sort(([left], [right]) => String(left).localeCompare(String(right)))
      .map(([key, value]) => `${key}:${value}`)
      .join("|");
  }

  return Object.entries(headers)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${value}`)
    .join("|");
}

function getRequestMethod(options) {
  return String(options?.method || "GET").toUpperCase();
}

function getRequestKey(url, options) {
  return [
    getRequestMethod(options),
    url,
    normalizeHeaders(options?.headers),
    options?.body || "",
  ].join(" ");
}

async function requestJsonFromUrl(url, options) {
  const startedAt = performance.now();
  let response;

  try {
    response = await fetch(url, options);
  } catch {
    throw new Error(SERVICE_UNAVAILABLE_MESSAGE);
  }

  const payload = await response.json().catch(() => (
    response.status === 503 ? { detail: SERVICE_UNAVAILABLE_MESSAGE } : {}
  ));
  const durationMs = performance.now() - startedAt;

  return { response, payload, durationMs };
}

function requestJsonDeduped(url, options) {
  if (getRequestMethod(options) !== "GET") {
    return requestJsonFromUrl(url, options);
  }

  const key = getRequestKey(url, options);
  const existingRequest = inFlightJsonRequests.get(key);
  if (existingRequest) return existingRequest;

  const request = requestJsonFromUrl(url, options).finally(() => {
    inFlightJsonRequests.delete(key);
  });
  inFlightJsonRequests.set(key, request);
  return request;
}

async function requestJson(path, options) {
  return requestJsonDeduped(`${API_URL}${path}`, options);
}

async function requestBlob(path, options) {
  const response = await fetch(`${API_URL}${path}`, options);
  const payload = await response.blob();

  return { response, payload };
}

async function requestLocalJson(path, options) {
  return requestJsonDeduped(path, options);
}

export function getFrontendMetrics() {
  return requestLocalJson("/__project403/frontend-metrics");
}

export function getHealth(token) {
  return requestJson("/api/admin/health", token ? {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  } : undefined);
}

export function getProfile(token) {
  return requestJson("/api/users/me", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function login(payload) {
  return requestJson("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function register(payload) {
  return requestJson("/api/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function getOpenApi() {
  const { response, payload } = await requestJson("/openapi.json");
  if (!response.ok) {
    throw new Error(`OpenAPI ${response.status}`);
  }

  return payload;
}

export function checkDatabase(token) {
  return requestJson("/api/db/check_connect", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function getLogs(page = 1, pageSize = 10, token) {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });

  return requestJson(`/api/admin/logs?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function getChats(token) {
  return requestJson("/api/chats", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}


export function getContacts(token, query = "") {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  const suffix = params.toString() ? `?${params}` : "";
  return requestJson(`/api/chats/contacts${suffix}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function renameChat(chatId, title, token) {
  return requestJson(`/api/chats/${chatId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ title }),
  });
}

export function pinChat(chatId, pinned, pinOrder, token) {
  return requestJson(`/api/chats/${chatId}/pin`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ pinned, pin_order: pinOrder }),
  });
}

export function markChatRead(chatId, token) {
  return requestJson(`/api/chats/${chatId}/read`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function editChatMessage(messageId, body, token) {
  return requestJson(`/api/chats/messages/${messageId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ encoded_body: encodeWireBody(body) }),
  });
}

export function deleteChatMessage(messageId, scope, token) {
  return requestJson(`/api/chats/messages/${messageId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ scope }),
  });
}

export function sendChatMessage(chatId, body, token) {
  return requestJson(`/api/chats/${chatId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ encoded_body: encodeWireBody(body) }),
  });
}

export function downloadLog(downloadUrl, token) {
  return requestBlob(downloadUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}



export function getWebSocketUrl(path, token) {
  const base = API_URL.replace(/^http/i, "ws");
  const params = new URLSearchParams({ token });
  return `${base}${path}?${params}`;
}

export function encodeWireBody(value) {
  const bytes = new TextEncoder().encode(String(value || ""));
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return `wire:v1:${btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
}
