export const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

async function requestJson(path, options) {
  const response = await fetch(`${API_URL}${path}`, options);
  const payload = await response.json();

  return { response, payload };
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
