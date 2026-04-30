import { useEffect, useMemo, useState } from "react";
import "../styles/debug.css";
import Endpoint from "../components/Endpoint";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete"]);
const LOG_DOWNLOAD_URL = `${API_URL}/api/debug/logs/app`;

const fallbackEndpointGroups = [
  {
    id: "debug",
    tone: "blue",
    endpoints: [
      { method: "GET", path: "/api/debug/health" },
      { method: "GET", path: "/api/debug/logs/app" },
      { method: "GET", path: "/api/debug/check" },
      { method: "POST", path: "/api/debug/check" },
      { method: "PUT", path: "/api/debug/check" },
      { method: "PATCH", path: "/api/debug/check" },
      { method: "DELETE", path: "/api/debug/check" },
    ],
  },
  {
    id: "database",
    tone: "green",
    endpoints: [
      { method: "GET", path: "/api/db/check_connect" },
      { method: "POST", path: "/api/db/init" },
    ],
  },
];

function formatGroupName(id) {
  return id
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getGroupId(path) {
  const segments = path.split("/").filter(Boolean);

  if (segments[0] === "api" && segments[1]) {
    return segments[1];
  }

  return segments[0] || "root";
}

function getGroupTone(index) {
  const tones = ["blue", "green", "blue", "green"];
  return tones[index % tones.length];
}

function buildGroupsFromOpenApi(schema) {
  const paths = schema?.paths || {};
  const groups = new Map();

  Object.entries(paths).forEach(([path, operations]) => {
    Object.keys(operations || {}).forEach((method) => {
      if (!HTTP_METHODS.has(method)) return;

      const id = getGroupId(path);
      const group = groups.get(id) || {
        id,
        endpoints: [],
      };

      group.endpoints.push({
        method: method.toUpperCase(),
        path,
      });
      groups.set(id, group);
    });
  });

  return Array.from(groups.values()).map((group, index) => ({
    ...group,
    tone: getGroupTone(index),
  }));
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

const copy = {
  EN: {
    brand: "Project_403",
    home: "Home",
    language: "RU",
    themeLight: "Light theme",
    themeDark: "Dark theme",
    eyebrow: "OpenAPI contract checks",
    title: "Functional API debugging",
    description: "Validate API contracts while debugging application behavior: run focused probes, inspect real responses and compare runtime output with the expected endpoint surface.",
    environment: "Development",
    appStatus: "Application in development",
    versionLabel: "Version",
    environmentLabel: "Environment",
    modeLabel: "Mode",
    backendLabel: "Backend",
    backendLoading: "Checking backend...",
    backendUnavailable: "Unavailable",
    frontendLabel: "Frontend",
    databaseLabel: "Database",
    databaseLoading: "Checking database...",
    databaseUnavailable: "Unavailable",
    downloadLog: "Download log",
    totalChecks: "Checks",
    httpMethods: "HTTP methods",
    serviceChecks: "Service checks",
    contractText: "Contracts discovered from the active OpenAPI schema.",
    fallbackText: "Fallback checks are shown because OpenAPI schema is unavailable.",
    schemaLoaded: "Contracts loaded from OpenAPI schema.",
    schemaFallback: "OpenAPI schema is unavailable. Showing fallback checks.",
    runHint: "Click an endpoint row to send the request and inspect the response.",
    footerStatus: "Internal diagnostics",
    github: "GitHub",
    vk: "VK",
    telegram: "Telegram",
  },
  RU: {
    brand: "Project_403",
    home: "\u041d\u0430 \u0433\u043b\u0430\u0432\u043d\u0443\u044e",
    language: "EN",
    themeLight: "\u0421\u0432\u0435\u0442\u043b\u0430\u044f \u0442\u0435\u043c\u0430",
    themeDark: "\u0422\u0435\u043c\u043d\u0430\u044f \u0442\u0435\u043c\u0430",
    eyebrow: "OpenAPI contract checks",
    title: "\u041e\u0442\u043b\u0430\u0434\u043a\u0430 API-\u0444\u0443\u043d\u043a\u0446\u0438\u0439",
    description: "\u041f\u0440\u043e\u0432\u0435\u0440\u044f\u0439\u0442\u0435 API-\u043a\u043e\u043d\u0442\u0440\u0430\u043a\u0442\u044b \u0432\u043e \u0432\u0440\u0435\u043c\u044f \u043e\u0442\u043b\u0430\u0434\u043a\u0438 \u0444\u0443\u043d\u043a\u0446\u0438\u0439: \u0437\u0430\u043f\u0443\u0441\u043a\u0430\u0439\u0442\u0435 \u0442\u043e\u0447\u0435\u0447\u043d\u044b\u0435 \u043f\u0440\u043e\u0431\u044b, \u0441\u043c\u043e\u0442\u0440\u0438\u0442\u0435 \u0440\u0435\u0430\u043b\u044c\u043d\u044b\u0435 response \u0438 \u0441\u0432\u0435\u0440\u044f\u0439\u0442\u0435 runtime-\u0432\u044b\u0432\u043e\u0434 \u0441 \u043e\u0436\u0438\u0434\u0430\u0435\u043c\u043e\u0439 API-\u043f\u043e\u0432\u0435\u0440\u0445\u043d\u043e\u0441\u0442\u044c\u044e.",
    environment: "\u0420\u0430\u0437\u0440\u0430\u0431\u043e\u0442\u043a\u0430",
    appStatus: "\u041f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u0438\u0435 \u0432 \u0440\u0430\u0437\u0440\u0430\u0431\u043e\u0442\u043a\u0435",
    versionLabel: "\u0412\u0435\u0440\u0441\u0438\u044f",
    environmentLabel: "\u0421\u0440\u0435\u0434\u0430",
    modeLabel: "\u0420\u0435\u0436\u0438\u043c",
    backendLabel: "Backend",
    backendLoading: "\u041f\u0440\u043e\u0432\u0435\u0440\u043a\u0430 backend...",
    backendUnavailable: "\u041d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d",
    frontendLabel: "Frontend",
    databaseLabel: "\u0411\u0430\u0437\u0430 \u0434\u0430\u043d\u043d\u044b\u0445",
    databaseLoading: "\u041f\u0440\u043e\u0432\u0435\u0440\u043a\u0430 \u0411\u0414...",
    databaseUnavailable: "\u041d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0430",
    downloadLog: "\u0421\u043a\u0430\u0447\u0430\u0442\u044c \u043b\u043e\u0433",
    totalChecks: "\u041f\u0440\u043e\u0432\u0435\u0440\u043a\u0438",
    httpMethods: "HTTP \u043c\u0435\u0442\u043e\u0434\u044b",
    serviceChecks: "\u0421\u0435\u0440\u0432\u0438\u0441\u044b",
    contractText: "\u041a\u043e\u043d\u0442\u0440\u0430\u043a\u0442\u044b, \u043d\u0430\u0439\u0434\u0435\u043d\u043d\u044b\u0435 \u0432 \u0430\u043a\u0442\u0438\u0432\u043d\u043e\u0439 OpenAPI-\u0441\u0445\u0435\u043c\u0435.",
    fallbackText: "Fallback checks \u043f\u043e\u043a\u0430\u0437\u0430\u043d\u044b, \u043f\u043e\u0442\u043e\u043c\u0443 \u0447\u0442\u043e OpenAPI-\u0441\u0445\u0435\u043c\u0430 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0430.",
    schemaLoaded: "\u041a\u043e\u043d\u0442\u0440\u0430\u043a\u0442\u044b \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043d\u044b \u0438\u0437 OpenAPI-\u0441\u0445\u0435\u043c\u044b.",
    schemaFallback: "OpenAPI-\u0441\u0445\u0435\u043c\u0430 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0430. \u041f\u043e\u043a\u0430\u0437\u0430\u043d\u044b fallback checks.",
    runHint: "\u041d\u0430\u0436\u043c\u0438\u0442\u0435 endpoint, \u0447\u0442\u043e\u0431\u044b \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c request \u0438 \u043f\u043e\u0441\u043c\u043e\u0442\u0440\u0435\u0442\u044c response.",
    footerStatus: "\u0412\u043d\u0443\u0442\u0440\u0435\u043d\u043d\u044f\u044f \u0434\u0438\u0430\u0433\u043d\u043e\u0441\u0442\u0438\u043a\u0430",
    github: "GitHub",
    vk: "VK",
    telegram: "Telegram",
  },
};

function EndpointGroup({ title, text, tone, endpoints }) {
  return (
    <section className={`debug-card endpoint-group ${tone}`}>
      <div className="group-head">
        <div>
          <h2>{title}</h2>
          <p>{text}</p>
        </div>
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
  );
}

export default function Debug() {
  const [theme, setTheme] = useState("dark");
  const [lang, setLang] = useState("EN");
  const [contracts, setContracts] = useState({
    groups: fallbackEndpointGroups,
    source: "fallback",
  });
  const [backend, setBackend] = useState(null);
  const [database, setDatabase] = useState(null);
  const t = copy[lang];

  useEffect(() => {
    let ignore = false;

    async function loadOpenApiContracts() {
      try {
        const response = await fetch(`${API_URL}/openapi.json`);

        if (!response.ok) {
          throw new Error(`OpenAPI schema error: ${response.status}`);
        }

        const schema = await response.json();
        const groups = buildGroupsFromOpenApi(schema);

        if (!ignore && groups.length > 0) {
          setContracts({
            groups,
            source: "openapi",
          });
        }
      } catch {
        if (!ignore) {
          setContracts({
            groups: fallbackEndpointGroups,
            source: "fallback",
          });
        }
      }
    }

    async function loadDatabaseStatus() {
      try {
        const response = await fetch(`${API_URL}/api/db/check_connect`);
        const payload = await response.json();

        if (!ignore) {
          setDatabase(payload);
        }
      } catch (error) {
        if (!ignore) {
          setDatabase({
            status: "error",
            error: error.message,
          });
        }
      }
    }

    async function loadBackendStatus() {
      try {
        const response = await fetch(`${API_URL}/api/debug/health`);
        const payload = await response.json();

        if (!ignore) {
          setBackend(payload);
        }
      } catch (error) {
        if (!ignore) {
          setBackend({
            status: "error",
            error: error.message,
          });
        }
      }
    }

    loadOpenApiContracts();
    loadBackendStatus();
    loadDatabaseStatus();

    return () => {
      ignore = true;
    };
  }, []);

  const metrics = useMemo(() => {
    const allEndpoints = contracts.groups.flatMap((group) => group.endpoints);
    return [
      { label: t.totalChecks, value: allEndpoints.length },
      { label: t.httpMethods, value: new Set(allEndpoints.map((endpoint) => endpoint.method)).size },
      { label: t.serviceChecks, value: contracts.groups.length },
    ];
  }, [contracts.groups, t]);

  const runtimeSummary = useMemo(() => {
    const backendItems = backend?.status === "ok"
      ? [
          formatStack(backend.language, backend.language_version),
          formatStack(backend.stack, backend.stack_version),
        ].filter(Boolean)
      : backend?.error || t.backendLoading;

    const databaseValue = database ? database.version || database.backend || t.databaseUnavailable : t.databaseLoading;

    return [
      { label: t.versionLabel, value: backend?.version || import.meta.env.VITE_APP_VERSION },
      { label: t.frontendLabel, items: splitStack(import.meta.env.VITE_FRONTEND_STACK) },
      {
        label: t.backendLabel,
        value: Array.isArray(backendItems) ? null : backendItems || t.backendUnavailable,
        items: Array.isArray(backendItems) ? backendItems : null,
        state: backend?.status === "ok" ? "ok" : "error",
      },
      {
        label: t.databaseLabel,
        items: [databaseValue],
        state: database?.status === "ok" ? "ok" : "error",
      },
    ];
  }, [backend, database, t]);

  const runtimeEnvironment = backend?.environment || import.meta.env.MODE;
  const runtimeState = backend?.status === "ok" && database?.status === "ok" ? "ok" : "error";

  const initials = useMemo(
    () => t.brand.split("_").map((part) => part[0]).join(""),
    [t.brand],
  );

  return (
    <div className={`debug-page ${theme}`}>
      <header className="debug-topbar">
        <a className="debug-brand" href="/">
          <span className="debug-brand-mark">{initials}</span>
          <span>{t.brand}</span>
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
        <section className="debug-hero">
          <div className="hero-copy">
            <p className="debug-eyebrow">{t.eyebrow}</p>
            <h1>{t.title}</h1>
            <p>{t.description}</p>
          </div>

          <aside className="openapi-card" aria-label="Runtime summary">
            <div className="openapi-card-head">
              <span>RUNTIME</span>
              <div className="runtime-head-actions">
                <strong className={`runtime-env ${runtimeState}`}>
                  <span className="runtime-dot" aria-hidden="true" />
                  <span>{runtimeEnvironment}</span>
                </strong>
                <a className="runtime-log-link" href={LOG_DOWNLOAD_URL} download>
                  {t.downloadLog}
                </a>
              </div>
            </div>
            <dl>
              {runtimeSummary.map((item) => (
                <div
                  className={item.state ? `runtime-row ${item.state}` : "runtime-row"}
                  key={item.label}
                >
                  <dt>{item.label}</dt>
                  <dd className="runtime-status">
                    {item.state && <span className="runtime-dot" aria-hidden="true" />}
                  </dd>
                  <dd>
                    {item.items ? (
                      <ul className="runtime-stack-list">
                        {item.items.map((stackItem) => (
                          <li key={stackItem}>{stackItem}</li>
                        ))}
                      </ul>
                    ) : (
                      item.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </aside>
        </section>

        <section className="metric-grid" aria-label="Diagnostics summary">
          {metrics.map((metric) => (
            <div className="metric-card" key={metric.label}>
              <span>{metric.value}</span>
              <p>{metric.label}</p>
            </div>
          ))}
        </section>

        <div className="hint-bar">
          <span className="status-dot" aria-hidden="true" />
          <span>
            {contracts.source === "openapi" ? t.schemaLoaded : t.schemaFallback} {t.runHint}
          </span>
        </div>

        {contracts.groups.map((group) => (
          <EndpointGroup
            key={group.id}
            title={formatGroupName(group.id)}
            text={contracts.source === "openapi" ? t.contractText : t.fallbackText}
            tone={group.tone}
            endpoints={group.endpoints}
          />
        ))}
      </main>

      <footer className="debug-footer">
        <div className="footer-status">
          <span className="status-dot" aria-hidden="true" />
          <span>{t.footerStatus}</span>
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
