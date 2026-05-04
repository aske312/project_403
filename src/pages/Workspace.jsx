import ChatWorkspace from "../components/ChatWorkspace";
import "../styles/workspace.css";

export default function Workspace({
  profile,
  projectName,
  featureFlags,
  version,
  environment,
  integrations = {},
  theme,
  lang,
  t,
  adminLinkVisible,
  adminLinkLabel,
  onToggleLang,
  onToggleTheme,
  onLogout,
}) {
  return (
    <div className="workspace-page-shell">
      <ChatWorkspace
        profile={profile}
        projectName={projectName}
        featureFlags={featureFlags}
        environment={environment}
        integrations={integrations}
        theme={theme}
        lang={lang}
        t={t}
        adminLinkVisible={adminLinkVisible}
        adminLinkLabel={adminLinkLabel}
        onToggleLang={onToggleLang}
        onToggleTheme={onToggleTheme}
        onLogout={onLogout}
      />
      {version && <div className="workspace-version">{version}</div>}
    </div>
  );
}
