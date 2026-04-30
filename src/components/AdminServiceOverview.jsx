import StatusPill from "./StatusPill";

export default function AdminServiceOverview({ t, env, backend, serviceRows }) {
  return (
    <>
      <section className="service-hero">
        <div>
          <p className="admin-eyebrow">{t.pageName}</p>
          <h1>{t.pageTitle}</h1>
          <p>{t.pageSubtitle}</p>
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

      <section className="services-section" aria-label={t.services}>
        <div className="section-head">
          <h2>{t.services}</h2>
          <span>{serviceRows.length}</span>
        </div>

        <div className="service-table">
          <div className="service-table-head">
            <span>{t.serviceColumn}</span>
            <span>{t.stack}</span>
            <span>{t.latency}</span>
            <span>{t.startupTime}</span>
          </div>

          {serviceRows.map((service) => (
            <div className="service-row" key={service.id}>
              <StatusPill state={service.state} label={service.name} />
              <ul>
                {service.stack.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <span className="service-metric">{service.latency}</span>
              <span className="service-metric">{service.startupTime}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
