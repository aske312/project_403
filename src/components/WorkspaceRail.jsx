import { getInitials } from "../utils/workspaceUtils";

export default function WorkspaceRail({ projectName, spaces, activeSpace, onSpaceChange, onOpenSettings }) {
  return (
    <aside className="messenger-rail" aria-label="Разделы workspace">
      <div className="rail-logo" title={projectName}>{getInitials(projectName)}</div>
      <nav className="rail-nav">
        {spaces.map((item) => (
          <button
            key={item.id}
            className={item.id === activeSpace ? "rail-button active" : "rail-button"}
            type="button"
            onClick={() => onSpaceChange(item.id)}
            title={item.title}
          >
            <span>{item.icon}</span>
            <small>{item.label}</small>
          </button>
        ))}
      </nav>
      <button className="rail-button rail-settings" type="button" onClick={onOpenSettings} title="Настройки">
        <span>⚙</span>
        <small>SET</small>
      </button>
    </aside>
  );
}
