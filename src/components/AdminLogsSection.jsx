function formatBytes(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatLogTime(value) {
  return new Date(value * 1000).toLocaleString();
}

export default function AdminLogsSection({
  t,
  logs,
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onRefresh,
  onDownload,
  refreshing,
}) {
  const firstItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastItem = total === 0 ? 0 : firstItem + logs.length - 1;

  return (
    <section className="logs-section" aria-label={t.logs}>
      <div className="section-head">
        <h2>{t.logs}</h2>
        <div className="section-head-actions">
          <button
            aria-label={t.commandRefreshLogs}
            className="icon-button refresh-icon"
            disabled={refreshing}
            onClick={onRefresh}
            title={t.commandRefreshLogs}
            type="button"
          />
          <span>{total}</span>
        </div>
      </div>

      <div className="log-list">
        {logs.length === 0 ? (
          <div className="empty-log-list">{t.noLogs}</div>
        ) : (
          logs.map((log) => (
            <div className="log-row" key={`${log.date}-${log.file}`}>
              <div>
                <strong>{log.file}</strong>
                <span>{log.resource} / {formatLogTime(log.updated_at)}</span>
              </div>
              <span>{formatBytes(log.size)}</span>
              <button type="button" onClick={() => onDownload(log)}>
                {t.download}
              </button>
            </div>
          ))
        )}
      </div>

      {total > 0 && (
        <div className="logs-pagination" aria-label={`${t.logs} ${t.logsPage}`}>
          <span className="logs-pagination-status">
            {firstItem}-{lastItem} {t.paginationOf} {total}
          </span>
          {totalPages > 1 && (
            <div className="logs-pagination-controls">
              <button
                type="button"
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1}
              >
                {t.paginationPrevious}
              </button>
              <span className="logs-pagination-page">
                {t.logsPage} {page} {t.paginationOf} {totalPages}
              </span>
              <button
                type="button"
                onClick={() => onPageChange(page + 1)}
                disabled={page >= totalPages}
              >
                {t.paginationNext}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
