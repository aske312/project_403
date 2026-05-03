import StatusPill from "./StatusPill";

function formatRuntime(value, fallback) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }

  const totalSeconds = Math.floor(value / 1000);
  if (totalSeconds <= 0) return "0 s";

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [];

  if (days > 0) parts.push(`${days} d`);
  if (hours > 0) parts.push(`${hours} h`);
  if (minutes > 0 && parts.length < 2) parts.push(`${minutes} min`);
  if (parts.length === 0) parts.push(`${seconds} s`);

  return parts.slice(0, 2).join(" ");
}

function formatDuration(value, fallback) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }

  if (value <= 0) return "0 ms";
  if (value < 1) return "<1 ms";
  if (value < 1000) return `${Math.round(value)} ms`;
  if (value < 60000) {
    const seconds = value / 1000;
    return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)} s`;
  }

  const minutes = value / 60000;
  return `${minutes < 10 ? minutes.toFixed(1) : Math.round(minutes)} min`;
}

function getProjectBuildMs(frontend, backend, database) {
  const values = [frontend?.startup_ms, backend?.startup_ms, database?.startup_ms]
    .filter((value) => typeof value === "number" && Number.isFinite(value));

  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0);
}

export default function AdminStatusPanel({ t, env, backend, frontend, database }) {
  const projectBuildMs = getProjectBuildMs(frontend, backend, database);

  return (
    <div className="status-panel">
      <div className="status-panel-head">
        <span>{t.projectState}</span>
        <StatusPill state={env.state} label={env.label} />
      </div>
      <div className="status-version">
        <span>{t.buildVersion}</span>
        <strong>{backend?.version || import.meta.env.VITE_APP_VERSION}</strong>
      </div>
      <div className="status-version">
        <span>{t.totalRuntime}</span>
        <strong>{formatRuntime(backend?.current_runtime_ms, t.checking)}</strong>
      </div>
      <div className="status-version">
        <span>{t.buildTime}</span>
        <strong>{formatDuration(projectBuildMs, t.notMeasured)}</strong>
      </div>
    </div>
  );
}
