import { useEffect, useState } from "react";
import AppFooter from "../components/AppFooter";
import AppHeader from "../components/AppHeader";
import AuthForm from "../components/AuthForm";
import AuthIntro from "../components/AuthIntro";
import ChatWorkspace from "../components/ChatWorkspace";
import { config } from "../config/appConfig";
import { getHealth, login, register } from "../utils/apiClient";
import { normalizeEnvironment } from "../utils/environment";
import { homeCopy } from "../utils/homeCopy";
import {
  getNextLanguage,
  getNextTheme,
  getStoredLanguage,
  getStoredTheme,
  storeLanguage,
  storeTheme,
} from "../utils/themePreference";
import { getAccessToken, setAccessToken, useAuthSession } from "../utils/useAuthSession";
import "../styles/home.css";

function getValidationMessages(detail) {
  if (!Array.isArray(detail)) return [];

  return detail
    .map((item) => item?.msg || item?.message || item)
    .filter(Boolean)
    .map(String);
}

function getAuthErrorMessage(payload, fallback, t) {
  const detail = payload?.detail;
  const validationMessages = getValidationMessages(detail);

  if (validationMessages.length > 0) {
    return validationMessages.join(" ");
  }

  const message = String(detail || payload?.message || fallback || t.requestFailed);
  const normalized = message.toLowerCase();

  if (normalized.includes("too many login attempts")) return t.tooManyLoginAttempts;
  if (normalized.includes("too many registration attempts")) return t.tooManyRegisterAttempts;
  if (normalized.includes("invalid login or password")) return t.invalidLoginOrPassword;
  if (normalized.includes("user with this email already exists")) return t.emailAlreadyExists;
  if (normalized.includes("login is required")) return t.loginRequired;

  return message;
}

export default function Home() {
  const [theme, setTheme] = useState(getStoredTheme);
  const [lang, setLang] = useState(getStoredLanguage);
  const [mode, setMode] = useState("login");
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [projectName, setProjectName] = useState(config.app.project.defaultName);
  const [projectEnvironment, setProjectEnvironment] = useState(import.meta.env.VITE_ENVIRONMENTS);
  const [featureFlags, setFeatureFlags] = useState({});
  const [onlineUsers, setOnlineUsers] = useState(null);
  const {
    profile,
    setProfile,
    sessionExpired,
    setSessionExpired,
    accountOpen,
    setAccountOpen,
    logout,
  } = useAuthSession();

  const t = homeCopy[lang];
  const isRegister = mode === "register";
  const env = normalizeEnvironment(projectEnvironment);
  const showAdminLink = Boolean(featureFlags.admin_panel);
  const visibleStatus = status || (sessionExpired ? t.sessionExpired : "");
  const canViewOnlineUsers = Boolean(featureFlags.footer_online_counter);

  const handleModeChange = (nextMode) => {
    setMode(nextMode);
    setStatus("");
    setSessionExpired(false);
  };

  useEffect(() => {
    let ignore = false;

    async function loadProjectStatus() {
      try {
        const { payload } = await getHealth(getAccessToken());
        if (!ignore && payload.app) {
          setProjectName(payload.app);
          setProjectEnvironment(payload.environment || import.meta.env.VITE_ENVIRONMENTS);
          setFeatureFlags(payload.feature_flags || {});
          setOnlineUsers(payload.online_users);
        }
      } catch {
        if (!ignore) {
          setProjectName(config.app.project.defaultName);
          setProjectEnvironment(import.meta.env.VITE_ENVIRONMENTS);
          setFeatureFlags({});
          setOnlineUsers(null);
        }
      }
    }

    loadProjectStatus();

    return () => {
      ignore = true;
    };
  }, []);

  const handleLogout = () => {
    logout();
    setStatus("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setStatus("");
    setSessionExpired(false);

    try {
      const formData = new FormData(event.currentTarget);
      const requestPayload = {
        [isRegister ? "email" : "login"]: String(formData.get(isRegister ? "email" : "login") || ""),
        password: String(formData.get("password") || ""),
      };

      if (isRegister) {
        requestPayload.first_name = String(formData.get("first_name") || "");
        requestPayload.last_name = String(formData.get("last_name") || "");
      }

      const { response, payload: result } = await (isRegister
        ? register(requestPayload)
        : login(requestPayload));

      if (!response.ok) {
        setStatus(getAuthErrorMessage(result, t.requestFailed, t));
        return;
      }

      setAccessToken(result.access_token);
      setProfile(result.user);
      setAccountOpen(false);
      setSessionExpired(false);
      setStatus("");

      try {
        const { payload } = await getHealth(result.access_token);
        setFeatureFlags(payload.feature_flags || {});
        setOnlineUsers(payload.online_users);
      } catch {
        setFeatureFlags({});
      }
    } catch (error) {
      setStatus(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`auth-page ${theme}`}>
      <AppHeader
        variant="auth"
        projectName={projectName}
        theme={theme}
        lang={lang}
        t={t}
        profile={profile}
        accountOpen={accountOpen}
        onToggleAccount={() => setAccountOpen((value) => !value)}
        onToggleLang={() => setLang((current) => storeLanguage(getNextLanguage(current)))}
        onToggleTheme={() => setTheme((current) => storeTheme(getNextTheme(current)))}
        onLogout={handleLogout}
        adminLinkVisible={showAdminLink}
        adminLinkLabel={t.adminPanel}
      />

      <main className={profile ? "auth-shell auth-shell-profile" : "auth-shell"}>
        {profile ? (
          <ChatWorkspace profile={profile} projectName={projectName} featureFlags={featureFlags} />
        ) : (
          <>
            <AuthIntro t={t} projectName={projectName} />
            <AuthForm
              t={t}
              mode={mode}
              status={visibleStatus}
              submitting={submitting}
              onModeChange={handleModeChange}
              onSubmit={handleSubmit}
            />
          </>
        )}
      </main>

      <AppFooter
        variant="auth"
        statusState={env.state}
        version={import.meta.env.VITE_APP_VERSION}
        onlineUsers={onlineUsers}
        canViewOnlineUsers={canViewOnlineUsers}
        links={[
          { href: "https://github.com/aske312/project_403/blob/master/README.md", label: t.github },
          { href: "https://vk.com/aske312", label: t.vk },
          { href: "https://t.me/aske312", label: t.telegram },
        ]}
      />
    </div>
  );
}
