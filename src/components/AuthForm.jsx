import { useState } from "react";
import { config } from "../config/appConfig";

const loginForm = config.validation.forms.login;
const registrationFormConfig = config.validation.forms.registration;

function sanitizePersonName(value) {
  return value.replace(/[^A-Za-z\u0400-\u04FF-]/g, "").slice(0, registrationFormConfig.firstName.maxLength);
}

function sanitizeLogin(value) {
  return value.replace(/[^A-Za-z0-9_@.+-]/g, "").slice(0, loginForm.login.maxLength);
}

function evaluatePassword(value) {
  const checks = [
    value.length >= registrationFormConfig.password.minLength,
    /[A-Za-z\u0400-\u04FF]/.test(value),
    /\d/.test(value),
    /[^A-Za-z\u0400-\u04FF\d]/.test(value),
    value.length >= registrationFormConfig.password.idealMinLength,
  ];
  const score = checks.filter(Boolean).length;

  if (!value) return { level: "empty", labelKey: "passwordStrengthEmpty" };
  if (score <= 2) return { level: "weak", labelKey: "passwordStrengthWeak" };
  if (score <= 4) return { level: "good", labelKey: "passwordStrengthGood" };
  return { level: "strong", labelKey: "passwordStrengthStrong" };
}

function RequiredMark() {
  return (
    <span className="required-mark" aria-hidden="true">
      *
    </span>
  );
}

export default function AuthForm({ t, mode, status, onModeChange, onSubmit }) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [registrationPassword, setRegistrationPassword] = useState("");
  const [registrationTouched, setRegistrationTouched] = useState(false);
  const isRegister = mode === "register";
  const passwordToggleLabel = passwordVisible ? t.hidePassword : t.showPassword;
  const passwordStrength = evaluatePassword(registrationPassword);

  const getPasswordPrompt = () => {
    if (!registrationPassword) return "";

    const prompts = [];
    if (registrationPassword.length < registrationFormConfig.password.minLength) prompts.push(t.passwordAddLength);
    if (!/[A-Za-z\u0400-\u04FF]/.test(registrationPassword)) prompts.push(t.passwordAddLetter);
    if (!/\d/.test(registrationPassword)) prompts.push(t.passwordAddDigit);
    if (registrationPassword.length >= registrationFormConfig.password.minLength && /[A-Za-z\u0400-\u04FF]/.test(registrationPassword) && /\d/.test(registrationPassword)) {
      if (!/[^A-Za-z\u0400-\u04FF\d]/.test(registrationPassword)) prompts.push(t.passwordAddSymbol);
      if (registrationPassword.length < registrationFormConfig.password.idealMinLength) prompts.push(t.passwordMakeLonger);
    }

    return prompts.length > 0 ? prompts.join(" ") : t.passwordIdeal;
  };

  const renderPasswordField = (registerMode = false) => {
    const passwordConfig = registerMode ? registrationFormConfig.password : loginForm.password;

    return (
      <label className="auth-field">
        <span>
          {t.password}
          {registerMode && <RequiredMark />}
        </span>
        <span className="password-control">
          <input
            name="password"
            type={passwordVisible ? "text" : "password"}
            placeholder={t.passwordPlaceholder}
            autoComplete={registerMode ? "new-password" : "current-password"}
            minLength={passwordConfig.minLength}
            maxLength={passwordConfig.maxLength}
            pattern={passwordConfig.pattern}
            title={t.passwordHint}
            onChange={registerMode ? (event) => setRegistrationPassword(event.currentTarget.value) : undefined}
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
        {registerMode && registrationPassword && (
          <span className={`password-strength ${passwordStrength.level}`}>
            <span aria-hidden="true" />
            {getPasswordPrompt()}
          </span>
        )}
      </label>
    );
  };

  const registrationForm = (
    <form
      className={registrationTouched ? "auth-form validated" : "auth-form"}
      onInvalid={() => setRegistrationTouched(true)}
      onSubmit={(event) => {
        setRegistrationTouched(true);
        onSubmit(event);
      }}
    >
      <div className="field-grid">
        <label className="auth-field">
          <span>
            {t.firstName}
            <RequiredMark />
          </span>
          <input
            name="first_name"
            type="text"
            placeholder={t.firstNamePlaceholder}
            autoComplete="given-name"
            minLength={1}
            maxLength={registrationFormConfig.firstName.maxLength}
            pattern={registrationFormConfig.firstName.pattern}
            title={t.nameHint}
            onInput={(event) => {
              event.currentTarget.value = sanitizePersonName(event.currentTarget.value);
            }}
            required
          />
        </label>

        <label className="auth-field">
          <span>{t.lastName}</span>
          <input
            name="last_name"
            type="text"
            placeholder={t.lastNamePlaceholder}
            autoComplete="family-name"
            maxLength={registrationFormConfig.lastName.maxLength}
            pattern={registrationFormConfig.lastName.pattern}
            title={t.nameHint}
            onInput={(event) => {
              event.currentTarget.value = sanitizePersonName(event.currentTarget.value);
            }}
          />
        </label>
      </div>

      <label className="auth-field">
        <span>
          {t.email}
          <RequiredMark />
        </span>
        <input
          name="email"
          type="email"
          placeholder={t.emailPlaceholder}
          autoComplete="email"
          minLength={registrationFormConfig.email.minLength}
          maxLength={registrationFormConfig.email.maxLength}
          required
        />
      </label>

      {renderPasswordField(true)}

      <button className="primary-btn" type="submit">
        {t.submitRegister}
      </button>
    </form>
  );

  return (
    <>
    <section className="auth-card" aria-labelledby="auth-form-title">
      <div className="auth-card-top">
        <div>
          <p className="auth-kicker">{t.login}</p>
          <h2 id="auth-form-title">{t.titleLogin}</h2>
        </div>
      </div>

      <form className="auth-form" onSubmit={onSubmit}>
        <label className="auth-field">
          <span>{t.loginIdentifier}</span>
          <input
            name="login"
            type="text"
            placeholder={t.loginPlaceholder}
            autoComplete="username"
            minLength={loginForm.login.minLength}
            maxLength={loginForm.login.maxLength}
            pattern={loginForm.login.pattern}
            title={t.loginHint}
            onInput={(event) => {
              event.currentTarget.value = sanitizeLogin(event.currentTarget.value);
            }}
            required
          />
        </label>

        {renderPasswordField(false)}

        <button className="primary-btn" type="submit">
          {t.submitLogin}
        </button>
      </form>

      {!isRegister && status && (
        <div className="status-note" role="alert">
          {status}
        </div>
      )}
      <p className="switch-note">
        {t.hintLogin}{" "}
        <button
          className="link-btn"
          type="button"
          onClick={() => onModeChange("register")}
        >
          {t.switchRegister}
        </button>
      </p>
    </section>
    {isRegister && (
      <div className="auth-modal-backdrop" role="presentation">
        <section
          className="auth-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="registration-form-title"
        >
          <div className="auth-card-top">
            <div>
              <p className="auth-kicker">{t.register}</p>
              <h2 id="registration-form-title">{t.titleRegister}</h2>
            </div>
            <button
              className="modal-close"
              type="button"
              onClick={() => onModeChange("login")}
              aria-label={t.close}
              title={t.close}
            >
              x
            </button>
          </div>

          {registrationForm}

          {status && (
            <div className="status-note" role="alert">
              {status}
            </div>
          )}
        </section>
      </div>
    )}
    </>
  );
}
