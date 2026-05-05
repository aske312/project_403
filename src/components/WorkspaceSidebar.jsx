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

function ThreadCard({ thread, active, index, onThreadChange, onPinThread, onMovePinned }) {
  const title = thread.type === "direct" ? thread.name.replace(/^@/, "") : thread.name;
  return (
    <button
      className={active ? "conversation-card active" : "conversation-card"}
      type="button"
      onClick={() => onThreadChange(thread.id)}
    >
      <span className={`conversation-avatar ${thread.status || "idle"}`}>{getInitials(title)}</span>
      <span className="conversation-content">
        <span className="conversation-topline">
          <strong>{title}</strong>
          {thread.lastAt && <time>{thread.lastAt}</time>}
        </span>
        <span className="conversation-preview">{thread.lastMessage || thread.topic || thread.description || "Нет сообщений"}</span>
      </span>
      <span className="conversation-actions" onClick={(event) => event.stopPropagation()}>
        {thread.isPinned && <span className="pin-indicator">●</span>}
        {thread.unread > 0 && <span className="conversation-badge">{thread.unread}</span>}
        <button type="button" title={thread.isPinned ? "Открепить" : "Закрепить"} onClick={() => onPinThread(thread)}>
          {thread.isPinned ? "⌃" : "⌄"}
        </button>
        {thread.isPinned && <button type="button" title="Выше" onClick={() => onMovePinned(thread, -1)} disabled={index === 0}>↑</button>}
      </span>
    </button>
  );
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
  const [query, setQuery] = useState("");
  const profileName = getProfileName(profile);
  const sortedThreads = useMemo(() => sortThreads(threads), [threads]);
  const filteredThreads = sortedThreads.filter((thread) => String(thread.name).toLowerCase().includes(query.toLowerCase()));
  const pinnedThreads = filteredThreads.filter((thread) => thread.isPinned);
  const regularThreads = filteredThreads.filter((thread) => !thread.isPinned);

  if (collapsed) {
    return (
      <aside className="messenger-sidebar collapsed">
        <button className="profile-chip compact" type="button" onClick={onCollapseToggle} title="Развернуть">
          {getInitials(profileName)}
        </button>
      </aside>
    );
  }

  return (
    <aside className="messenger-sidebar">
      <section className={profileOpen ? "profile-card open" : "profile-card"}>
        <button className="profile-main" type="button" onClick={() => setProfileOpen((value) => !value)}>
          <span className="profile-chip">{getInitials(profileName)}</span>
          <span className="profile-text">
            <strong>{profileName}</strong>
            <small>@{profile?.handle || profile?.tag || "user"}</small>
          </span>
          <span className="profile-toggle">{profileOpen ? "⌃" : "⌄"}</span>
        </button>
        {profileOpen && (
          <div className="profile-actions">
            <button type="button" onClick={onOpenSettings}>⚙ Настройки</button>
            <button type="button">◇ Статус</button>
            <button type="button" onClick={onCollapseToggle}>Свернуть</button>
          </div>
        )}
      </section>

      <label className="messenger-search">
        <span>⌕</span>
        <input type="search" placeholder="Поиск диалогов" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>

      <section className="sidebar-section conversations-section">
        <div className="section-title-row">
          <button type="button" className="section-title-button">Диалоги</button>
          <button className="round-action" type="button" aria-label="Создать чат" onClick={() => setCreateOpen((value) => !value)}>+</button>
        </div>
        {createOpen && (
          <div className="create-popover">
            {dialogCreateActions.map((item) => <button key={item} type="button">{item}</button>)}
          </div>
        )}
        <div className="conversation-list">
          {pinnedThreads.length > 0 && <p className="list-caption">Закреплённые</p>}
          {pinnedThreads.map((thread, index) => (
            <ThreadCard
              key={thread.id}
              thread={thread}
              index={index}
              active={thread.id === activeThreadId}
              onThreadChange={onThreadChange}
              onPinThread={onPinThread}
              onMovePinned={onMovePinned}
            />
          ))}
          {regularThreads.length > 0 && <p className="list-caption">Все чаты</p>}
          {regularThreads.map((thread, index) => (
            <ThreadCard
              key={thread.id}
              thread={thread}
              index={pinnedThreads.length + index}
              active={thread.id === activeThreadId}
              onThreadChange={onThreadChange}
              onPinThread={onPinThread}
              onMovePinned={onMovePinned}
            />
          ))}
        </div>
      </section>

      <section className="sidebar-section contacts-section">
        <div className="section-title-row">
          <span className="section-title-button as-text">Контакты</span>
        </div>
        <label className="messenger-search compact-search">
          <span>@</span>
          <input
            type="search"
            placeholder="Поиск по тегу"
            value={contactsQuery}
            onChange={(event) => onContactsQueryChange(event.target.value)}
          />
        </label>
        <div className="contacts-list">
          {(contacts || []).map((contact) => (
            <button key={contact.id} type="button" className="contact-row">
              <span className="contact-avatar">{getInitials(contact.name)}</span>
              <span>
                <strong>{contact.name}</strong>
                <small>{contact.tag}</small>
              </span>
            </button>
          ))}
        </div>
      </section>
    </aside>
  );
}
