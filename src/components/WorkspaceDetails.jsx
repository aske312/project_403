import { getInitials } from "../utils/workspaceUtils";

export default function WorkspaceDetails({ thread, open, titleDraft, onTitleDraftChange, onSaveTitle, onClose }) {
  if (!open || !thread) return null;

  return (
    <aside className="messenger-details">
      <div className="details-header">
        <button type="button" className="details-close" onClick={onClose}>×</button>
        <span className="details-avatar">{getInitials(thread.name)}</span>
        <h2>{thread.name}</h2>
        <p>{thread.topic || thread.description || "Настройки и информация диалога"}</p>
      </div>

      <section className="details-card">
        <h3>Название</h3>
        <label className="dialog-title-editor">
          <span>Можно переименовать локальный DEV-чат</span>
          <input value={titleDraft} onChange={(event) => onTitleDraftChange(event.target.value)} />
        </label>
        <button className="details-primary-button" type="button" onClick={onSaveTitle}>Сохранить</button>
      </section>

      <section className="details-card">
        <h3>Собеседники</h3>
        <div className="member-list">
          {(thread.memberItems || []).map((member) => (
            <div key={member.id || member.tag} className="member-row">
              <span className="contact-avatar">{getInitials(member.name)}</span>
              <span>
                <strong>{member.name}</strong>
                <small>{member.tag || member.role}</small>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="details-card muted-card">
        <h3>Будущие функции</h3>
        <p>Медиа, файлы, роли, реакции, треды и права доступа можно добавить в эту панель без перестройки layout.</p>
      </section>
    </aside>
  );
}
