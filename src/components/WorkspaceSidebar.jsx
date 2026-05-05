import { useMemo, useState } from "react";
import { dialogCreateActions } from "../utils/workspaceData";
import { getInitials, getProfileName } from "../utils/workspaceUtils";

function sortThreads(threads) {
  return [...threads].sort((left, right) => {
    if (left.id === "notes") return -1;
    if (right.id === "notes") return 1;
    if (left.isPinned !== right.isPinned) return left.isPinned ? -1 : 1;
    if (left.isPinned && right.isPinned) return (left.pinOrder || 0) - (right.pinOrder || 0);
    return String(left.name).localeCompare(String(right.name), "ru");
  });
}

function ThreadCard({ thread, active, index, onThreadChange, onPinThread, onMovePinned }) {
  const title = thread.id === "notes" ? "Заметки" : thread.name.replace(/^@/, "");
  return (
    <button className={active ? "conversation-card active" : "conversation-card"} type="button" onClick={() => onThreadChange(thread.id)}>
      <span className={`conversation-avatar ${thread.status || "idle"}`}>{getInitials(title)}</span>
      <span className="conversation-content">
        <span className="conversation-topline">
          <strong>{title}</strong>
          {thread.lastAt && <time>{thread.lastAt}</time>}
        </span>
        <span className="conversation-preview">{thread.lastMessage || thread.topic || thread.description || "Нет сообщений"}</span>
      </span>
      <span className="conversation-actions" onClick={(event) => event.stopPropagation()}>
        {thread.unread > 0 && <span className="conversation-badge">{thread.unread}</span>}
        {thread.id !== "notes" && (
          <button type="button" title={thread.isPinned ? "Открепить" : "Закрепить"} onClick={() => onPinThread(thread)}>
            {thread.isPinned ? "⌃" : "⌄"}
          </button>
        )}
        {thread.isPinned && thread.id !== "notes" && <button type="button" title="Выше" onClick={() => onMovePinned(thread, -1)} disabled={index === 0}>↑</button>}
      </span>
    </button>
  );
}

export default function WorkspaceSidebar({
  profile,
  threads,
  contacts,
  activeThreadId,
  collapsed,
  onCollapseToggle,
  onThreadChange,
  onPinThread,
  onMovePinned,
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [contactsOpen, setContactsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const profileName = getProfileName(profile);
  const profileTag = profile?.tag || `@${profile?.handle || "user"}`;
  const sortedThreads = useMemo(() => sortThreads(threads), [threads]);
  const filteredThreads = sortedThreads.filter((thread) => String(thread.name).toLowerCase().includes(query.toLowerCase()));

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
            <small>{profileTag}</small>
          </span>
          <span className="profile-toggle">{profileOpen ? "⌃" : "⌄"}</span>
        </button>
        {profileOpen && (
          <div className="profile-actions">
            <button type="button">Профиль</button>
            <button type="button">Статус</button>
            <button type="button" onClick={onCollapseToggle}>Свернуть меню</button>
          </div>
        )}
      </section>

      <label className="messenger-search">
        <span>⌕</span>
        <input type="search" placeholder="Поиск" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>

      <section className="sidebar-section conversations-section">
        <div className="section-title-row">
          <span className="section-title-button as-text">Все чаты</span>
          <button className="round-action" type="button" aria-label="Создать чат" onClick={() => setCreateOpen((value) => !value)}>+</button>
        </div>
        {createOpen && (
          <div className="create-popover">
            {dialogCreateActions.map((item) => <button key={item} type="button">{item}</button>)}
          </div>
        )}
        <div className="conversation-list">
          {filteredThreads.map((thread, index) => (
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
        </div>
      </section>

      <section className={contactsOpen ? "sidebar-section contacts-section open" : "sidebar-section contacts-section"}>
        <button className="contacts-toggle" type="button" onClick={() => setContactsOpen((value) => !value)}>
          <span>Контакты</span>
          <span>{contactsOpen ? "⌃" : "⌄"}</span>
        </button>
        {contactsOpen && (
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
        )}
      </section>
    </aside>
  );
}
