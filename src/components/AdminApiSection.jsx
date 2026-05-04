import { API_URL } from "../utils/apiClient";

export default function AdminApiSection({ t }) {
  const swaggerUrl = `${API_URL}/docs`;
  const openApiUrl = `${API_URL}/openapi.json`;

  return (
    <section className="api-section" aria-label={t.apiSurface}>
      <div className="section-head">
        <div>
          <h2>{t.apiSurface}</h2>
          <p className="section-note">
            Кастомный API-конструктор убран: используем штатный Swagger UI FastAPI, чтобы не дублировать OpenAPI-логику.
          </p>
        </div>
        <a className="swagger-open-link" href={swaggerUrl} target="_blank" rel="noreferrer">
          Swagger
        </a>
      </div>

      <div className="swagger-panel">
        <iframe title="Swagger OpenAPI" src={swaggerUrl} loading="lazy" />
      </div>

      <div className="swagger-links">
        <a href={swaggerUrl} target="_blank" rel="noreferrer">Открыть Swagger в новой вкладке</a>
        <a href={openApiUrl} target="_blank" rel="noreferrer">OpenAPI JSON</a>
      </div>
    </section>
  );
}
