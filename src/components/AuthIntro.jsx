const authHighlights = [
  { title: "Чаты", text: "Личные диалоги и рабочие каналы в одном пространстве." },
  { title: "DEV режим", text: "Быстрый вход в тестовые роли supervisor / user для проверки сценариев." },
  { title: "Контроль", text: "Feature toggles позволяют постепенно включать новые части продукта." },
];

export default function AuthIntro({ t, projectName }) {
  return (
    <section className="intro-panel auth-gateway" aria-label={t.product}>
      <div className="auth-gateway-copy">
        <p className="eyebrow">{t.product}</p>
        <h1>{projectName}</h1>
        <p className="lead">
          Спокойная точка входа в рабочий мессенджер: авторизация, DEV-пользователи,
          чаты и администрирование сборки без лишнего шума на первом экране.
        </p>
      </div>

      <div className="auth-gateway-card" aria-hidden="true">
        <div className="gateway-sidebar">
          <span />
          <span />
          <span />
        </div>
        <div className="gateway-chat">
          <div className="gateway-chat-top" />
          <div className="gateway-message peer" />
          <div className="gateway-message self" />
          <div className="gateway-message peer short" />
          <div className="gateway-input" />
        </div>
      </div>

      <div className="auth-highlight-grid">
        {authHighlights.map((item) => (
          <article key={item.title}>
            <strong>{item.title}</strong>
            <span>{item.text}</span>
          </article>
        ))}
      </div>
    </section>
  );
}
