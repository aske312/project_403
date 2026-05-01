import { useState } from "react";

function sanitizePersonName(value) {
  return value.replace(/[^A-Za-z\u0400-\u04FF-]/g, "").slice(0, 40);
}

export default function AuthForm({ t, mode, status, onModeChange, onSubmit }) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const isRegister = mode === "register";
  const passwordToggleLabel = passwordVisible ? t.hidePassword : t.showPassword;

  return (
    <section className="auth-card" aria-labelledby="auth-form-title">
      <div className="auth-card-top">
        <div>
          <p className="auth-kicker">{isRegister ? t.register : t.login}</p>
          <h2 id="auth-form-title">{isRegister ? t.titleRegister : t.titleLogin}</h2>
        </div>
      </div>

      <div className="mode-tabs" role="tablist" aria-label={t.authMode}>
        <button
          className={mode === "login" ? "active" : ""}
          type="button"
          onClick={() => onModeChange("login")}
        >
          {t.login}
        </button>
        <button
          className={mode === "register" ? "active" : ""}
          type="button"
          onClick={() => onModeChange("register")}
        >
          {t.register}
        </button>
      </div>

      <form className="auth-form" onSubmit={onSubmit}>
        {isRegister && (
          <div className="field-grid">
            <label className="auth-field">
              <span>{t.firstName}</span>
              <input
                name="first_name"
                type="text"
                placeholder={t.firstNamePlaceholder}
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
            </label>

            <label className="auth-field">
              <span className="field-label">
                {t.lastName} <span className="field-optional">{t.optional}</span>
              </span>
              <input
                name="last_name"
                type="text"
                placeholder={t.lastNamePlaceholder}
                autoComplete="family-name"
                maxLength={40}
                pattern="[A-Za-z\u0400-\u04FF-]{0,40}"
                title={t.nameHint}
                onInput={(event) => {
                  event.currentTarget.value = sanitizePersonName(event.currentTarget.value);
                }}
              />
            </label>
          </div>
        )}

        {isRegister ? (
          <label className="auth-field">
            <span>{t.email}</span>
            <input
              name="email"
              type="email"
              placeholder={t.emailPlaceholder}
              autoComplete="email"
              minLength={3}
              maxLength={255}
              required
            />
          </label>
        ) : (
          <label className="auth-field">
            <span>{t.loginIdentifier}</span>
            <input
              name="login"
              type="text"
              placeholder={t.loginPlaceholder}
              autoComplete="username"
              minLength={3}
              maxLength={255}
              title={t.loginHint}
              required
            />
          </label>
        )}

        <label className="auth-field">
          <span>{t.password}</span>
          <span className="password-control">
            <input
              name="password"
              type={passwordVisible ? "text" : "password"}
              placeholder={t.passwordPlaceholder}
              autoComplete={isRegister ? "new-password" : "current-password"}
              minLength={8}
              maxLength={128}
              pattern="(?=.*[A-Za-z\u0400-\u04FF])(?=.*\d).{8,128}"
              title={t.passwordHint}
              required
            />
            <button
              className="field-icon-button"
              type="button"
              onClick={() => setPasswordVisible((value) => !value)}
              aria-label={passwordToggleLabel}
              title={passwordToggleLabel}
            >
              <span className={passwordVisible ? "eye-icon visible" : "eye-icon"} aria-hidden="true" />
            </button>
          </span>
        </label>

        <button className="primary-btn" type="submit">
          {isRegister ? t.submitRegister : t.submitLogin}
        </button>
      </form>

      {status && (
        <div className="status-note" role="alert">
          {status}
        </div>
      )}
      <p className="switch-note">
        {isRegister ? t.hintRegister : t.hintLogin}{" "}
        <button
          className="link-btn"
          type="button"
          onClick={() => onModeChange(isRegister ? "login" : "register")}
        >
          {isRegister ? t.switchLogin : t.switchRegister}
        </button>
      </p>
    </section>
  );
}
