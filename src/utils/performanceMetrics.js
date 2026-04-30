const FRONTEND_METRICS_KEY = "__PROJECT_403_FRONTEND_METRICS__";
const moduleStartedAt = performance.now();

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function markFrontendReady() {
  if (globalThis[FRONTEND_METRICS_KEY]) return;

  const readyAt = performance.now();
  globalThis[FRONTEND_METRICS_KEY] = {
    startup_ms: readyAt,
    bootstrap_ms: readyAt - moduleStartedAt,
  };
}

export function getFrontendPerformanceMetrics() {
  const navigation = performance.getEntriesByType("navigation")[0];
  const requestStart = finiteNumber(navigation?.requestStart);
  const responseEnd = finiteNumber(navigation?.responseEnd);
  const markedStartup = finiteNumber(globalThis[FRONTEND_METRICS_KEY]?.startup_ms);
  const domReady = finiteNumber(navigation?.domContentLoadedEventEnd);

  return {
    status: "ok",
    latency_ms:
      requestStart !== null && responseEnd !== null && responseEnd >= requestStart
        ? responseEnd - requestStart
        : null,
    startup_ms: markedStartup ?? domReady,
  };
}
