import ChatWorkspace from "../components/ChatWorkspace";
import "../styles/workspace.css";

export default function Workspace({ profile, projectName, featureFlags, version }) {
  return (
    <div className="workspace-page-shell">
      <ChatWorkspace profile={profile} projectName={projectName} featureFlags={featureFlags} />
      {version && <div className="workspace-version">{version}</div>}
    </div>
  );
}
