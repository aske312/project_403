import ChatWorkspace from "../components/ChatWorkspace";
import "../styles/workspace.css";

export default function Workspace({ profile, projectName, featureFlags, version, environment, integrations = {}, theme, lang, onToggleTheme, onToggleLang, onLogout }) {
  return (
    <div className="workspace-page-shell">
      <ChatWorkspace profile={profile} projectName={projectName} featureFlags={featureFlags} environment={environment} integrations={integrations} theme={theme} lang={lang} onToggleTheme={onToggleTheme} onToggleLang={onToggleLang} onLogout={onLogout} />
      {version && <div className="workspace-build-bookmark" title={`Build ${version}`}>{version}</div>}
    </div>
  );
}
