import { getInitials } from "../utils/workspaceUtils";

export default function WorkspaceDetails({ thread }) {
  return (
    <aside className="workspace-details">
      <div className="details-card profile-card">
        <span className="details-avatar">{getInitials(thread.name)}</span>
        <h2>{thread.name}</h2>
        <p>{thread.topic}</p>
      </div>

      <div className="details-card">
        <h3>Контекст</h3>
        <dl className="details-list">
          <div><dt>Тип</dt><dd>{thread.type}</dd></div>
          <div><dt>Участники</dt><dd>{thread.members}</dd></div>
          <div><dt>Статус</dt><dd>{thread.status}</dd></div>
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
  );
}
