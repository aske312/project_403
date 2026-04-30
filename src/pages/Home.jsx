import { useEffect, useState } from "react";
import AppFooter from "../components/AppFooter";
import AppHeader from "../components/AppHeader";
import AuthForm from "../components/AuthForm";
import AuthIntro from "../components/AuthIntro";
import { getHealth, login, register } from "../utils/apiClient";
import { canUseAdminPanel, normalizeEnvironment } from "../utils/environment";
import { homeCopy } from "../utils/homeCopy";
import { setAccessToken, useAuthSession } from "../utils/useAuthSession";
import "../styles/home.css";

export default function Home() {
  const [theme, setTheme] = useState("dark");
  const [lang, setLang] = useState("RU");
  const [mode, setMode] = useState("login");
  const [status, setStatus] = useState("");
  const [projectName, setProjectName] = useState(import.meta.env.VITE_APP_NAME || "Project_403");
  const [projectEnvironment, setProjectEnvironment] = useState(import.meta.env.MODE);
  const {
    profile,
    setProfile,
    accountOpen,
    setAccountOpen,
    logout,
  } = useAuthSession();

  const t = homeCopy[lang];
  const isRegister = mode === "register";
  const env = normalizeEnvironment(projectEnvironment);
  const showAdminLink = canUseAdminPanel(profile, env);

  useEffect(() => {
    let ignore = false;

    async function loadProjectName() {
      try {
        const { payload } = await getHealth();
        if (!ignore && payload.app) {
          setProjectName(payload.app);
          setProjectEnvironment(payload.environment || import.meta.env.MODE);
        }
      } catch {
        if (!ignore) {
          setProjectName(import.meta.env.VITE_APP_NAME || "Project_403");
          setProjectEnvironment(import.meta.env.MODE);
        }
      }
    }

    loadProjectName();

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
    const formData = new FormData(event.currentTarget);
    const requestPayload = {
      [isRegister ? "email" : "login"]: String(formData.get(isRegister ? "email" : "login") || ""),
      password: String(formData.get("password") || ""),
    };

    if (isRegister) {
      requestPayload.first_name = String(formData.get("first_name") || "");
      requestPayload.last_name = String(formData.get("last_name") || "");
    }

    try {
      const { response, payload: result } = await (isRegister
        ? register(requestPayload)
        : login(requestPayload));

      if (!response.ok) {
        setStatus(result.detail || "Request failed");
        return;
      }

      if (isRegister) {
        const { response: loginResponse, payload: loginResult } = await login({
          login: requestPayload.email,
          password: requestPayload.password,
        });

        if (!loginResponse.ok) {
          setProfile(null);
          setAccountOpen(false);
          setStatus(loginResult.detail || "Login after registration failed");
          return;
        }

        setAccessToken(loginResult.access_token);
        setProfile(loginResult.user);
        setStatus("");
        setMode("login");
        return;
      }

      setAccessToken(result.access_token);
      setProfile(result.user);
      setStatus("");
    } catch (error) {
      setStatus(error.message);
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
        onToggleLang={() => setLang(lang === "RU" ? "EN" : "RU")}
        onToggleTheme={() => setTheme(theme === "light" ? "dark" : "light")}
        onLogout={handleLogout}
        adminLinkVisible={showAdminLink}
        adminLinkLabel={t.adminPanel}
      />

      <main className="auth-shell">
        <AuthIntro t={t} projectName={projectName} />
        <AuthForm
          t={t}
          mode={mode}
          status={status}
          onModeChange={setMode}
          onSubmit={handleSubmit}
        />
      </main>

      <AppFooter
        variant="auth"
        statusLabel={env.label}
        statusState={env.state}
        version={import.meta.env.VITE_APP_VERSION}
        links={[
          { href: "https://github.com/aske312/project_403/blob/master/README.md", label: t.github },
          { href: "https://vk.com/aske312", label: t.vk },
          { href: "https://t.me/aske312", label: t.telegram },
        ]}
      />
    </div>
  );
}
