import { groupEndpointsByService } from "../utils/adminData";
import Endpoint from "./Endpoint";

export default function AdminApiSection({ t, endpoints, token }) {
  const groups = groupEndpointsByService(endpoints);

  return (
    <section className="api-section" aria-label={t.apiSurface}>
      <div className="section-head">
        <div>
          <h2>{t.apiSurface}</h2>
          <p className="section-note">API группируется по сервисам автоматически из OpenAPI.</p>
        </div>
        <span>{endpoints.length}</span>
      </div>

      <div className="api-service-stack">
        {groups.map((group) => (
          <article className="api-service-group" key={group.service}>
            <div className="api-service-title">
              <h3>{group.title}</h3>
              <span>{group.endpoints.length}</span>
            </div>
            <div className="endpoint-stack">
              {group.endpoints.map((endpoint) => (
                <Endpoint
                  key={`${endpoint.method}-${endpoint.path}`}
                  endpoint={endpoint}
                  token={token}
                />
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
