import "../styles/layout.css";

function getInitials(name) {
  return String(name || "P")
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

export default function AppHeader({
  variant = "auth",
  projectName,
  projectHref,
  theme,
  lang,
  t,
  profile,
  accountOpen,
  onToggleAccount,
  onToggleLang,
  onToggleTheme,
  onLogout,
  adminLinkVisible = false,
  adminLinkHref = "/admin",
  adminLinkLabel,
}) {
  const brandContent = (
    <>
      <span className="app-brand-mark">{getInitials(projectName)}</span>
      <span>{projectName}</span>
    </>
  );
  const BrandTag = projectHref ? "a" : "div";
  const brandProps = projectHref ? { href: projectHref } : {};

  return (
    <header className={`app-header app-header-${variant}`}>
      <BrandTag className="app-brand" {...brandProps}>
        {brandContent}
      </BrandTag>

      <div className="app-header-actions">
        <button
          className="app-language-switch"
          type="button"
          onClick={onToggleLang}
          aria-label={t.language}
          title={t.language}
        >
          <img src={lang === "RU" ? "/uk.png" : "/ru.png"} alt="" />
          <span>{t.language}</span>
        </button>

        <button className="app-theme-switch" type="button" onClick={onToggleTheme}>
          {theme === "light" ? t.themeDark : t.themeLight}
        </button>

        {profile && (
          <div className="app-account-menu">
            <button
              className="app-account-button"
              type="button"
              onClick={onToggleAccount}
              aria-expanded={accountOpen}
              aria-haspopup="menu"
              title={t.accountMenu}
            >
              <span className="app-account-avatar" aria-hidden="true">
                {profile.name?.[0]?.toUpperCase() || "U"}
              </span>
            </button>

            {accountOpen && (
              <div className="app-account-dropdown" role="menu">
                <div className="app-account-name">{profile.name}</div>
                <div className="app-account-tag">{profile.tag || `@${profile.handle}`}</div>
                <div className="app-account-description">
                  {adminLinkVisible ? (
                    <a className="app-account-link" href={adminLinkHref} role="menuitem">
                      {adminLinkLabel}
                    </a>
                  ) : (
                    <div>{t.accountStub}</div>
                  )}
                </div>
                {onLogout && (
                  <button className="app-account-logout" type="button" onClick={onLogout} role="menuitem">
                    {t.logout}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
