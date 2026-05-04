import { getInitials } from "./workspaceUtils";

export default function WorkspaceRail({ projectName, spaces, activeSpace, onSpaceChange }) {
  return (
    <aside className="workspace-rail" aria-label="Разделы">
      <div className="workspace-logo">{getInitials(projectName)}</div>
      <nav className="space-nav">
        {spaces.map((item) => (
          <button
            key={item.id}
            className={item.id === activeSpace ? "space-button active" : "space-button"}
            type="button"
            onClick={() => onSpaceChange(item.id)}
            title={item.title}
          >
            <span>{item.icon}</span>
            <small>{item.label}</small>
          </button>
        ))}
      </nav>
    </aside>
  );
}
