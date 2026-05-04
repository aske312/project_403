import { getInitials, getProfileName } from "../utils/workspaceUtils";

export default function ChatPanel({ activeThread, messages, profile, composerEnabled, draft, onDraftChange, onSend, typingUser }) {
  const profileName = getProfileName(profile);

  return (
    <main className="chat-panel">
      <header className="chat-panel-head">
        <div>
          <p className="workspace-kicker">{activeThread.type === "direct" ? "Direct message" : activeThread.type}</p>
          <h2>{activeThread.name}</h2>
          <span>{activeThread.topic}</span>
        </div>
        <div className="chat-head-actions">
          <button type="button">Звонок</button>
          <button type="button">Файлы</button>
        </div>
      </header>

      <div className="message-feed">
        {messages.map((message) => (
          <article key={message.id} className={message.own ? "message-row own" : "message-row"}>
            <span className="message-avatar">{getInitials(message.author)}</span>
            <div className="message-bubble">
              <div className="message-author-line">
                <strong>{message.own ? profileName : message.author}</strong>
                <span>{message.role}</span>
                <time>{message.time}</time>
              </div>
              <p>{message.text}</p>
            </div>
          </article>
        ))}
      </div>

      {typingUser && <div className="typing-indicator">{typingUser} печатает…</div>}

      {composerEnabled ? (
        <form className="composer" onSubmit={onSend}>
          <button type="button" aria-label="Прикрепить файл">+</button>
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
