export default function AuthIntro({ t, projectName }) {
  return (
    <section className="intro-panel" aria-label={t.product}>
      <div>
        <p className="eyebrow">{t.product}</p>
        <h1>{projectName}</h1>
        <p className="lead">{t.subtitle}</p>
      </div>

      <ul className="feature-list">
        {t.bullets.map((item) => (
          <li key={item}>
            <span className="check" aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
