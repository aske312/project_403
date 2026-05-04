import ChatWorkspace from "../components/ChatWorkspace";
import "../styles/workspace.css";

export default function Workspace({ profile, projectName, featureFlags }) {
  return (
    <ChatWorkspace profile={profile} projectName={projectName} featureFlags={featureFlags} />
  );
}
