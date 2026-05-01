export const fallbackEndpoints = [
  { method: "GET", path: "/api/admin/health" },
  { method: "GET", path: "/api/admin/logs" },
  { method: "GET", path: "/api/admin/commands" },
  { method: "POST", path: "/api/admin/commands/{command_id}" },
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
  if (!database) return "loading";
  if (database.status === "loading") return "loading";
  if (database.status !== "ok") return "missed";
  return "active";
}

function formatDuration(value, fallback) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }

  if (value <= 0) {
    return "0 ms";
  }

  if (value < 1) {
    return "<1 ms";
  }

  if (value < 1000) {
    return `${Math.round(value)} ms`;
  }

  if (value < 60000) {
    const seconds = value / 1000;
    return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)} s`;
  }

  if (value < 3600000) {
    const minutes = value / 60000;
    return `${minutes < 10 ? minutes.toFixed(1) : Math.round(minutes)} min`;
  }

  const hours = value / 3600000;
  return `${hours < 10 ? hours.toFixed(1) : Math.round(hours)} h`;
}

function formatLatency(value, fallback) {
  return formatDuration(value, fallback);
}

function formatStartupTime(value, fallback) {
  return formatDuration(value, fallback);
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

export function buildServiceRows(t, frontend, backend, database) {
  const backendOk = backend?.status === "ok";
  const backendHasStack = Boolean(backend?.language || backend?.stack);
  const databaseState = getDatabaseServiceState(database);
  const frontendState =
    !frontend || frontend.status === "loading"
      ? "loading"
      : frontend.status === "error"
        ? "missed"
        : "active";
  const backendState =
    !backend || backend.status === "loading" ? "loading" : backendOk ? "active" : "missed";

  function getStatusLabel(state) {
    if (state === "loading") return t.loading;
    if (state === "missed") return t.missed;
    return t.active;
  }

  return [
    {
      id: "frontend",
      name: t.frontend,
      state: frontendState,
      statusState: frontendState,
      statusLabel: getStatusLabel(frontendState),
      stack: splitStack(import.meta.env.VITE_FRONTEND_STACK),
      latency: formatLatency(frontend?.latency_ms, frontend ? t.notMeasured : t.checking),
      startupTime: formatStartupTime(frontend?.startup_ms, frontend ? t.notMeasured : t.checking),
    },
    {
      id: "backend",
      name: t.backend,
      state: backendState,
      statusState: backendState,
      statusLabel: getStatusLabel(backendState),
      stack: backendOk || backendHasStack
        ? [
            formatStack(backend.language, backend.language_version),
            formatStack(backend.stack, backend.stack_version),
          ].filter(Boolean)
        : [backend?.error || t.unavailable],
      latency: formatLatency(backend?.latency_ms, t.checking),
      startupTime: formatStartupTime(backend?.startup_ms, t.checking),
    },
    {
      id: "database",
      name: t.database,
      state: databaseState,
      statusState: databaseState,
      statusLabel: getStatusLabel(databaseState),
      stack: [database?.version || database?.backend || t.checking],
      latency: formatLatency(database?.latency_ms, t.checking),
      startupTime: formatStartupTime(
        database?.startup_ms,
        database ? t.notMeasured : t.checking,
      ),
    },
  ];
}
