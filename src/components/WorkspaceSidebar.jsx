import { useMemo, useState } from "react";
import { dialogCreateActions } from "../utils/workspaceData";
import { getInitials, getProfileName } from "../utils/workspaceUtils";

function sortThreads(threads) {
  return [...threads].sort((left, right) => {
    if (left.isPinned !== right.isPinned) return left.isPinned ? -1 : 1;
    if (left.isPinned && right.isPinned) return (left.pinOrder || 0) - (right.pinOrder || 0);
    return String(left.name).localeCompare(String(right.name), "ru");
  });
}

export default function WorkspaceSidebar({
  profile,
  threads,
  contacts,
  contactsQuery,
  activeThreadId,
  collapsed,
  onCollapseToggle,
  onContactsQueryChange,
  onThreadChange,
  onOpenSettings,
  onPinThread,
  onMovePinned,
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const profileName = getProfileName(profile);
  const sortedThreads = useMemo(() => sortThreads(threads), [threads]);

  if (collapsed) {
    return (
      <aside className="workspace-sidebar workspace-sidebar-collapsed">
        <button className="profile-mini" type="button" onClick={onCollapseToggle} title="Развернуть меню">
          {getInitials(profileName)}
        </button>
      </aside>
    );
  }

  return (
    <aside className="workspace-sidebar">
      <div className={profileOpen ? "workspace-profile open" : "workspace-profile"}>
        <button className="workspace-profile-main" type="button" onClick={() => setProfileOpen((value) => !value)}>
          <span className="profile-avatar">{getInitials(profileName)}</span>
          <span className="profile-meta">
            <strong>{profileName}</strong>
            <small>@{profile?.handle || "user"}</small>
          </span>
          <span className="profile-chevron">{profileOpen ? "⌃" : "⌄"}</span>
        </button>
        {profileOpen && (
          <div className="workspace-profile-actions">
            <button type="button" onClick={onOpenSettings} aria-label="Настройки">⚙</button>
            <button type="button" aria-label="Дополнительно">◇</button>
            <button type="button" onClick={onCollapseToggle}>Свернуть</button>
          </div>
        )}
      </div>

      <div className="workspace-search">
        <span aria-hidden="true">⌕</span>
        <input type="search" placeholder="Поиск чатов" />
      </div>

      <div className="thread-section-head">
        <button className="thread-section-title as-button" type="button">Диалоги</button>
        <button className="workspace-icon-button" type="button" aria-label="Создать чат" onClick={() => setCreateOpen((value) => !value)}>+</button>
      </div>
      {createOpen && (
        <div className="dialog-create-popover">
          {dialogCreateActions.map((item) => <button key={item} type="button">{item}</button>)}
        </div>
      )}

      <div className="thread-list compact">
        {sortedThreads.map((thread, index) => (
          <button
            key={thread.id}
            className={thread.id === activeThreadId ? "thread-card active" : "thread-card"}
            type="button"
            onClick={() => onThreadChange(thread.id)}
          >
            <span className={`thread-avatar ${thread.status}`}>{getInitials(thread.name)}</span>
            <span className="thread-meta">
              <strong>{thread.type === "direct" ? thread.name.replace(/^@/, "") : thread.name}</strong>
            </span>
            <span className="thread-actions" onClick={(event) => event.stopPropagation()}>
              <button type="button" title="Закрепить" onClick={() => onPinThread(thread)}>{thread.isPinned ? "●" : "○"}</button>
              {thread.isPinned && <button type="button" title="Выше" onClick={() => onMovePinned(thread, -1)} disabled={index === 0}>↑</button>}
              {thread.unread > 0 && <span className="thread-badge">{thread.unread}</span>}
            </span>
          </button>
        ))}
      </div>

      <div className="contacts-panel">
        <div className="thread-section-title">Контакты</div>
        <div className="workspace-search compact-search">
          <span aria-hidden="true">@</span>
          <input
            type="search"
            placeholder="Поиск по тегу"
            value={contactsQuery}
            onChange={(event) => onContactsQueryChange(event.target.value)}
          />
        </div>
        <div className="contacts-list">
          {(contacts || []).map((contact) => (
            <button key={contact.id} type="button" className="contact-card">
              <span className="contact-avatar">{getInitials(contact.name)}</span>
              <span>
                <strong>{contact.name}</strong>
                <small>{contact.tag}</small>
              </span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
