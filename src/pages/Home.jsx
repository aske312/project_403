import { useMemo, useState } from "react";
import "../styles/home.css";

const copy = {
  RU: {
    brand: "Project_403",
    product: "\u041f\u0440\u0438\u0432\u0430\u0442\u043d\u044b\u0439 \u043c\u0435\u0441\u0441\u0435\u043d\u0434\u0436\u0435\u0440",
    login: "\u0412\u0445\u043e\u0434",
    register: "\u0420\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044f",
    titleLogin: "\u0412\u043e\u0439\u0434\u0438\u0442\u0435 \u0432 \u0430\u043a\u043a\u0430\u0443\u043d\u0442",
    titleRegister: "\u0421\u043e\u0437\u0434\u0430\u0439\u0442\u0435 \u0430\u043a\u043a\u0430\u0443\u043d\u0442",
    subtitle: "\u0411\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u044b\u0439 \u0434\u043e\u0441\u0442\u0443\u043f \u043a \u043b\u0438\u0447\u043d\u044b\u043c \u0434\u0438\u0430\u043b\u043e\u0433\u0430\u043c.",
    name: "\u0418\u043c\u044f",
    email: "Email",
    password: "\u041f\u0430\u0440\u043e\u043b\u044c",
    remember: "\u0417\u0430\u043f\u043e\u043c\u043d\u0438\u0442\u044c \u043c\u0435\u043d\u044f",
    forgot: "\u0417\u0430\u0431\u044b\u043b\u0438 \u043f\u0430\u0440\u043e\u043b\u044c?",
    submitLogin: "\u0412\u043e\u0439\u0442\u0438",
    submitRegister: "\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u0430\u043a\u043a\u0430\u0443\u043d\u0442",
    hintLogin: "\u041d\u0435\u0442 \u0430\u043a\u043a\u0430\u0443\u043d\u0442\u0430?",
    hintRegister: "\u0423\u0436\u0435 \u0435\u0441\u0442\u044c \u0430\u043a\u043a\u0430\u0443\u043d\u0442?",
    switchLogin: "\u0412\u043e\u0439\u0442\u0438",
    switchRegister: "\u0417\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043e\u0432\u0430\u0442\u044c\u0441\u044f",
    language: "EN",
    themeLight: "\u0421\u0432\u0435\u0442\u043b\u0430\u044f \u0442\u0435\u043c\u0430",
    themeDark: "\u0422\u0435\u043c\u043d\u0430\u044f \u0442\u0435\u043c\u0430",
    statusLogin: "\u0424\u043e\u0440\u043c\u0430 \u0433\u043e\u0442\u043e\u0432\u0430. \u041f\u043e\u0434\u043a\u043b\u044e\u0447\u0438\u0442\u0435 /auth/login, \u043a\u043e\u0433\u0434\u0430 backend \u0431\u0443\u0434\u0435\u0442 \u0440\u0435\u0430\u043b\u0438\u0437\u043e\u0432\u0430\u043d.",
    statusRegister: "\u0424\u043e\u0440\u043c\u0430 \u0433\u043e\u0442\u043e\u0432\u0430. \u041f\u043e\u0434\u043a\u043b\u044e\u0447\u0438\u0442\u0435 /auth/register, \u043a\u043e\u0433\u0434\u0430 backend \u0431\u0443\u0434\u0435\u0442 \u0440\u0435\u0430\u043b\u0438\u0437\u043e\u0432\u0430\u043d.",
    footerStatus: "\u041f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u0438\u0435 \u0432 \u0440\u0430\u0437\u0440\u0430\u0431\u043e\u0442\u043a\u0435",
    footerApi: "\u0421\u0442\u0430\u0442\u0443\u0441 API",
    github: "GitHub",
    vk: "VK",
    telegram: "Telegram",
    bullets: [
      "\u0411\u044b\u0441\u0442\u0440\u044b\u0439 \u0432\u0445\u043e\u0434 \u0432 \u043b\u0438\u0447\u043d\u044b\u0435 \u0447\u0430\u0442\u044b",
      "\u041c\u0438\u043d\u0438\u043c\u0443\u043c \u043b\u0438\u0448\u043d\u0438\u0445 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0439",
      "\u0413\u043e\u0442\u043e\u0432\u043e \u0434\u043b\u044f JWT \u0430\u0432\u0442\u043e\u0440\u0438\u0437\u0430\u0446\u0438\u0438",
    ],
  },
  EN: {
    brand: "Project_403",
    product: "Private messenger",
    login: "Sign in",
    register: "Create account",
    titleLogin: "Sign in to your account",
    titleRegister: "Create your account",
    subtitle: "Secure access to private conversations.",
    name: "Name",
    email: "Email",
    password: "Password",
    remember: "Remember me",
    forgot: "Forgot password?",
    submitLogin: "Sign in",
    submitRegister: "Create account",
    hintLogin: "No account yet?",
    hintRegister: "Already have an account?",
    switchLogin: "Sign in",
    switchRegister: "Create one",
    language: "RU",
    themeLight: "Light theme",
    themeDark: "Dark theme",
    statusLogin: "Form is ready. Connect /auth/login after the backend is implemented.",
    statusRegister: "Form is ready. Connect /auth/register after the backend is implemented.",
    footerStatus: "Application in development",
    footerApi: "API status",
    github: "GitHub",
    vk: "VK",
    telegram: "Telegram",
    bullets: [
      "Fast access to private chats",
      "No unnecessary steps",
      "Ready for JWT authorization",
    ],
  },
};

export default function Home() {
  const [theme, setTheme] = useState("dark");
  const [lang, setLang] = useState("RU");
  const [mode, setMode] = useState("login");
  const [status, setStatus] = useState("");

  const t = copy[lang];
  const isRegister = mode === "register";

  const initials = useMemo(
    () => t.brand.split("_").map((part) => part[0]).join(""),
    [t.brand],
  );

  const handleSubmit = (event) => {
    event.preventDefault();
    setStatus(isRegister ? t.statusRegister : t.statusLogin);
  };

  return (
    <div className={`auth-page ${theme}`}>
      <header className="auth-header">
        <div className="brand">
          <span className="brand-mark">{initials}</span>
          <span>{t.brand}</span>
        </div>

        <div className="header-actions">
          <button
            className="flag-switch"
            type="button"
            onClick={() => setLang(lang === "RU" ? "EN" : "RU")}
            aria-label={t.language}
            title={t.language}
          >
            <img src={lang === "RU" ? "/uk.png" : "/ru.png"} alt="" />
            <span>{t.language}</span>
          </button>

          <button
            className="text-btn"
            type="button"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            {theme === "light" ? t.themeDark : t.themeLight}
          </button>
        </div>
      </header>

      <main className="auth-shell">
        <section className="intro-panel" aria-label={t.product}>
          <div>
            <p className="eyebrow">{t.product}</p>
            <h1>{t.brand}</h1>
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

        <section className="auth-card">
          <div className="mode-tabs" role="tablist" aria-label="Auth mode">
            <button
              className={mode === "login" ? "active" : ""}
              type="button"
              onClick={() => setMode("login")}
            >
              {t.login}
            </button>
            <button
              className={mode === "register" ? "active" : ""}
              type="button"
              onClick={() => setMode("register")}
            >
              {t.register}
            </button>
          </div>

          <div className="form-heading">
            <h2>{isRegister ? t.titleRegister : t.titleLogin}</h2>
            <p>{t.subtitle}</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {isRegister && (
              <label>
                <span>{t.name}</span>
                <input name="name" type="text" autoComplete="name" required />
              </label>
            )}

            <label>
              <span>{t.email}</span>
              <input name="email" type="email" autoComplete="email" required />
            </label>

            <label>
              <span>{t.password}</span>
              <input
                name="password"
                type="password"
                autoComplete={isRegister ? "new-password" : "current-password"}
                minLength={6}
                required
              />
            </label>

            {!isRegister && (
              <div className="form-row">
                <label className="checkbox">
                  <input type="checkbox" />
                  <span>{t.remember}</span>
                </label>
                <button className="link-btn" type="button">
                  {t.forgot}
                </button>
              </div>
            )}

            <button className="primary-btn" type="submit">
              {isRegister ? t.submitRegister : t.submitLogin}
            </button>
          </form>

          {status && <div className="status-note">{status}</div>}

          <p className="switch-note">
            {isRegister ? t.hintRegister : t.hintLogin}{" "}
            <button
              className="link-btn"
              type="button"
              onClick={() => setMode(isRegister ? "login" : "register")}
            >
              {isRegister ? t.switchLogin : t.switchRegister}
            </button>
          </p>
        </section>
      </main>

      <footer className="auth-footer">
        <div className="footer-status">
          <span className="status-dot" aria-hidden="true" />
          <span>{t.footerStatus}</span>
        </div>

        <nav className="footer-links" aria-label="Footer">
          <a href="/debug">{t.footerApi}</a>
          <a href="https://github.com/aske312/project_403/blob/master/README.md">{t.github}</a>
          <a href="https://vk.com/aske312">{t.vk}</a>
          <a href="https://t.me/aske312">{t.telegram}</a>
        </nav>
      </footer>
    </div>
  );
}
