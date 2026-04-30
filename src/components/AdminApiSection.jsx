import Endpoint from "./Endpoint";

export default function AdminApiSection({ t, endpoints }) {
  return (
    <section className="api-section" aria-label={t.apiSurface}>
      <div className="section-head">
        <h2>{t.apiSurface}</h2>
        <span>{endpoints.length}</span>
      </div>

      <div className="endpoint-stack">
        {endpoints.map((endpoint) => (
          <Endpoint
            key={`${endpoint.method}-${endpoint.path}`}
            method={endpoint.method}
            path={endpoint.path}
          />
        ))}
      </div>
    </section>
  );
}
