import { config } from "../config/appConfig";

export const API_URL = config.app.server.frontendApiUrl;

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
  const response = await fetch(url, options);
  const payload = await response.json();
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

async function requestLocalJson(path, options) {
  return requestJsonDeduped(path, options);
}

export function getFrontendMetrics() {
  return requestLocalJson("/__project403/frontend-metrics");
}

export function getHealth() {
  return requestJson("/api/admin/health");
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

export function checkDatabase() {
  return requestJson("/api/db/check_connect");
}

export function getLogs(page = 1, pageSize = 10) {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });

  return requestJson(`/api/admin/logs?${params}`);
}

export function runAdminCommand(commandId, token) {
  return requestJson(`/api/admin/commands/${commandId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}
