import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import Workspace from "./Workspace";
import { config } from "../config/appConfig";
import { getHealth } from "../utils/apiClient";
import {
  getNextLanguage,
  getNextTheme,
  getStoredLanguage,
  getStoredTheme,
  storeLanguage,
  storeTheme,
} from "../utils/themePreference";
import { getAccessToken, useAuthSession } from "../utils/useAuthSession";
import "../styles/auth.css";

export default function WorkspacePage() {
  const [theme, setTheme] = useState(getStoredTheme);
  const [lang, setLang] = useState(getStoredLanguage);
  const [projectName, setProjectName] = useState(config.app.project.defaultName);
  const [projectEnvironment, setProjectEnvironment] = useState(import.meta.env.VITE_ENVIRONMENTS);
  const [featureFlags, setFeatureFlags] = useState({});
  const [integrations, setIntegrations] = useState({});
  const { profile, profileLoaded, logout } = useAuthSession();

  useEffect(() => {
    if (!profileLoaded || !profile) return undefined;
    let ignore = false;

    async function loadProjectStatus() {
      try {
        const { payload } = await getHealth(getAccessToken());
        if (!ignore && payload.app) {
          setProjectName(payload.app);
          setProjectEnvironment(payload.environment || import.meta.env.VITE_ENVIRONMENTS);
          setFeatureFlags(payload.feature_flags || {});
          setIntegrations(payload.integrations || {});
        }
      } catch {
        if (!ignore) {
          setProjectName(config.app.project.defaultName);
          setProjectEnvironment(import.meta.env.VITE_ENVIRONMENTS);
          setFeatureFlags({});
          setIntegrations({});
        }
      }
    }

    loadProjectStatus();

    return () => {
      ignore = true;
    };
  }, [profile, profileLoaded]);

  if (profileLoaded && !profile) {
    return <Navigate to="/auth" replace />;
  }

  if (!profileLoaded) {
    return <div className={`auth-page workspace-route ${theme}`} />;
  }

  return (
    <div className={`auth-page workspace-route ${theme}`}>
      <Workspace
        profile={profile}
        projectName={projectName}
        featureFlags={featureFlags}
        version={import.meta.env.VITE_APP_VERSION}
        environment={projectEnvironment}
        integrations={integrations}
        theme={theme}
        lang={lang}
        onToggleTheme={() => setTheme((current) => storeTheme(getNextTheme(current)))}
        onToggleLang={() => setLang((current) => storeLanguage(getNextLanguage(current)))}
        onLogout={logout}
      />
    </div>
  );
}
