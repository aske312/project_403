import StatusPill from "./StatusPill";

export default function AdminAccessPanel({ t, env, backend }) {
  return (
    <main className="admin-layout">
      <section className="access-panel">
        <div>
          <p className="admin-eyebrow">{t.pageName}</p>
          <h1>{t.accessCheckingTitle}</h1>
          <p>{t.accessCheckingText}</p>
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
        </div>
      </section>
    </main>
  );
}
