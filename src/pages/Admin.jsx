import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import AdminAccessPanel from "../components/AdminAccessPanel";
import AdminApiSection from "../components/AdminApiSection";
import AdminCommandsSection from "../components/AdminCommandsSection";
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
  runAdminCommand,
} from "../utils/apiClient";
import { adminCopy } from "../utils/adminCopy";
import {
  buildEndpointsFromOpenApi,
  buildServiceRows,
  fallbackEndpoints,
} from "../utils/adminData";
import { canUseAdminPanel, normalizeEnvironment } from "../utils/environment";
import { getFrontendPerformanceMetrics } from "../utils/performanceMetrics";
import { getAccessToken, useAuthSession } from "../utils/useAuthSession";
import "../styles/admin.css";

const LOG_PAGE_SIZE = 10;

export default function Admin() {
  const [theme, setTheme] = useState("dark");
  const [lang, setLang] = useState("RU");
  const [endpoints, setEndpoints] = useState(fallbackEndpoints);
  const [frontend, setFrontend] = useState(null);
  const [backend, setBackend] = useState(null);
  const [database, setDatabase] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logPage, setLogPage] = useState(1);
  const [logMeta, setLogMeta] = useState({
    page: 1,
    pageSize: LOG_PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [commandBusy, setCommandBusy] = useState(null);
  const [commandFeedback, setCommandFeedback] = useState(null);
  const [refreshingLogs, setRefreshingLogs] = useState(false);
  const [refreshingServices, setRefreshingServices] = useState(false);
  const [loadingServices, setLoadingServices] = useState({
    frontend: false,
    backend: false,
    database: false,
  });
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

  const setServiceLoading = useCallback((serviceId, loading) => {
    setLoadingServices((current) => ({
      ...current,
      [serviceId]: loading,
    }));
  }, []);

  const loadFrontend = useCallback(async () => {
    setServiceLoading("frontend", true);
    const browserMetrics = getFrontendPerformanceMetrics();

    try {
      const { payload, durationMs } = await getFrontendMetrics();
      setFrontend({
        ...payload,
        latency_ms: durationMs,
        startup_ms: payload.startup_ms ?? browserMetrics.startup_ms,
      });
    } catch {
      setFrontend(browserMetrics);
    } finally {
      setServiceLoading("frontend", false);
    }
  }, [setServiceLoading]);

  const loadBackend = useCallback(async () => {
    setServiceLoading("backend", true);

    try {
      const { payload, durationMs } = await getHealth();
      setBackend({ ...payload, latency_ms: durationMs });
    } catch (error) {
      setBackend({ status: "error", error: error.message });
    } finally {
      setServiceLoading("backend", false);
    }
  }, [setServiceLoading]);

  const loadOpenApi = useCallback(async () => {
    try {
      const schema = await getOpenApi();
      const nextEndpoints = buildEndpointsFromOpenApi(schema);

      if (nextEndpoints.length > 0) {
        setEndpoints(nextEndpoints);
      }
    } catch {
      setEndpoints(fallbackEndpoints);
    }
  }, []);

  const loadDatabase = useCallback(async () => {
    setServiceLoading("database", true);

    try {
      const { payload, durationMs } = await checkDatabase();
      setDatabase({
        ...payload,
        request_latency_ms: durationMs,
        latency_ms: payload.latency_ms ?? durationMs,
      });
    } catch (error) {
      setDatabase({ status: "error", error: error.message });
    } finally {
      setServiceLoading("database", false);
    }
  }, [setServiceLoading]);

  const loadLogsPage = useCallback(async (page = logPage) => {
    try {
      const { payload } = await getLogs(page, LOG_PAGE_SIZE);
      const nextLogs = payload.logs || [];
      const nextPage = payload.page ?? 1;
      const nextTotalPages = Math.max(payload.total_pages ?? 1, 1);

      setLogs(nextLogs);
      setLogMeta({
        page: nextPage,
        pageSize: payload.page_size ?? LOG_PAGE_SIZE,
        total: payload.total ?? nextLogs.length,
        totalPages: nextTotalPages,
      });

      if (nextPage !== page) {
        setLogPage(nextPage);
      }
    } catch {
      setLogs([]);
      setLogMeta({
        page: 1,
        pageSize: LOG_PAGE_SIZE,
        total: 0,
        totalPages: 1,
      });
      setLogPage(1);
    }
  }, [logPage]);

  useEffect(() => {
    const frameId = requestAnimationFrame(loadFrontend);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [loadFrontend]);

  useEffect(() => {
    const timeoutId = window.setTimeout(loadBackend, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadBackend]);

  useEffect(() => {
    if (!accessReady || !adminAccessAllowed) return undefined;

    const timeoutId = window.setTimeout(() => {
      loadOpenApi();
      loadDatabase();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [accessReady, adminAccessAllowed, loadDatabase, loadOpenApi]);

  useEffect(() => {
    if (!accessReady || !adminAccessAllowed) return undefined;

    const timeoutId = window.setTimeout(() => {
      loadLogsPage(logPage);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [accessReady, adminAccessAllowed, loadLogsPage, logPage]);

  async function runRestartCommand(commandId) {
    if (!window.confirm(t.commandConfirmRestart)) {
      return;
    }

    setCommandBusy(commandId);
    setCommandFeedback(null);

    try {
      const { payload, response } = await runAdminCommand(commandId, getAccessToken());
      if (!response.ok) {
        throw new Error(payload.detail || payload.message || response.statusText);
      }

      setCommandFeedback({ state: "ok", text: t.commandQueued });
    } catch (error) {
      setCommandFeedback({
        state: "error",
        text: `${t.commandFailed}: ${error.message}`,
      });
    } finally {
      setCommandBusy(null);
    }
  }

  async function refreshLogs() {
    setRefreshingLogs(true);

    try {
      await loadLogsPage(logMeta.page);
    } finally {
      setRefreshingLogs(false);
    }
  }

  async function refreshServices() {
    setRefreshingServices(true);

    try {
      await Promise.all([loadFrontend(), loadBackend(), loadDatabase()]);
    } finally {
      setRefreshingServices(false);
    }
  }

  const restartOptions = [
    {
      id: "restart_project",
      label: t.commandRestartProject,
    },
    {
      id: "restart_backend",
      label: t.commandRestartBackend,
    },
    {
      id: "restart_frontend",
      label: t.commandRestartFrontend,
    },
  ];

  const serviceRows = useMemo(
    () => {
      const nextFrontend = loadingServices.frontend
        ? { ...(frontend || {}), status: "loading" }
        : frontend;
      const nextBackend = loadingServices.backend
        ? { ...(backend || {}), status: "loading" }
        : backend;
      const nextDatabase = loadingServices.database
        ? { ...(database || {}), status: "loading" }
        : database;

      return buildServiceRows(t, nextFrontend, nextBackend, nextDatabase);
    },
    [backend, database, frontend, loadingServices, t],
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
            onRefresh={refreshServices}
            refreshing={refreshingServices}
          >
            <AdminCommandsSection
              t={t}
              feedback={commandFeedback}
              restartOptions={restartOptions}
              restartBusy={commandBusy}
              onRestart={runRestartCommand}
            />
          </AdminServiceOverview>
          <AdminApiSection t={t} endpoints={endpoints} />
          <AdminLogsSection
            t={t}
            logs={logs}
            apiUrl={API_URL}
            page={logMeta.page}
            pageSize={logMeta.pageSize}
            total={logMeta.total}
            totalPages={logMeta.totalPages}
            onPageChange={setLogPage}
            onRefresh={refreshLogs}
            refreshing={refreshingLogs}
          />
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
