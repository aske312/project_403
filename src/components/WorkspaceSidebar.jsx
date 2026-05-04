import { quickActions } from "../utils/workspaceData";
import { getInitials } from "../utils/workspaceUtils";

export default function WorkspaceSidebar({ projectName, threads, activeThreadId, quickActionsEnabled, onThreadChange }) {
  return (
    <aside className="workspace-sidebar">
      <div className="workspace-sidebar-head">
        <div>
          <p className="workspace-kicker">Project hub</p>
          <h1>{projectName}</h1>
        </div>
        <button className="workspace-icon-button" type="button" aria-label="Создать чат">+</button>
      </div>

      <div className="workspace-search">
        <span aria-hidden="true">⌕</span>
        <input type="search" placeholder="Поиск чатов, групп, каналов" />
      </div>

      {quickActionsEnabled && (
        <div className="quick-actions">
          {quickActions.map((action) => (
            <button key={action} type="button">{action}</button>
          ))}
        </div>
      )}

      <div className="thread-section-title">Активные диалоги</div>
      <div className="thread-list">
        {threads.map((thread) => (
          <button
            key={thread.id}
            className={thread.id === activeThreadId ? "thread-card active" : "thread-card"}
            type="button"
            onClick={() => onThreadChange(thread.id)}
          >
            <span className={`thread-avatar ${thread.status}`}>{getInitials(thread.name)}</span>
            <span className="thread-meta">
              <strong>{thread.name}</strong>
              <small>{thread.description}</small>
            </span>
            {thread.unread > 0 && <span className="thread-badge">{thread.unread}</span>}
          </button>
        ))}
      </div>
    </aside>
  );
}
