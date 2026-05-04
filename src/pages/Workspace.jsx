import ChatWorkspace from "../components/ChatWorkspace";
import "../styles/workspace.css";

export default function Workspace({ profile, projectName, featureFlags, version, environment, integrations = {} }) {
  return (
    <div className="workspace-page-shell">
      <ChatWorkspace profile={profile} projectName={projectName} featureFlags={featureFlags} environment={environment} integrations={integrations} />
      {version && <div className="workspace-version">{version}</div>}
    </div>
  );
}
