export default function WorkspaceRail({ spaces, activeSpace, onSpaceChange, onOpenSettings, projectName = "Project 403" }) {
  const logoText = String(projectName || "Project 403")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "P4";

  return (
    <aside className="messenger-rail" aria-label="Навигация текущей страницы">
      <div className="rail-logo" title={projectName} aria-label={projectName}>
        <span>{logoText}</span>
      </div>
      <nav className="rail-nav">
        {spaces.map((item) => (
          <button
            key={item.id}
            className={item.id === activeSpace ? "rail-button active" : "rail-button"}
            type="button"
            onClick={() => onSpaceChange(item.id)}
            title={item.title}
            aria-label={item.title}
          >
            <span className="rail-icon">{item.icon}</span>
          </button>
        ))}
      </nav>
      <button className="rail-button rail-settings" type="button" onClick={onOpenSettings} title="Общие настройки">
        <span className="rail-icon">⚙</span>
      </button>
    </aside>
  );
}
