export const fallbackEndpoints = [
  { method: "GET", path: "/api/admin/health" },
  { method: "GET", path: "/api/admin/logs" },
  { method: "GET", path: "/api/admin/check" },
  { method: "POST", path: "/api/admin/check" },
  { method: "PUT", path: "/api/admin/check" },
  { method: "PATCH", path: "/api/admin/check" },
  { method: "DELETE", path: "/api/admin/check" },
  { method: "POST", path: "/api/auth/register" },
  { method: "POST", path: "/api/auth/login" },
  { method: "GET", path: "/api/users/me" },
  { method: "GET", path: "/api/db/check_connect" },
  { method: "POST", path: "/api/db/init" },
];

const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete"]);

function formatStack(name, version) {
  return [name, version].filter(Boolean).join(" ");
}

function splitStack(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getDatabaseServiceState(database) {
  if (!database) return "unknown";
  if (database.status !== "ok") return "error";
  return database.backend === "postgresql" ? "ok" : "warning";
}

export function buildEndpointsFromOpenApi(schema) {
  return Object.entries(schema?.paths || {})
    .flatMap(([path, operations]) =>
      Object.keys(operations || {})
        .filter((method) => HTTP_METHODS.has(method))
        .map((method) => ({
          method: method.toUpperCase(),
          path,
        })),
    )
    .sort((a, b) => `${a.path}:${a.method}`.localeCompare(`${b.path}:${b.method}`));
}

export function buildServiceRows(t, backend, database) {
  const backendOk = backend?.status === "ok";
  const databaseState = getDatabaseServiceState(database);

  return [
    {
      id: "frontend",
      name: t.frontend,
      state: "ok",
      stack: splitStack(import.meta.env.VITE_FRONTEND_STACK),
    },
    {
      id: "backend",
      name: t.backend,
      state: backendOk ? "ok" : "error",
      stack: backendOk
        ? [
            formatStack(backend.language, backend.language_version),
            formatStack(backend.stack, backend.stack_version),
          ].filter(Boolean)
        : [backend?.error || t.unavailable],
    },
    {
      id: "database",
      name: t.database,
      state: databaseState,
      stack: [database?.version || database?.backend || t.checking],
    },
  ];
}
