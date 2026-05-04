import { useState } from "react";
import { getInitials, getProfileName } from "../utils/workspaceUtils";

function MessageStatus({ status }) {
  const labels = {
    sent: "Отправлено",
    delivered: "Доставлено",
    read: "Прочитано",
    received: "Получено",
  };
  return <span className={`message-status ${status || "sent"}`}>{labels[status] || labels.sent}</span>;
}

export default function ChatPanel({
  activeThread,
  messages,
  profile,
  composerEnabled,
  draft,
  onDraftChange,
  onSend,
  typingUser,
  onHeaderClick,
  onEditMessage,
  onDeleteMessage,
}) {
  const profileName = getProfileName(profile);
  const [menuMessageId, setMenuMessageId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState("");

  const startEdit = (message) => {
    setEditingId(message.id);
    setEditingText(message.text || "");
    setMenuMessageId(null);
  };

  const submitEdit = (event) => {
    event.preventDefault();
    if (!editingId || !editingText.trim()) return;
    onEditMessage(editingId, editingText.trim());
    setEditingId(null);
    setEditingText("");
  };

  return (
    <main className="chat-panel">
      <header className="chat-panel-head">
        <button className="chat-title-button" type="button" onClick={onHeaderClick}>
          <p className="workspace-kicker">{activeThread.type === "direct" ? "Direct message" : activeThread.type}</p>
          <h2>{activeThread.name}</h2>
        </button>
      </header>

      <div className="message-feed">
        {messages.map((message) => (
          <article key={message.id} className={message.own ? "message-row own" : "message-row"}>
            <span className="message-avatar">{getInitials(message.own ? profileName : message.author)}</span>
            <div className="message-bubble">
              <div className="message-author-line">
                <strong>{message.own ? profileName : message.author}</strong>
                <time>{message.time}</time>
                {message.edited && <span>изменено</span>}
              </div>
              {editingId === message.id ? (
                <form className="message-edit-form" onSubmit={submitEdit}>
                  <input value={editingText} onChange={(event) => setEditingText(event.target.value)} />
                  <button type="submit">Сохранить</button>
                  <button type="button" onClick={() => setEditingId(null)}>Отмена</button>
                </form>
              ) : (
                <p>{message.text}</p>
              )}
              <div className="message-bottom-line">
                {message.own && <MessageStatus status={message.status} />}
                <button type="button" className="message-menu-button" onClick={() => setMenuMessageId((value) => (value === message.id ? null : message.id))}>⋯</button>
              </div>
              {menuMessageId === message.id && (
                <div className="message-menu">
                  {message.own && <button type="button" onClick={() => startEdit(message)}>Редактировать</button>}
                  <button type="button" onClick={() => onDeleteMessage(message.id, "self")}>Удалить для себя</button>
                  {message.own && <button type="button" onClick={() => onDeleteMessage(message.id, "all")}>Удалить для всех</button>}
                </div>
              )}
            </div>
          </article>
        ))}
      </div>

      {typingUser && <div className="typing-indicator">{typingUser} печатает…</div>}

      {composerEnabled ? (
        <form className="composer" onSubmit={onSend}>
          <button type="button" aria-label="Прикрепить файл">📎</button>
          <input
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder={`Сообщение в ${activeThread.name}`}
          />
          <button type="submit">Отправить</button>
        </form>
      ) : (
        <div className="composer composer-disabled">Отправка сообщений отключена feature flag.</div>
      )}
    </main>
  );
}
