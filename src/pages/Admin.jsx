import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import AdminAccessPanel from "../components/AdminAccessPanel";
import AdminApiSection from "../components/AdminApiSection";
import AdminLogsSection from "../components/AdminLogsSection";
import AdminServiceOverview from "../components/AdminServiceOverview";
import AppFooter from "../components/AppFooter";
import AppControls from "../components/AppControls";
import {
  checkDatabase,
  downloadLog,
  getFrontendMetrics,
  getHealth,
  getLogs,
} from "../utils/apiClient";
import { adminCopy } from "../utils/adminCopy";
import {
  buildServiceRows,
} from "../utils/adminData";
import { normalizeEnvironment } from "../utils/environment";
import { getFrontendPerformanceMetrics } from "../utils/performanceMetrics";
import {
  getNextLanguage,
  getNextTheme,
  getStoredLanguage,
  getStoredTheme,
  storeLanguage,
  storeTheme,
} from "../utils/themePreference";
import { getAccessToken, useAuthSession } from "../utils/useAuthSession";
import "../styles/admin.css";

const LOG_PAGE_SIZE = 10;

export default function Admin() {
  const [theme, setTheme] = useState(getStoredTheme);
  const [lang, setLang] = useState(getStoredLanguage);
  const [compactViewport, setCompactViewport] = useState(false);
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
  const env = normalizeEnvironment(backend?.environment || import.meta.env.MODE);
  const featureFlags = backend?.feature_flags || {};
  const adminAccessAllowed = Boolean(featureFlags.admin_panel);
  const accessReady = Boolean(backend) && profileLoaded;
  const adminServicesVisible = Boolean(featureFlags.admin_services);
  const adminApiVisible = Boolean(featureFlags.admin_api);
  const adminLogsVisible = Boolean(featureFlags.admin_logs);
  const canViewOnlineUsers = Boolean(featureFlags.footer_online_counter);

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
      const { payload, durationMs } = await getHealth(getAccessToken());
      setBackend({ ...payload, latency_ms: durationMs });
    } catch (error) {
      setBackend({ status: "error", error: error.message });
    } finally {
      setServiceLoading("backend", false);
    }
  }, [setServiceLoading]);

  const loadDatabase = useCallback(async () => {
    setServiceLoading("database", true);

    try {
      const { payload, durationMs } = await checkDatabase(getAccessToken());
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
      const { payload } = await getLogs(page, LOG_PAGE_SIZE, getAccessToken());
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
      if (adminServicesVisible) {
        loadDatabase();
      }
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    accessReady,
    adminAccessAllowed,
    adminApiVisible,
    adminServicesVisible,
    loadDatabase,
  ]);

  useEffect(() => {
    if (!accessReady || !adminAccessAllowed || !adminLogsVisible) return undefined;

    const timeoutId = window.setTimeout(() => {
      loadLogsPage(logPage);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [accessReady, adminAccessAllowed, adminLogsVisible, loadLogsPage, logPage]);

  useEffect(() => {
    function updateViewportMode() {
      const widthDelta = Math.max(window.outerWidth - window.innerWidth, 0);
      const heightDelta = Math.max(window.outerHeight - window.innerHeight, 0);
      setCompactViewport(widthDelta > 180 || heightDelta > 180);
    }

    updateViewportMode();
    window.addEventListener("resize", updateViewportMode);

    return () => {
      window.removeEventListener("resize", updateViewportMode);
    };
  }, []);

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
      const refreshTasks = [loadFrontend(), loadBackend()];
      if (adminServicesVisible) {
        refreshTasks.push(loadDatabase());
      }
      await Promise.all(refreshTasks);
    } finally {
      setRefreshingServices(false);
    }
  }

  async function handleDownloadLog(log) {
    const { response, payload } = await downloadLog(log.download_url, getAccessToken());
    if (!response.ok) {
      throw new Error(response.statusText || "Log download failed.");
    }

    const url = window.URL.createObjectURL(payload);
    const link = document.createElement("a");
    link.href = url;
    link.download = log.file;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

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
    <div className={`admin-page ${theme}${compactViewport ? " compact-viewport" : ""}`}>
      <AppControls
        theme={theme}
        lang={lang}
        t={t}
        profile={profile}
        accountOpen={accountOpen}
        onToggleAccount={() => setAccountOpen((value) => !value)}
        onToggleLang={() => setLang((current) => storeLanguage(getNextLanguage(current)))}
        onToggleTheme={() => setTheme((current) => storeTheme(getNextTheme(current)))}
        onLogout={logout}
        adminLinkVisible={adminAccessAllowed}
        adminLinkLabel={t.adminPanel}
      />

      {!accessReady ? (
        <AdminAccessPanel t={t} env={env} backend={backend} />
      ) : (
        <main className="admin-layout">
          {adminServicesVisible && (
            <AdminServiceOverview
              t={t}
              env={env}
              backend={backend}
              frontend={frontend}
              database={database}
              serviceRows={serviceRows}
              onRefresh={refreshServices}
              refreshing={refreshingServices}
>
            </AdminServiceOverview>
          )}
          {adminApiVisible && <AdminApiSection t={t} />}
          {adminLogsVisible && (
            <AdminLogsSection
              t={t}
              logs={logs}
              page={logMeta.page}
              pageSize={logMeta.pageSize}
              total={logMeta.total}
              totalPages={logMeta.totalPages}
              onPageChange={setLogPage}
              onRefresh={refreshLogs}
              onDownload={handleDownloadLog}
              refreshing={refreshingLogs}
            />
          )}
        </main>
      )}

      <AppFooter
        variant="admin"
        statusState={env.state}
        version={backend?.version || import.meta.env.VITE_APP_VERSION}
        onlineUsers={backend?.online_users}
        canViewOnlineUsers={canViewOnlineUsers}
links={[]}
      />
    </div>
  );
}
