import { useEffect, useMemo, useState } from "react";
import "../styles/home.css";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const copy = {
  RU: {
    brand: "Project_403",
    product: "\u041f\u0440\u0438\u0432\u0430\u0442\u043d\u044b\u0439 \u043c\u0435\u0441\u0441\u0435\u043d\u0434\u0436\u0435\u0440",
    login: "\u0412\u0445\u043e\u0434",
    register: "\u0420\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044f",
    titleLogin: "\u0412\u0445\u043e\u0434 \u043f\u043e email \u0438\u043b\u0438 \u043b\u043e\u0433\u0438\u043d\u0443",
    titleRegister: "\u041d\u043e\u0432\u044b\u0439 \u0430\u043a\u043a\u0430\u0443\u043d\u0442",
    subtitle: "\u0411\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u044b\u0439 \u0434\u043e\u0441\u0442\u0443\u043f \u043a \u043b\u0438\u0447\u043d\u044b\u043c \u0434\u0438\u0430\u043b\u043e\u0433\u0430\u043c.",
    formHintLogin: "\u041b\u043e\u0433\u0438\u043d - \u044d\u0442\u043e email \u0438\u043b\u0438 \u0442\u0435\u0433 \u0432\u0438\u0434\u0430 @ivan_petrov_94cf34.",
    formHintRegister: "\u0422\u0435\u0433-\u043b\u043e\u0433\u0438\u043d \u0441\u043e\u0437\u0434\u0430\u0441\u0442\u0441\u044f \u0430\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u0438 \u043f\u043e\u0441\u043b\u0435 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0438.",
    firstName: "\u0418\u043c\u044f",
    lastName: "\u0424\u0430\u043c\u0438\u043b\u0438\u044f",
    optional: "\u043d\u0435 \u043e\u0431\u044f\u0437\u0430\u0442\u0435\u043b\u044c\u043d\u043e",
    loginField: "\u041b\u043e\u0433\u0438\u043d",
    email: "Email",
    password: "\u041f\u0430\u0440\u043e\u043b\u044c",
    nameHint: "\u0422\u043e\u043b\u044c\u043a\u043e \u0431\u0443\u043a\u0432\u044b \u0438 \u0434\u0435\u0444\u0438\u0441, \u0434\u043e 40 \u0441\u0438\u043c\u0432\u043e\u043b\u043e\u0432",
    passwordHint: "\u041c\u0438\u043d\u0438\u043c\u0443\u043c 8 \u0441\u0438\u043c\u0432\u043e\u043b\u043e\u0432, \u0431\u0443\u043a\u0432\u0430 \u0438 \u0446\u0438\u0444\u0440\u0430",
    loginHint: "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 email \u0438\u043b\u0438 \u0442\u0435\u0433-\u043b\u043e\u0433\u0438\u043d",
    firstNameExample: "\u041d\u0430\u043f\u0440\u0438\u043c\u0435\u0440: \u0418\u0432\u0430\u043d",
    lastNameExample: "\u041d\u0430\u043f\u0440\u0438\u043c\u0435\u0440: \u041f\u0435\u0442\u0440\u043e\u0432",
    emailExample: "\u041d\u0430\u043f\u0440\u0438\u043c\u0435\u0440: user@example.com",
    loginExample: "\u041d\u0430\u043f\u0440\u0438\u043c\u0435\u0440: user@example.com \u0438\u043b\u0438 @ivan_petrov_94cf34",
    passwordExample: "\u041d\u0430\u043f\u0440\u0438\u043c\u0435\u0440: secret123",
    remember: "\u0417\u0430\u043f\u043e\u043c\u043d\u0438\u0442\u044c \u043c\u0435\u043d\u044f",
    forgot: "\u0417\u0430\u0431\u044b\u043b\u0438 \u043f\u0430\u0440\u043e\u043b\u044c?",
    submitLogin: "\u0412\u043e\u0439\u0442\u0438",
    submitRegister: "\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u0430\u043a\u043a\u0430\u0443\u043d\u0442",
    hintLogin: "\u041d\u0435\u0442 \u0430\u043a\u043a\u0430\u0443\u043d\u0442\u0430?",
    hintRegister: "\u0423\u0436\u0435 \u0435\u0441\u0442\u044c \u0430\u043a\u043a\u0430\u0443\u043d\u0442?",
    switchLogin: "\u0412\u043e\u0439\u0442\u0438",
    switchRegister: "\u0417\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044f",
    language: "EN",
    themeLight: "\u0421\u0432\u0435\u0442\u043b\u0430\u044f \u0442\u0435\u043c\u0430",
    themeDark: "\u0422\u0435\u043c\u043d\u0430\u044f \u0442\u0435\u043c\u0430",
    accountMenu: "\u0410\u043a\u043a\u0430\u0443\u043d\u0442",
    accountStub: "\u041c\u0435\u043d\u044e \u0430\u043a\u043a\u0430\u0443\u043d\u0442\u0430 \u0431\u0443\u0434\u0435\u0442 \u0434\u043e\u0431\u0430\u0432\u043b\u0435\u043d\u043e \u043f\u043e\u0437\u0436\u0435.",
    userTag: "\u0422\u0435\u0433",
    footerStatus: "\u041f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u0438\u0435 \u0432 \u0440\u0430\u0437\u0440\u0430\u0431\u043e\u0442\u043a\u0435",
    footerApi: "\u0410\u0434\u043c\u0438\u043d-\u043f\u0430\u043d\u0435\u043b\u044c",
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
    titleLogin: "Sign in by email or login",
    titleRegister: "New account",
    subtitle: "Secure access to private conversations.",
    formHintLogin: "Login is an email or user tag like @ivan_petrov_94cf34.",
    formHintRegister: "A tag-login will be generated automatically after registration.",
    firstName: "First name",
    lastName: "Last name",
    optional: "optional",
    loginField: "Login",
    email: "Email",
    password: "Password",
    nameHint: "Letters and hyphen only, up to 40 characters",
    passwordHint: "At least 8 characters, one letter and one digit",
    loginHint: "Use email or user tag",
    firstNameExample: "Example: Ivan",
    lastNameExample: "Example: Petrov",
    emailExample: "Example: user@example.com",
    loginExample: "Example: user@example.com or @ivan_petrov_94cf34",
    passwordExample: "Example: secret123",
    remember: "Remember me",
    forgot: "Forgot password?",
    submitLogin: "Sign in",
    submitRegister: "Create account",
    hintLogin: "No account yet?",
    hintRegister: "Already have an account?",
    switchLogin: "Sign in",
    switchRegister: "Create account",
    language: "RU",
    themeLight: "Light theme",
    themeDark: "Dark theme",
    accountMenu: "Account",
    accountStub: "Account menu will be added later.",
    userTag: "Tag",
    footerStatus: "Application in development",
    footerApi: "Admin panel",
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

function sanitizePersonName(value) {
  return value.replace(/[^A-Za-z\u0400-\u04FF-]/g, "").slice(0, 40);
}

export default function Home() {
  const [theme, setTheme] = useState("dark");
  const [lang, setLang] = useState("RU");
  const [mode, setMode] = useState("login");
  const [status, setStatus] = useState("");
  const [projectName, setProjectName] = useState(import.meta.env.VITE_APP_NAME || "Project_403");
  const [profile, setProfile] = useState(null);
  const [accountOpen, setAccountOpen] = useState(false);

  const t = copy[lang];
  const isRegister = mode === "register";

  const initials = useMemo(
    () => projectName.split("_").map((part) => part[0]).join(""),
    [projectName],
  );

  useEffect(() => {
    let ignore = false;

    async function loadProjectName() {
      try {
        const response = await fetch(`${API_URL}/api/admin/health`);
        const payload = await response.json();
        if (!ignore && payload.app) {
          setProjectName(payload.app);
        }
      } catch {
        if (!ignore) {
          setProjectName(import.meta.env.VITE_APP_NAME || "Project_403");
        }
      }
    }

    async function loadProfile() {
      const token = window.localStorage.getItem("access_token");
      if (!token) return;

      try {
        const response = await fetch(`${API_URL}/api/users/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          window.localStorage.removeItem("access_token");
          return;
        }

        const payload = await response.json();
        if (!ignore) {
          setProfile(payload);
        }
      } catch {
        if (!ignore) {
          setProfile(null);
        }
      }
    }

    loadProjectName();
    loadProfile();

    return () => {
      ignore = true;
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = {
      [isRegister ? "email" : "login"]: String(formData.get(isRegister ? "email" : "login") || ""),
      password: String(formData.get("password") || ""),
    };

    if (isRegister) {
      payload.first_name = String(formData.get("first_name") || "");
      payload.last_name = String(formData.get("last_name") || "");
    }

    try {
      const response = await fetch(`${API_URL}${isRegister ? "/api/auth/register" : "/api/auth/login"}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok) {
        setStatus(result.detail || "Request failed");
        return;
      }

      if (isRegister) {
        const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            login: payload.email,
            password: payload.password,
          }),
        });
        const loginResult = await loginResponse.json();

        if (!loginResponse.ok) {
          setProfile(null);
          setAccountOpen(false);
          setStatus(loginResult.detail || "Login after registration failed");
          return;
        }

        window.localStorage.setItem("access_token", loginResult.access_token);
        setProfile(loginResult.user);
        setStatus("");
        setMode("login");
        return;
      }

      window.localStorage.setItem("access_token", result.access_token);
      setProfile(result.user);
      setStatus("");
    } catch (error) {
      setStatus(error.message);
    }
  };

  return (
    <div className={`auth-page ${theme}`}>
      <header className="auth-header">
        <div className="brand">
          <span className="brand-mark">{initials}</span>
          <span>{projectName}</span>
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

          {profile && (
            <div className="account-menu">
              <button
                className="account-button"
                type="button"
                onClick={() => setAccountOpen((value) => !value)}
                aria-expanded={accountOpen}
                aria-haspopup="menu"
              >
                <span className="account-avatar" aria-hidden="true">
                  {profile.name?.[0]?.toUpperCase() || "U"}
                </span>
                <span className="account-label">{profile.tag || profile.handle || profile.name}</span>
              </button>

              {accountOpen && (
                <div className="account-dropdown" role="menu">
                  <div className="account-name">{profile.name}</div>
                  <div className="account-meta">{profile.email}</div>
                  <div className="account-meta">
                    {t.userTag}: {profile.tag || `@${profile.handle}`}
                  </div>
                  <div className="account-stub">{t.accountStub}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="auth-shell">
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
            <p>{isRegister ? t.formHintRegister : t.formHintLogin}</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {isRegister && (
              <>
                <label>
                  <span>{t.firstName}</span>
                  <input
                    name="first_name"
                    type="text"
                    placeholder="Ivan"
                    autoComplete="given-name"
                    minLength={1}
                    maxLength={40}
                    pattern="[A-Za-z\u0400-\u04FF-]{1,40}"
                    title={t.nameHint}
                    onInput={(event) => {
                      event.currentTarget.value = sanitizePersonName(event.currentTarget.value);
                    }}
                    required
                  />
                  <small>{t.firstNameExample}</small>
                </label>

                <label>
                  <span>
                    {t.lastName} <small>{t.optional}</small>
                  </span>
                  <input
                    name="last_name"
                    type="text"
                    placeholder="Petrov"
                    autoComplete="family-name"
                    maxLength={40}
                    pattern="[A-Za-z\u0400-\u04FF-]{0,40}"
                    title={t.nameHint}
                    onInput={(event) => {
                      event.currentTarget.value = sanitizePersonName(event.currentTarget.value);
                    }}
                  />
                  <small>{t.lastNameExample}</small>
                </label>
              </>
            )}

            {isRegister ? (
              <label>
                <span>{t.email}</span>
                <input
                  name="email"
                  type="email"
                  placeholder="user@example.com"
                  autoComplete="email"
                  minLength={3}
                  maxLength={255}
                  required
                />
                <small>{t.emailExample}</small>
              </label>
            ) : (
              <label>
                <span>{t.loginField}</span>
                <input
                  name="login"
                  type="text"
                  placeholder="@ivan_petrov_94cf34"
                  autoComplete="username"
                  minLength={3}
                  maxLength={255}
                  title={t.loginHint}
                  required
                />
                <small>{t.loginExample}</small>
              </label>
            )}

            <label>
              <span>{t.password}</span>
              <input
                name="password"
                type="password"
                placeholder="secret123"
                autoComplete={isRegister ? "new-password" : "current-password"}
                minLength={8}
                maxLength={128}
                pattern="(?=.*[A-Za-z\u0400-\u04FF])(?=.*\d).{8,128}"
                title={t.passwordHint}
                required
              />
              <small>{t.passwordExample}</small>
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
          <a href="/admin">{t.footerApi}</a>
          <a href="https://github.com/aske312/project_403/blob/master/README.md">{t.github}</a>
          <a href="https://vk.com/aske312">{t.vk}</a>
          <a href="https://t.me/aske312">{t.telegram}</a>
        </nav>
      </footer>
    </div>
  );
}
