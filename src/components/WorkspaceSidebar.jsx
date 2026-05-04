import { getInitials, getProfileName } from "../utils/workspaceUtils";

function getProfileTag(profile) {
  if (!profile) return "@guest";
  return profile.tag || (profile.handle ? `@${profile.handle}` : profile.email || "@user");
}

export default function WorkspaceSidebar({ profile, threads, activeThreadId, liveStatus, onThreadChange, onOpenSettings, onCreateChat }) {
  const profileName = getProfileName(profile);
  const profileTag = getProfileTag(profile);

  return (
    <aside className="workspace-sidebar">
      <div className="workspace-profile-card">
        <span className="workspace-profile-avatar">{getInitials(profileName)}</span>
        <div className="workspace-profile-meta">
          <p className="workspace-kicker">Ваш профиль</p>
          <h1>{profileName}</h1>
          <span>{profileTag}</span>
        </div>
        <div className="workspace-sidebar-actions">
          <button className="workspace-icon-button" type="button" aria-label="Настройки" onClick={onOpenSettings}>⚙</button>
          <button className="workspace-icon-button" type="button" aria-label="Добавить чат" onClick={onCreateChat}>+</button>
        </div>
      </div>

      <div className="workspace-search">
        <span aria-hidden="true">⌕</span>
        <input type="search" placeholder="Найти диалог" />
      </div>

      <div className="workspace-live-status">
        <span className={`workspace-live-dot ${liveStatus || "idle"}`} />
        <span>{liveStatus === "realtime" ? "WebSocket active" : liveStatus === "http" ? "HTTP fallback" : "Подключение"}</span>
      </div>

      <div className="thread-section-title">Direct messages</div>
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
              <small>{thread.type === "direct" ? "Личный диалог" : thread.description || thread.topic}</small>
            </span>
            {thread.unread > 0 && <span className="thread-badge">{thread.unread}</span>}
          </button>
        ))}
      </div>
    </aside>
  );
}
