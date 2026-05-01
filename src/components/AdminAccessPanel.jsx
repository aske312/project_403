import AdminStatusPanel from "./AdminStatusPanel";

export default function AdminAccessPanel({ t, env, backend }) {
  return (
    <main className="admin-layout">
      <section className="access-panel">
        <div>
          <p className="admin-eyebrow">{t.pageName}</p>
          <h1>{t.accessCheckingTitle}</h1>
          <p>{t.accessCheckingText}</p>
        </div>

        <AdminStatusPanel t={t} env={env} backend={backend} />
      </section>
    </main>
  );
}
