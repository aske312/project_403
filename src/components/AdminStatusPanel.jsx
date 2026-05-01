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

export default function AdminStatusPanel({ t, env, backend }) {
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
        <strong>{formatRuntime(backend?.total_runtime_ms, t.checking)}</strong>
      </div>
    </div>
  );
}
