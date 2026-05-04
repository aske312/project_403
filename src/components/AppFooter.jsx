import "../styles/layout.css";

export default function AppFooter({
  variant = "auth",
  statusState,
  version,
  onlineUsers,
  canViewOnlineUsers = false,
  links,
}) {
  const footerClassName = `app-footer app-footer-${variant}`;
  const statusClassName = ["app-status-dot", statusState].filter(Boolean).join(" ");
  const showOnlineUsers =
    Number.isFinite(onlineUsers) && (statusState === "dev" || canViewOnlineUsers);
  const showVersion = statusState === "dev" && version;

  return (
    <footer className={footerClassName}>
      <div className="app-footer-status">
        <span className={statusClassName} aria-hidden="true" />
        {showOnlineUsers && (
          <span className="app-footer-online" title="Users online">
            online {onlineUsers}
          </span>
        )}
        {showVersion && <span className="app-footer-version">{version}</span>}
      </div>

      <nav className="app-footer-links" aria-label="Footer">
        {links.map((link) => {
          const isExternal = /^https?:\/\//.test(link.href);

          return (
            <a
              key={`${link.href}-${link.label}`}
              href={link.href}
              rel={isExternal ? "noreferrer" : undefined}
              target={isExternal ? "_blank" : undefined}
            >
              {link.label}
            </a>
          );
        })}
      </nav>
    </footer>
  );
}
