import { useEffect, useRef } from "react";
import { getInitials, getProfileName } from "../utils/workspaceUtils";

function getMessageStatusLabel(message) {
  if (!message.own) return "";
  if (message.status === "read") return "Прочитано";
  if (message.status === "delivered") return "Доставлено";
  return "Отправлено";
}

export default function ChatPanel({ activeThread, messages, profile, composerEnabled, draft, onDraftChange, onSend, typingUser }) {
  const profileName = getProfileName(profile);
  const feedRef = useRef(null);

  useEffect(() => {
    const feed = feedRef.current;
    if (feed) feed.scrollTop = feed.scrollHeight;
  }, [messages.length, activeThread.id]);

  return (
    <main className="chat-panel">
      <header className="chat-panel-head">
        <div className="chat-title-button">
          <span className={`thread-avatar ${activeThread.status}`}>{getInitials(activeThread.name)}</span>
          <span>
            <p className="workspace-kicker">Direct message</p>
            <h2>{activeThread.name}</h2>
          </span>
        </div>
      </header>

      <div className="message-feed" ref={feedRef}>
        {messages.map((message) => {
          const statusLabel = getMessageStatusLabel(message);
          return (
            <article key={message.id} className={message.own ? "message-row own" : "message-row"}>
              <span className="message-avatar">{getInitials(message.own ? profileName : message.author)}</span>
              <div className="message-bubble">
                <div className="message-author-line">
                  <strong>{message.own ? profileName : message.author}</strong>
                  <time>{message.time}</time>
                </div>
                <p>{message.text}</p>
                {statusLabel && <span className={`message-status ${message.status || "sent"}`}>{statusLabel}</span>}
              </div>
            </article>
          );
        })}
      </div>

      {typingUser && <div className="typing-indicator">{typingUser} печатает…</div>}

      {composerEnabled ? (
        <form className="composer" onSubmit={onSend}>
          <button type="button" aria-label="Прикрепить файл">+</button>
          <input
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder={`Сообщение для ${activeThread.name}`}
          />
          <button type="submit">Отправить</button>
        </form>
      ) : (
        <div className="composer composer-disabled">Отправка сообщений отключена feature flag.</div>
      )}
    </main>
  );
}
