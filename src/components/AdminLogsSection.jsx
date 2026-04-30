function formatBytes(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatLogTime(value) {
  return new Date(value * 1000).toLocaleString();
}

export default function AdminLogsSection({ t, logs, apiUrl }) {
  return (
    <section className="logs-section" aria-label={t.logs}>
      <div className="section-head">
        <h2>{t.logs}</h2>
        <span>{logs.length}</span>
      </div>

      <div className="log-list">
        {logs.length === 0 ? (
          <div className="empty-log-list">{t.noLogs}</div>
        ) : (
          logs.map((log) => (
            <div className="log-row" key={`${log.date}-${log.file}`}>
              <div>
                <strong>{log.file}</strong>
                <span>{log.resource} В· {formatLogTime(log.updated_at)}</span>
              </div>
              <span>{formatBytes(log.size)}</span>
              <a href={`${apiUrl}${log.download_url}`} download>
                {t.download}
              </a>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
