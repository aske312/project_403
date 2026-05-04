export const fallbackEndpoints = [
  { method: "GET", path: "/api/admin/health", service: "admin", summary: "Backend health", parameters: [], bodyTemplate: "", presets: [] },
  { method: "GET", path: "/api/admin/logs", service: "admin", summary: "Project logs", parameters: [], bodyTemplate: "", presets: [] },
  { method: "GET", path: "/api/admin/check", service: "admin", summary: "Check endpoint", parameters: [], bodyTemplate: "", presets: [] },
  { method: "POST", path: "/api/admin/check", service: "admin", summary: "Check endpoint", parameters: [], bodyTemplate: "", presets: [] },
  { method: "PUT", path: "/api/admin/check", service: "admin", summary: "Check endpoint", parameters: [], bodyTemplate: "", presets: [] },
  { method: "PATCH", path: "/api/admin/check", service: "admin", summary: "Check endpoint", parameters: [], bodyTemplate: "", presets: [] },
  { method: "DELETE", path: "/api/admin/check", service: "admin", summary: "Check endpoint", parameters: [], bodyTemplate: "", presets: [] },
  { method: "POST", path: "/api/auth/register", service: "auth", summary: "Register", parameters: [], bodyTemplate: JSON.stringify({ email: "user@example.com", password: "Password123!", first_name: "Demo", last_name: "User" }, null, 2), presets: [] },
  { method: "POST", path: "/api/auth/login", service: "auth", summary: "Login", parameters: [], bodyTemplate: JSON.stringify({ login: "user@example.com", password: "Password123!" }, null, 2), presets: [] },
  { method: "GET", path: "/api/users/me", service: "users", summary: "Current user", parameters: [], bodyTemplate: "", presets: [] },
  { method: "GET", path: "/api/db/check_connect", service: "db", summary: "DB check", parameters: [], bodyTemplate: "", presets: [] },
  { method: "POST", path: "/api/db/init", service: "db", summary: "DB init", parameters: [], bodyTemplate: "", presets: [] },
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

function getEndpointService(path) {
  const segments = String(path || "").split("/").filter(Boolean);
  if (segments[0] !== "api") return "system";
  return segments[1] || "api";
}

function getSampleValue(schema, name = "value") {
  const normalized = String(name).toLowerCase();
  if (schema?.example !== undefined) return schema.example;
  if (schema?.default !== undefined) return schema.default;
  if (normalized.includes("email")) return "user@example.com";
  if (normalized.includes("password")) return "Password123!";
  if (normalized.includes("login")) return "demo";
  if (schema?.type === "integer" || schema?.type === "number") return 1;
  if (schema?.type === "boolean") return true;
  if (schema?.type === "array") return [];
  if (schema?.type === "object") return {};
  return `sample_${name}`;
}

function buildSampleBody(requestBody) {
  const content = requestBody?.content?.["application/json"] || Object.values(requestBody?.content || {})[0];
  const schema = content?.schema;
  if (!schema) return "";
  const props = schema.properties || {};
  const required = new Set(schema.required || []);
  const body = {};

  Object.entries(props).forEach(([name, prop]) => {
    if (required.has(name) || Object.keys(props).length <= 5) {
      body[name] = getSampleValue(prop, name);
    }
  });

  return JSON.stringify(Object.keys(body).length ? body : getSampleValue(schema), null, 2);
}

function buildResponsePresets(operation) {
  return Object.entries(operation?.responses || {}).map(([code, response]) => ({
    code,
    label: response?.description || `HTTP ${code}`,
    body: response?.content?.["application/json"]?.example || response?.content?.["application/json"]?.schema || { detail: response?.description || `HTTP ${code}` },
  }));
}

export function buildEndpointsFromOpenApi(schema) {
  return Object.entries(schema?.paths || {})
    .flatMap(([path, operations]) =>
      Object.entries(operations || {})
        .filter(([method]) => HTTP_METHODS.has(method))
        .map(([method, operation]) => ({
          method: method.toUpperCase(),
          path,
          service: getEndpointService(path),
          summary: operation.summary || operation.operationId || "",
          parameters: operation.parameters || [],
          bodyTemplate: buildSampleBody(operation.requestBody),
          presets: buildResponsePresets(operation),
          authRequired: (operation.security || []).length > 0 || path.includes("/admin") || path.includes("/users"),
        })),
    )
    .filter((endpoint) => !endpoint.path.includes('/api/admin/commands'))
    .sort((a, b) => `${a.service}:${a.path}:${a.method}`.localeCompare(`${b.service}:${b.path}:${b.method}`));
}

export function groupEndpointsByService(endpoints) {
  const groups = new Map();
  endpoints.forEach((endpoint) => {
    const service = endpoint.service || getEndpointService(endpoint.path);
    if (!groups.has(service)) groups.set(service, []);
    groups.get(service).push(endpoint);
  });

  return [...groups.entries()].map(([service, items]) => ({
    service,
    title: service === "system" ? "system" : `api/${service}`,
    endpoints: items,
  }));
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

  const integrations = backend?.integrations || {};
  const dockerEnabled = Boolean(integrations.docker_services_enabled);
  const redisEnabled = Boolean(integrations.redis?.enabled);
  const databaseIntegration = integrations.database || {};

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
      stack: [
        database?.version || database?.backend || databaseIntegration.backend || t.checking,
        databaseIntegration.postgresql_enabled ? "PostgreSQL requested" : "SQLite baseline",
      ],
      latency: formatLatency(database?.latency_ms, t.checking),
      startupTime: formatStartupTime(
        database?.startup_ms,
        database ? t.notMeasured : t.checking,
      ),
    },
    {
      id: "redis",
      name: "Redis",
      state: redisEnabled ? "active" : "missed",
      statusState: redisEnabled ? "active" : "neutral",
      statusLabel: redisEnabled ? t.active : "local fallback",
      stack: [integrations.redis?.mode || "local_fallback"],
      latency: t.notMeasured,
      startupTime: t.notMeasured,
    },
    {
      id: "docker",
      name: "Docker",
      state: dockerEnabled ? "active" : "missed",
      statusState: dockerEnabled ? "active" : "neutral",
      statusLabel: dockerEnabled ? t.active : "disabled",
      stack: [integrations.compose_file || "config/docker-compose.yml"],
      latency: t.notMeasured,
      startupTime: t.notMeasured,
    },
  ];
}
