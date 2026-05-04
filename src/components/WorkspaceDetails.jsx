export default function WorkspaceDetails({ thread, open, titleDraft, onTitleDraftChange, onSaveTitle, onClose }) {
  if (!open || !thread) return null;

  return (
    <aside className="workspace-details dialog-details">
      <div className="details-card">
        <div className="details-headline">
          <div>
            <p className="workspace-kicker">Настройки диалога</p>
            <h2>{thread.name}</h2>
          </div>
          <button type="button" className="workspace-icon-button" onClick={onClose}>×</button>
        </div>
        <label className="dialog-title-editor">
          <span>Название чата</span>
          <input value={titleDraft} onChange={(event) => onTitleDraftChange(event.target.value)} />
        </label>
        <button className="details-primary-button" type="button" onClick={onSaveTitle}>Сохранить название</button>
      </div>
      <div className="details-card">
        <h3>Собеседники</h3>
        <div className="details-list">
          {(thread.memberItems || []).map((member) => (
            <div key={member.id || member.tag}>
              <dt>{member.name}</dt>
              <dd>{member.tag || member.role}</dd>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
