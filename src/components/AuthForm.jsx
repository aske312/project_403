function sanitizePersonName(value) {
  return value.replace(/[^A-Za-z\u0400-\u04FF-]/g, "").slice(0, 40);
}

export default function AuthForm({ t, mode, status, onModeChange, onSubmit }) {
  const isRegister = mode === "register";

  return (
    <section className="auth-card">
      <div className="mode-tabs" role="tablist" aria-label="Auth mode">
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

      <div className="form-heading">
        <h2>{isRegister ? t.titleRegister : t.titleLogin}</h2>
        <p>{isRegister ? t.formHintRegister : t.formHintLogin}</p>
      </div>

      <form className="auth-form" onSubmit={onSubmit}>
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
          onClick={() => onModeChange(isRegister ? "login" : "register")}
        >
          {isRegister ? t.switchLogin : t.switchRegister}
        </button>
      </p>
    </section>
  );
}
