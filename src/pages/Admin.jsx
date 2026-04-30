import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import AdminAccessPanel from "../components/AdminAccessPanel";
import AdminApiSection from "../components/AdminApiSection";
import AdminLogsSection from "../components/AdminLogsSection";
import AdminServiceOverview from "../components/AdminServiceOverview";
import AppFooter from "../components/AppFooter";
import AppHeader from "../components/AppHeader";
import {
  API_URL,
  checkDatabase,
  getFrontendMetrics,
  getHealth,
  getLogs,
  getOpenApi,
} from "../utils/apiClient";
import { adminCopy } from "../utils/adminCopy";
import {
  buildEndpointsFromOpenApi,
  buildServiceRows,
  fallbackEndpoints,
} from "../utils/adminData";
import { canUseAdminPanel, normalizeEnvironment } from "../utils/environment";
import { getFrontendPerformanceMetrics } from "../utils/performanceMetrics";
import { useAuthSession } from "../utils/useAuthSession";
import "../styles/admin.css";

export default function Admin() {
  const [theme, setTheme] = useState("dark");
  const [lang, setLang] = useState("RU");
  const [endpoints, setEndpoints] = useState(fallbackEndpoints);
  const [frontend, setFrontend] = useState(null);
  const [backend, setBackend] = useState(null);
  const [database, setDatabase] = useState(null);
  const [logs, setLogs] = useState([]);
  const {
    profile,
    profileLoaded,
    accountOpen,
    setAccountOpen,
    logout,
  } = useAuthSession();

  const t = adminCopy[lang];
  const projectName = backend?.app || import.meta.env.VITE_APP_NAME;
  const env = normalizeEnvironment(backend?.environment || import.meta.env.MODE);
  const adminAccessAllowed = canUseAdminPanel(profile, env);
  const accessReady = Boolean(backend) && profileLoaded;

  useEffect(() => {
    let ignore = false;
    const frameId = requestAnimationFrame(async () => {
      const browserMetrics = getFrontendPerformanceMetrics();

      try {
        const { payload, durationMs } = await getFrontendMetrics();
        if (!ignore) {
          setFrontend({
            ...payload,
            latency_ms: durationMs,
            startup_ms: payload.startup_ms ?? browserMetrics.startup_ms,
          });
        }
      } catch {
        if (!ignore) setFrontend(browserMetrics);
      }
    });

    return () => {
      ignore = true;
      cancelAnimationFrame(frameId);
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadBackend() {
      try {
        const { payload, durationMs } = await getHealth();
        if (!ignore) setBackend({ ...payload, latency_ms: durationMs });
      } catch (error) {
        if (!ignore) setBackend({ status: "error", error: error.message });
      }
    }

    loadBackend();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!accessReady || !adminAccessAllowed) return undefined;

    let ignore = false;

    async function loadOpenApi() {
      try {
        const schema = await getOpenApi();
        const nextEndpoints = buildEndpointsFromOpenApi(schema);

        if (!ignore && nextEndpoints.length > 0) {
          setEndpoints(nextEndpoints);
        }
      } catch {
        if (!ignore) setEndpoints(fallbackEndpoints);
      }
    }

    async function loadDatabase() {
      try {
        const { payload, durationMs } = await checkDatabase();
        if (!ignore) {
          setDatabase({
            ...payload,
            request_latency_ms: durationMs,
            latency_ms: payload.latency_ms ?? durationMs,
          });
        }
      } catch (error) {
        if (!ignore) setDatabase({ status: "error", error: error.message });
      }
    }

    async function loadLogs() {
      try {
        const { payload } = await getLogs();
        if (!ignore) setLogs(payload.logs || []);
      } catch {
        if (!ignore) setLogs([]);
      }
    }

    loadOpenApi();
    loadDatabase();
    loadLogs();

    return () => {
      ignore = true;
    };
  }, [accessReady, adminAccessAllowed]);

  const serviceRows = useMemo(
    () => buildServiceRows(t, frontend, backend, database),
    [backend, database, frontend, t],
  );

  if (accessReady && !adminAccessAllowed) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className={`admin-page ${theme}`}>
      <AppHeader
        variant="admin"
        projectName={projectName}
        projectHref="/"
        theme={theme}
        lang={lang}
        t={t}
        profile={profile}
        accountOpen={accountOpen}
        onToggleAccount={() => setAccountOpen((value) => !value)}
        onToggleLang={() => setLang(lang === "RU" ? "EN" : "RU")}
        onToggleTheme={() => setTheme(theme === "light" ? "dark" : "light")}
        onLogout={logout}
        adminLinkVisible={adminAccessAllowed}
        adminLinkLabel={t.adminPanel}
      />

      {!accessReady ? (
        <AdminAccessPanel t={t} env={env} backend={backend} />
      ) : (
        <main className="admin-layout">
          <AdminServiceOverview
            t={t}
            env={env}
            backend={backend}
            serviceRows={serviceRows}
          />
          <AdminApiSection t={t} endpoints={endpoints} />
          <AdminLogsSection t={t} logs={logs} apiUrl={API_URL} />
        </main>
      )}

      <AppFooter
        variant="admin"
        statusLabel={env.label}
        statusState={env.state}
        version={backend?.version || import.meta.env.VITE_APP_VERSION}
        links={[
          { href: "https://github.com/aske312/project_403/blob/master/README.md", label: t.github },
          { href: "https://vk.com/aske312", label: t.vk },
          { href: "https://t.me/aske312", label: t.telegram },
        ]}
      />
    </div>
  );
}
