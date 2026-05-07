import { useEffect, useRef, useState } from "react";
import { getInitials } from "../utils/workspaceUtils";

function MessageStatus({ status }) {
  const icons = { sent: "✓", delivered: "✓✓", read: "✓✓", received: "" };
  const labels = { sent: "Отправлено", delivered: "Доставлено", read: "Прочитано", received: "Получено" };
  return <span className={`message-status ${status || "sent"}`} title={labels[status] || labels.sent}>{icons[status] || icons.sent}</span>;
}

function getThreadPresence(thread) {
  if (thread.type !== "direct" && thread.type !== "self") return `${thread.members || 0} участников`;
  if (thread.id === "notes" || thread.type === "self") return "личные заметки";
  if (thread.status === "online") return "в сети";
  if (thread.status === "busy") return "занят";
  return "был недавно";
}

export default function ChatPanel({ activeThread, messages, composerEnabled, draft, onDraftChange, onSend, typingUser, onHeaderClick, onEditMessage, onDeleteMessage }) {
  const [menuMessageId, setMenuMessageId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const feedRef = useRef(null);

  useEffect(() => {
    if (!feedRef.current) return;
    feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [activeThread?.id, messages.length]);

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
    <main className="messenger-chat">
      <div className="chat-topbar">
        <button className="chat-identity-button" type="button" onClick={onHeaderClick} title={activeThread.name}>
          <span className="chat-identity">
            <span className={`chat-avatar ${activeThread.status || "idle"}`}>{getInitials(activeThread.name)}</span>
            <span>
              <strong>{activeThread.name}</strong>
              <small>{typingUser ? `${typingUser} печатает...` : getThreadPresence(activeThread)}</small>
            </span>
          </span>
        </button>
        <div className="chat-topbar-actions">
          <span className="chat-header-hint">Информация и настройки</span>
        </div>
      </div>

      <div className="message-feed" ref={feedRef}>
        <div className="day-divider"><span>Сегодня</span></div>
        {messages.map((message) => (
          <article key={message.id} className={message.own ? "bubble-row own" : "bubble-row"}>
            {!message.own && <span className="message-avatar">{getInitials(message.author)}</span>}
            <div className="bubble-stack">
              {!message.own && <span className="message-author">{message.author}</span>}
              <div className="message-bubble">
                {editingId === message.id ? (
                  <form className="message-edit-form" onSubmit={submitEdit}>
                    <input value={editingText} onChange={(event) => setEditingText(event.target.value)} autoFocus />
                    <span className="edit-actions">
                      <button type="submit">Сохранить</button>
                      <button type="button" onClick={() => setEditingId(null)}>Отмена</button>
                    </span>
                  </form>
                ) : <p>{message.text}</p>}
                <span className="bubble-meta">
                  {message.edited && <em>изм.</em>}
                  <time>{message.time}</time>
                  {message.own && <MessageStatus status={message.status} />}
                </span>
                <button type="button" className="message-menu-button" onClick={() => setMenuMessageId((value) => (value === message.id ? null : message.id))}>⋯</button>
                {menuMessageId === message.id && (
                  <div className="message-menu">
                    {message.own && <button type="button" onClick={() => startEdit(message)}>Редактировать</button>}
                    <button type="button" onClick={() => onDeleteMessage(message.id, "self")}>Удалить для себя</button>
                    {message.own && <button type="button" onClick={() => onDeleteMessage(message.id, "all")}>Удалить для всех</button>}
                  </div>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      {typingUser && <div className="typing-line"><span />{typingUser} печатает…</div>}

      {composerEnabled ? (
        <form className="composer" onSubmit={onSend}>
          <button type="button" className="composer-icon" aria-label="Прикрепить файл">📎</button>
          <input value={draft} onChange={(event) => onDraftChange(event.target.value)} placeholder="Write a message..." />
          <button type="button" className="composer-icon" aria-label="Emoji">☺</button>
          <button type="submit" className="send-button">➤</button>
        </form>
      ) : <div className="composer composer-disabled">Отправка сообщений отключена feature flag.</div>}
    </main>
  );
}
