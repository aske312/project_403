export const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

async function requestJsonFromUrl(url, options) {
  const startedAt = performance.now();
  const response = await fetch(url, options);
  const payload = await response.json();
  const durationMs = performance.now() - startedAt;

  return { response, payload, durationMs };
}

async function requestJson(path, options) {
  return requestJsonFromUrl(`${API_URL}${path}`, options);
}

async function requestLocalJson(path, options) {
  return requestJsonFromUrl(path, options);
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

export function getLogs() {
  return requestJson("/api/admin/logs");
}
