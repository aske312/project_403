import { useState } from "react";
import { getInitials, getProfileName } from "../utils/workspaceUtils";

function getProfileTag(profile) {
  if (!profile) return "@guest";
  return profile.tag || (profile.handle ? `@${profile.handle}` : profile.email || "@user");
}

export default function WorkspaceSidebar({ profile, threads, activeThreadId, onThreadChange, onOpenSettings, onCreateChat }) {
  const [profileCollapsed, setProfileCollapsed] = useState(false);
  const profileName = getProfileName(profile);
  const profileTag = getProfileTag(profile);

  return (
    <aside className="workspace-sidebar">
      <button
        className={profileCollapsed ? "workspace-profile-card collapsed" : "workspace-profile-card"}
        type="button"
        onClick={() => setProfileCollapsed((current) => !current)}
        aria-label="Свернуть или раскрыть профиль"
      >
        <span className="workspace-profile-avatar">{getInitials(profileName)}</span>
        <span className="workspace-profile-meta">
          <span className="workspace-kicker">Вы вошли как</span>
          <strong>{profileName}</strong>
          <small>{profileTag}</small>
        </span>
      </button>

      <div className="workspace-sidebar-actions" aria-label="Действия чата">
        <button className="workspace-icon-button" type="button" aria-label="Настройки" onClick={onOpenSettings}>⚙</button>
        <button className="workspace-icon-button" type="button" aria-label="Добавить чат" onClick={onCreateChat}>+</button>
      </div>

      <div className="workspace-search">
        <span aria-hidden="true">⌕</span>
        <input type="search" placeholder="Найти диалог" />
      </div>

      <div className="thread-section-title">Диалоги</div>
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
            </span>
            {thread.unread > 0 && <span className="thread-badge">{thread.unread}</span>}
          </button>
        ))}
      </div>
    </aside>
  );
}
