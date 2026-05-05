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
  const displayName = thread.id === "notes" ? "Заметки" : thread.name;

  return (
    <button className={active ? "conversation-card active" : "conversation-card"} type="button" onClick={() => onThreadChange(thread.id)}>
      <span className={`conversation-avatar ${thread.status || "idle"}`}>{getInitials(displayName)}</span>
      <span className="conversation-content">
        <span className="conversation-topline">
          <strong>{displayName}</strong>
          {thread.lastAt && <time>{thread.lastAt}</time>}
        </span>
        <span className="conversation-preview">{thread.lastMessage}</span>
      </span>
      <span className="conversation-actions" onClick={(event) => event.stopPropagation()}>
        {thread.unread > 0 && <span className="conversation-badge">{thread.unread}</span>}
        {thread.id !== "notes" && (
          <button type="button" title={thread.isPinned ? "Открепить" : "Закрепить"} onClick={() => onPinThread(thread)}>
            {thread.isPinned ? "●" : "○"}
          </button>
        )}
        {thread.isPinned && thread.id !== "notes" && <button type="button" title="Выше" onClick={() => onMovePinned(thread, -1)} disabled={index === 0}>↑</button>}
      </span>
    </button>
  );
}

function CreateDialogModal({ onClose }) {
  return (
    <div className="workspace-modal-backdrop" onClick={onClose}>
      <section className="create-dialog-modal" onClick={(event) => event.stopPropagation()}>
        <div className="details-headline">
          <div>
            <p className="workspace-kicker">Создание</p>
            <h2>Новый чат</h2>
          </div>
          <button className="workspace-icon-button" type="button" onClick={onClose}>×</button>
        </div>
        <div className="create-dialog-options">
          {dialogCreateActions.map((item) => (
            <button key={item} type="button">
              <span>{item === "Личный чат" ? "💬" : item === "Группа" ? "👥" : "📣"}</span>
              <strong>{item}</strong>
              <small>{item === "Личный чат" ? "Диалог с одним пользователем" : item === "Группа" ? "Коллективный чат" : "Публичная лента на будущее"}</small>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function MinimalSpaceSidebar({ profile }) {
  const [profileOpen, setProfileOpen] = useState(false);
  const profileName = getProfileName(profile);
  const profileTag = profile?.tag || `@${profile?.handle || "user"}`;

  return (
    <aside className="messenger-sidebar minimal-space-sidebar">
      <button className="minimal-profile-button" type="button" onClick={() => setProfileOpen((value) => !value)} title={profileName}>
        <span className="profile-chip">{getInitials(profileName)}</span>
      </button>
      {profileOpen && (
        <div className="minimal-profile-menu">
          <strong>{profileName}</strong>
          <small>{profileTag}</small>
          <div className="profile-actions compact-actions">
            <button type="button" title="Настройки">⚙</button>
            <button type="button" title="Статус">◉</button>
          </div>
        </div>
      )}
    </aside>
  );
}

export default function WorkspaceSidebar({
  profile,
  threads,
  contacts,
  activeThreadId,
  activeSpace = "direct",
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
  const ownIds = new Set([profile?.id, profile?.user_id].filter(Boolean).map(String));
  const ownHandles = new Set([profile?.handle, profile?.tag, profile?.email].filter(Boolean).map((item) => String(item).toLowerCase()));
  const safeContacts = (contacts || []).filter((contact) => {
    if (ownIds.has(String(contact.id))) return false;
    return ![contact.handle, contact.tag, contact.email].filter(Boolean).some((item) => ownHandles.has(String(item).toLowerCase()));
  });

  if (activeSpace !== "direct") {
    return <MinimalSpaceSidebar profile={profile} />;
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
          <div className="profile-actions compact-actions">
            <button type="button" title="Настройки профиля">⚙</button>
            <button type="button" title="Статус">◉</button>
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
          <button className="round-action" type="button" aria-label="Создать чат" onClick={() => setCreateOpen(true)}>+</button>
        </div>
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
            {safeContacts.map((contact) => (
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
      {createOpen && <CreateDialogModal onClose={() => setCreateOpen(false)} />}
    </aside>
  );
}
