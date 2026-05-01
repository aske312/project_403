import { useState } from "react";

export default function AdminCommandsSection({
  t,
  feedback,
  restartOptions,
  restartBusy,
  onRestart,
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="commands-section" aria-label={t.commands}>
      <button
        aria-expanded={open}
        className="commands-toggle"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span>{t.commands}</span>
        <span className={`arrow ${open ? "open" : ""}`} aria-hidden="true" />
      </button>

      {open && (
        <div className="commands-body">
          <div className="command-grid">
            <details className="command-menu">
              <summary className="command-button">
                {restartBusy ? t.commandRunning : t.commandRestart}
              </summary>
              <div className="command-menu-list">
                {restartOptions.map((option) => (
                  <button
                    disabled={Boolean(restartBusy)}
                    key={option.id}
                    onClick={() => onRestart(option.id)}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </details>
          </div>

          {feedback && (
            <div className={`command-feedback ${feedback.state}`}>
              {feedback.text}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
