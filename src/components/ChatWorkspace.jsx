import { useState } from "react";

const spaces = [
  { id: "direct", icon: "@", label: "DM", title: "Личные" },
  { id: "team", icon: "#", label: "TEAM", title: "Команда" },
  { id: "voice", icon: "◉", label: "LIVE", title: "Голос" },
];

const threads = [
  {
    id: "general",
    type: "channel",
    space: "team",
    name: "# general",
    description: "Общий канал проекта",
    unread: 4,
    status: "online",
    members: 18,
    topic: "Новости, быстрые апдейты и решения по Project_403.",
    messages: [
      { id: 1, author: "Mira", role: "frontend", time: "10:12", text: "Собрала первый экран workspace: слева каналы, в центре чат, справа детали." },
      { id: 2, author: "Alex", role: "backend", time: "10:14", text: "Ок, backend пока можно не трогать. Главное — заложить нормальную структуру под будущие API." },
      { id: 3, author: "You", own: true, role: "owner", time: "10:18", text: "Давайте оставим простую логику, но интерфейс сделаем похожим на реальное приложение." },
    ],
  },
  {
    id: "dev-room",
    type: "group",
    space: "team",
    name: "Dev room",
    description: "Закрытая группа разработки",
    unread: 2,
    status: "busy",
    members: 6,
    topic: "Обсуждение auth, ролей, feature flags и инфраструктуры.",
    messages: [
      { id: 1, author: "Nikita", role: "infra", time: "09:44", text: "Redis пока оставим за флагом. Для локального режима хватит in-memory заглушки." },
      { id: 2, author: "You", own: true, role: "owner", time: "09:49", text: "Да, не усложняем. Главное — не завязать UI на то, чего ещё нет." },
    ],
  },
  {
    id: "alice",
    type: "direct",
    space: "direct",
    name: "Alice Morgan",
    description: "личные сообщения",
    unread: 0,
    status: "online",
    members: 2,
    topic: "Персональный диалог без шума каналов.",
    messages: [
      { id: 1, author: "Alice", role: "designer", time: "Вчера", text: "Можно сделать карточки каналов более компактными на мобильном?" },
      { id: 2, author: "You", own: true, role: "owner", time: "Вчера", text: "Да, добавлю адаптивный режим и сохраню текущую тему." },
    ],
  },
  {
    id: "release",
    type: "channel",
    space: "team",
    name: "# release",
    description: "релизы и чек-листы",
    unread: 0,
    status: "offline",
    members: 9,
    topic: "Стабилизация, проверка сборок и подготовка changelog.",
    messages: [
      { id: 1, author: "Mira", role: "frontend", time: "08:20", text: "Frontend lint и build зелёные. Нужен только финальный smoke test." },
    ],
  },
];

const quickActions = ["Новый чат", "Создать канал", "Группа", "Invite"];

function getProfileName(profile) {
  return profile?.name || profile?.tag || profile?.handle || "User";
}

function getInitials(name) {
  return String(name || "U")
    .split(/[\s_.@-]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function ChatWorkspace({ profile, projectName }) {
  const [space, setSpace] = useState("team");
  const [activeThreadId, setActiveThreadId] = useState("general");
  const [draft, setDraft] = useState("");
  const [localMessages, setLocalMessages] = useState({});

  const visibleThreads = threads.filter((thread) => thread.space === space);
  const activeThread = threads.find((thread) => thread.id === activeThreadId) || visibleThreads[0] || threads[0];
  const currentMessages = [...activeThread.messages, ...(localMessages[activeThread.id] || [])];
  const profileName = getProfileName(profile);

  const handleSpaceChange = (nextSpace) => {
    setSpace(nextSpace);
    const firstThread = threads.find((thread) => thread.space === nextSpace);
    if (firstThread) setActiveThreadId(firstThread.id);
  };

  const handleSend = (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;

    setLocalMessages((current) => ({
      ...current,
      [activeThread.id]: [
        ...(current[activeThread.id] || []),
        {
          id: `${activeThread.id}-${Date.now()}`,
          author: "You",
          own: true,
          role: profile?.role || "user",
          time: "сейчас",
          text,
        },
      ],
    }));
    setDraft("");
  };

  return (
    <section className="chat-workspace" aria-label="Messenger workspace">
      <aside className="workspace-rail" aria-label="Разделы">
        <div className="workspace-logo">{getInitials(projectName)}</div>
        <nav className="space-nav">
          {spaces.map((item) => (
            <button
              key={item.id}
              className={item.id === space ? "space-button active" : "space-button"}
              type="button"
              onClick={() => handleSpaceChange(item.id)}
              title={item.title}
            >
              <span>{item.icon}</span>
              <small>{item.label}</small>
            </button>
          ))}
        </nav>
      </aside>

      <aside className="workspace-sidebar">
        <div className="workspace-sidebar-head">
          <div>
            <p className="workspace-kicker">Project hub</p>
            <h1>{projectName}</h1>
          </div>
          <button className="workspace-icon-button" type="button" aria-label="Создать чат">+</button>
        </div>

        <div className="workspace-search">
          <span aria-hidden="true">⌕</span>
          <input type="search" placeholder="Поиск чатов, групп, каналов" />
        </div>

        <div className="quick-actions">
          {quickActions.map((action) => (
            <button key={action} type="button">{action}</button>
          ))}
        </div>

        <div className="thread-section-title">Активные диалоги</div>
        <div className="thread-list">
          {visibleThreads.map((thread) => (
            <button
              key={thread.id}
              className={thread.id === activeThread.id ? "thread-card active" : "thread-card"}
              type="button"
              onClick={() => setActiveThreadId(thread.id)}
            >
              <span className={`thread-avatar ${thread.status}`}>{getInitials(thread.name)}</span>
              <span className="thread-meta">
                <strong>{thread.name}</strong>
                <small>{thread.description}</small>
              </span>
              {thread.unread > 0 && <span className="thread-badge">{thread.unread}</span>}
            </button>
          ))}
        </div>
      </aside>

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
          {currentMessages.map((message) => (
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

        <form className="composer" onSubmit={handleSend}>
          <button type="button" aria-label="Прикрепить файл">+</button>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={`Сообщение в ${activeThread.name}`}
          />
          <button type="submit">Отправить</button>
        </form>
      </main>

      <aside className="workspace-details">
        <div className="details-card profile-card">
          <span className="details-avatar">{getInitials(activeThread.name)}</span>
          <h2>{activeThread.name}</h2>
          <p>{activeThread.topic}</p>
        </div>

        <div className="details-card">
          <h3>Контекст</h3>
          <dl className="details-list">
            <div><dt>Тип</dt><dd>{activeThread.type}</dd></div>
            <div><dt>Участники</dt><dd>{activeThread.members}</dd></div>
            <div><dt>Статус</dt><dd>{activeThread.status}</dd></div>
          </dl>
        </div>

        <div className="details-card">
          <h3>План ближайших шагов</h3>
          <ul className="workspace-todo">
            <li>Подключить реальные endpoints сообщений.</li>
            <li>Добавить модель каналов и участников.</li>
            <li>Заменить локальный state на WebSocket/long polling.</li>
          </ul>
        </div>
      </aside>
    </section>
  );
}
