import AdminStatusPanel from "./AdminStatusPanel";
import StatusPill from "./StatusPill";

export default function AdminServiceOverview({
  t,
  env,
  backend,
  serviceRows,
  children,
  onRefresh,
  refreshing,
}) {
  return (
    <>
      <section className="service-hero">
        <div>
          <p className="admin-eyebrow">{t.pageName}</p>
          <h1>{t.pageTitle}</h1>
          <p>{t.pageSubtitle}</p>
        </div>

        <AdminStatusPanel t={t} env={env} backend={backend} />
      </section>

      {children}

      <section className="services-section" aria-label={t.services}>
        <div className="section-head">
          <h2>{t.services}</h2>
          <div className="section-head-actions">
            <button
              aria-label={t.refreshAllServices}
              className="icon-button refresh-icon"
              disabled={refreshing}
              onClick={onRefresh}
              title={t.refreshAllServices}
              type="button"
            />
            <span>{serviceRows.length}</span>
          </div>
        </div>

        <div className="service-table">
          <div className="service-table-head">
            <span>{t.serviceColumn}</span>
            <span>{t.stack}</span>
            <span>{t.latency}</span>
            <span>{t.startupTime}</span>
          </div>

          {serviceRows.map((service) => (
            <div
              aria-label={`${service.name}: ${service.statusLabel}`}
              className={`service-row ${service.statusState}`}
              key={service.id}
              title={service.statusLabel}
            >
              <StatusPill state={service.state} label={service.name} />
              <ul>
                {service.stack.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <span className="service-metric">{service.latency}</span>
              <span className="service-metric">{service.startupTime}</span>
              <span className={`service-hover-state ${service.statusState}`}>
                {service.statusLabel}
              </span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
