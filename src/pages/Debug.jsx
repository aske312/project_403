import { useEffect, useMemo, useState } from "react";
import "../styles/debug.css";
import Endpoint from "../components/Endpoint";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const LOG_DOWNLOAD_URL = `${API_URL}/api/debug/logs/app`;
const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete"]);

const fallbackEndpoints = [
  { method: "GET", path: "/api/debug/health" },
  { method: "GET", path: "/api/debug/logs/app" },
  { method: "GET", path: "/api/debug/check" },
  { method: "POST", path: "/api/debug/check" },
  { method: "PUT", path: "/api/debug/check" },
  { method: "PATCH", path: "/api/debug/check" },
  { method: "DELETE", path: "/api/debug/check" },
  { method: "GET", path: "/api/db/check_connect" },
  { method: "POST", path: "/api/db/init" },
];

const envStates = {
  active: "active",
  deactive: "deactive",
  inactive: "deactive",
  debug: "debug",
  dev: "dev",
  development: "dev",
  close: "close",
  closed: "close",
};

const copy = {
  EN: {
    home: "Home",
    language: "RU",
    themeLight: "Light theme",
    themeDark: "Dark theme",
    pageName: "Services",
    pageTitle: "Administration panel",
    pageSubtitle: "Service state, build context and API diagnostics for local operation.",
    projectState: "Project state",
    buildVersion: "Build version",
    services: "Services",
    serviceColumn: "Services",
    stack: "Stack",
    backend: "Backend",
    database: "Database",
    frontend: "Frontend",
    unavailable: "Unavailable",
    checking: "Checking...",
    apiSurface: "API surface",
    downloadLog: "Download log",
    github: "GitHub",
    vk: "VK",
    telegram: "Telegram",
  },
  RU: {
    home: "\u041d\u0430 \u0433\u043b\u0430\u0432\u043d\u0443\u044e",
    language: "EN",
    themeLight: "\u0421\u0432\u0435\u0442\u043b\u0430\u044f \u0442\u0435\u043c\u0430",
    themeDark: "\u0422\u0435\u043c\u043d\u0430\u044f \u0442\u0435\u043c\u0430",
    pageName: "\u0421\u0435\u0440\u0432\u0438\u0441\u044b",
    pageTitle: "\u0410\u0434\u043c\u0438\u043d-\u043f\u0430\u043d\u0435\u043b\u044c",
    pageSubtitle: "\u0421\u043e\u0441\u0442\u043e\u044f\u043d\u0438\u0435 \u0441\u043b\u0443\u0436\u0431, \u043a\u043e\u043d\u0442\u0435\u043a\u0441\u0442 \u0441\u0431\u043e\u0440\u043a\u0438 \u0438 API-\u0434\u0438\u0430\u0433\u043d\u043e\u0441\u0442\u0438\u043a\u0430 \u0434\u043b\u044f \u043b\u043e\u043a\u0430\u043b\u044c\u043d\u043e\u0439 \u0440\u0430\u0431\u043e\u0442\u044b.",
    projectState: "\u0421\u043e\u0441\u0442\u043e\u044f\u043d\u0438\u0435 \u043f\u0440\u043e\u0435\u043a\u0442\u0430",
    buildVersion: "\u0412\u0435\u0440\u0441\u0438\u044f \u0441\u0431\u043e\u0440\u043a\u0438",
    services: "\u0421\u0435\u0440\u0432\u0438\u0441\u044b",
    serviceColumn: "\u0421\u0435\u0440\u0432\u0438\u0441\u044b",
    stack: "\u0421\u0442\u0435\u043a",
    backend: "Backend",
    database: "\u0411\u0430\u0437\u0430 \u0434\u0430\u043d\u043d\u044b\u0445",
    frontend: "Frontend",
    unavailable: "\u041d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d",
    checking: "\u041f\u0440\u043e\u0432\u0435\u0440\u043a\u0430...",
    apiSurface: "API",
    downloadLog: "\u0421\u043a\u0430\u0447\u0430\u0442\u044c \u043b\u043e\u0433",
    github: "GitHub",
    vk: "VK",
    telegram: "Telegram",
  },
};

function getInitials(name) {
  return String(name || "P")
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

function formatStack(name, version) {
  return [name, version].filter(Boolean).join(" ");
}

function splitStack(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeEnvironment(value) {
  const raw = String(value || "dev").trim();
  const key = raw.toLowerCase();
  return {
    label: raw.toUpperCase(),
    state: envStates[key] || "dev",
  };
}

function buildEndpointsFromOpenApi(schema) {
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

function getDatabaseServiceState(database) {
  if (!database) return "unknown";
  if (database.status !== "ok") return "error";
  return database.backend === "postgresql" ? "ok" : "warning";
}

function StatusPill({ state, label }) {
  return (
    <span className={`service-pill ${state}`}>
      <span aria-hidden="true" />
      {label}
    </span>
  );
}

export default function Debug() {
  const [theme, setTheme] = useState("dark");
  const [lang, setLang] = useState("RU");
  const [endpoints, setEndpoints] = useState(fallbackEndpoints);
  const [backend, setBackend] = useState(null);
  const [database, setDatabase] = useState(null);

  const t = copy[lang];
  const projectName = backend?.app || import.meta.env.VITE_APP_NAME;
  const env = normalizeEnvironment(backend?.environment || import.meta.env.MODE);

  useEffect(() => {
    let ignore = false;

    async function loadOpenApi() {
      try {
        const response = await fetch(`${API_URL}/openapi.json`);
        if (!response.ok) throw new Error(`OpenAPI ${response.status}`);

        const schema = await response.json();
        const nextEndpoints = buildEndpointsFromOpenApi(schema);

        if (!ignore && nextEndpoints.length > 0) {
          setEndpoints(nextEndpoints);
        }
      } catch {
        if (!ignore) setEndpoints(fallbackEndpoints);
      }
    }

    async function loadBackend() {
      try {
        const response = await fetch(`${API_URL}/api/debug/health`);
        const payload = await response.json();
        if (!ignore) setBackend(payload);
      } catch (error) {
        if (!ignore) setBackend({ status: "error", error: error.message });
      }
    }

    async function loadDatabase() {
      try {
        const response = await fetch(`${API_URL}/api/db/check_connect`);
        const payload = await response.json();
        if (!ignore) setDatabase(payload);
      } catch (error) {
        if (!ignore) setDatabase({ status: "error", error: error.message });
      }
    }

    loadOpenApi();
    loadBackend();
    loadDatabase();

    return () => {
      ignore = true;
    };
  }, []);

  const serviceRows = useMemo(() => {
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
  }, [backend, database, t]);

  return (
    <div className={`debug-page ${theme}`}>
      <header className="debug-topbar">
        <a className="debug-brand" href="/">
          <span className="debug-brand-mark">{getInitials(projectName)}</span>
          <span>{projectName}</span>
        </a>

        <div className="debug-actions">
          <button
            className="debug-flag-switch"
            type="button"
            onClick={() => setLang(lang === "RU" ? "EN" : "RU")}
            aria-label={t.language}
            title={t.language}
          >
            <img src={lang === "RU" ? "/uk.png" : "/ru.png"} alt="" />
            <span>{t.language}</span>
          </button>

          <button
            className="debug-control"
            type="button"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            {theme === "light" ? t.themeDark : t.themeLight}
          </button>

          <a className="debug-home-link" href="/">
            {t.home}
          </a>
        </div>
      </header>

      <main className="debug-layout">
        <section className="service-hero">
          <div>
            <p className="debug-eyebrow">{t.pageName}</p>
            <h1>{t.pageTitle}</h1>
            <p>{t.pageSubtitle}</p>
          </div>

          <div className="status-panel">
            <div className="status-panel-head">
              <span>{t.projectState}</span>
              <StatusPill state={env.state} label={env.label} />
            </div>
            <div className="status-version">
              <span>{t.buildVersion}</span>
              <strong>{backend?.version || import.meta.env.VITE_APP_VERSION}</strong>
            </div>
            <a
              className="runtime-log-link"
              href={LOG_DOWNLOAD_URL}
              download
              title={t.downloadLog}
              aria-label={t.downloadLog}
            >
              <span className="log-download-icon" aria-hidden="true" />
              <span>{t.downloadLog}</span>
            </a>
          </div>
        </section>

        <section className="services-section" aria-label={t.services}>
          <div className="section-head">
            <h2>{t.services}</h2>
            <span>{serviceRows.length}</span>
          </div>

          <div className="service-table">
            <div className="service-table-head">
              <span>{t.serviceColumn}</span>
              <span>{t.stack}</span>
            </div>

            {serviceRows.map((service) => (
              <div className="service-row" key={service.id}>
                <StatusPill state={service.state} label={service.name} />
                <ul>
                  {service.stack.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="api-section" aria-label={t.apiSurface}>
          <div className="section-head">
            <h2>{t.apiSurface}</h2>
            <span>{endpoints.length}</span>
          </div>

          <div className="endpoint-stack">
            {endpoints.map((endpoint) => (
              <Endpoint
                key={`${endpoint.method}-${endpoint.path}`}
                method={endpoint.method}
                path={endpoint.path}
              />
            ))}
          </div>
        </section>
      </main>

      <footer className="debug-footer">
        <div className="footer-status">
          <span className={`status-dot ${env.state}`} aria-hidden="true" />
          <span>{env.label}</span>
        </div>

        <nav className="footer-links" aria-label="Footer">
          <a href="https://github.com/aske312/project_403/blob/master/README.md">{t.github}</a>
          <a href="https://vk.com/aske312">{t.vk}</a>
          <a href="https://t.me/aske312">{t.telegram}</a>
        </nav>
      </footer>
    </div>
  );
}
