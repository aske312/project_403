import { getInitials, getProfileName } from "../utils/workspaceUtils";

export default function ChatPanel({ activeThread, messages, profile, composerEnabled, draft, onDraftChange, onSend, typingUser, onToggleDetails }) {
  const profileName = getProfileName(profile);
  const isDirect = activeThread.type === "direct";

  return (
    <main className="chat-panel">
      <header className="chat-panel-head">
        <button className="chat-title-button" type="button" onClick={onToggleDetails} aria-label="Открыть информацию о чате">
          <span className={`thread-avatar ${activeThread.status}`}>{getInitials(activeThread.name)}</span>
          <span>
            <p className="workspace-kicker">{isDirect ? "Direct message" : activeThread.type}</p>
            <h2>{activeThread.name}</h2>
            <small>{isDirect ? "Нажмите на название, чтобы открыть карточку собеседника" : activeThread.topic}</small>
          </span>
        </button>
      </header>

      <div className="message-feed">
        {messages.map((message) => (
          <article key={message.id} className={message.own ? "message-row own" : "message-row"}>
            <span className="message-avatar">{getInitials(message.author)}</span>
            <div className="message-bubble">
              <div className="message-author-line">
                <strong>{message.own ? profileName : message.author}</strong>
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
