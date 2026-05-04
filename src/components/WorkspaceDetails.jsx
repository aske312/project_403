import { getInitials } from "../utils/workspaceUtils";

export default function WorkspaceDetails({ thread, onClose }) {
  return (
    <aside className="workspace-details">
      <div className="details-card profile-card">
        <button className="details-close" type="button" onClick={onClose} aria-label="Закрыть информацию">×</button>
        <span className="details-avatar">{getInitials(thread.name)}</span>
        <h2>{thread.name}</h2>
        <p>{thread.type === "direct" ? "Карточка собеседника и контекст переписки." : thread.topic}</p>
      </div>

      <div className="details-card">
        <h3>Информация</h3>
        <dl className="details-list">
          <div><dt>Тип</dt><dd>{thread.type === "direct" ? "Личный чат" : thread.type}</dd></div>
          <div><dt>Участники</dt><dd>{Array.isArray(thread.members) ? thread.members.join(", ") : thread.members}</dd></div>
          <div><dt>Статус</dt><dd>{thread.status}</dd></div>
        </dl>
      </div>

      <div className="details-card muted-card">
        <h3>Скоро</h3>
        <p>Закрепы, медиа, файлы и управление уведомлениями будут подключаться отдельными feature flags.</p>
      </div>
    </aside>
  );
}
