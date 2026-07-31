import { Icon } from "./Icon";
import { permissions } from "../auth/permissions";
import { useAuthSession } from "../auth/AuthSessionProvider";
import { UserMenu } from "./UserMenu";

const navigationSections = [
  {
    label: "Workspace",
    links: [
      {
        href: "/",
        icon: "upload",
        key: "upload",
        label: "Upload",
        mobileLabel: "Upload"
      },
      {
        href: "/dashboard.html",
        icon: "grid",
        key: "dashboard",
        label: "Dashboard",
        mobileLabel: "Dashboard"
      }
    ]
  },
  {
    label: "Storage",
    links: [
      {
        href: "/manageFiles.html",
        icon: "folder",
        key: "files",
        label: "Manage Files",
        mobileLabel: "Files",
        requiredPermission: permissions.listFiles
      },
      {
        href: "/availableStorage.html",
        icon: "archive",
        key: "storage",
        label: "Available storage",
        mobileLabel: "Storage",
        requiredPermission: permissions.listFiles
      }
    ]
  }
];

const topNavigationLinks = [
  {
    href: "/",
    key: "upload",
    label: "Home"
  },
  {
    href: "/manageFiles.html",
    key: "files",
    label: "Manage Files",
    requiredPermission: permissions.listFiles
  }
];

function NavigationLink({ activePage, compact, hasPermission, link }) {
  const disabled =
    link.disabled ||
    (link.requiredPermission && !hasPermission(link.requiredPermission));

  return (
    <a
      aria-current={activePage === link.key ? "page" : undefined}
      aria-disabled={disabled ? "true" : undefined}
      aria-label={compact ? link.label : undefined}
      className={
        `${compact ? "mobile-navigation-link" : "rail-link"}` +
        `${activePage === link.key ? " is-active" : ""}`
      }
      href={disabled ? "#" : link.href}
      onClick={disabled ? (event) => event.preventDefault() : undefined}
      tabIndex={disabled ? -1 : undefined}
      title={
        disabled && link.requiredPermission
          ? "Your account cannot access this page"
          : link.label
      }
    >
      <Icon
        name={link.icon}
        size={link.icon === "folder" ? 19 : 18}
      />
      <span>{compact ? link.mobileLabel || link.label : link.label}</span>
    </a>
  );
}

export function AppShell({ activePage, children }) {
  const { hasPermission } = useAuthSession();

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Cloud Storage home">
          <img
            className="brand-logo"
            src="/CloudDisLogo.png"
            alt="Cloud Storage Distributor"
          />
        </a>
        <div className="topbar-actions">
          <nav aria-label="Primary navigation">
            {topNavigationLinks
              .filter(
                (link) =>
                  !link.requiredPermission ||
                  hasPermission(link.requiredPermission)
              )
              .map((link) => (
                <a
                  aria-current={
                    activePage === link.key ? "page" : undefined
                  }
                  className={
                    activePage === link.key ? "is-active" : ""
                  }
                  href={link.href}
                  key={link.key}
                >
                  {link.label}
                </a>
              ))}
          </nav>
          <UserMenu />
        </div>
      </header>

      <div className="workspace">
        <aside className="side-rail" aria-label="Workspace sections">
          {navigationSections.map((section) => (
            <div className="rail-group" key={section.label}>
              <span className="rail-label">{section.label}</span>
              {section.links.map((link) => (
                <NavigationLink
                  activePage={activePage}
                  hasPermission={hasPermission}
                  key={link.key}
                  link={link}
                />
              ))}
            </div>
          ))}

          <div className="rail-footer">
            <div className="mini-shield">
              <Icon name="lock" size={17} />
            </div>
            <div>
              <strong>Server secured</strong>
              <span>Secrets stay in src</span>
            </div>
          </div>
        </aside>

        {children}
      </div>

      <nav aria-label="Mobile navigation" className="mobile-navigation">
        {navigationSections.flatMap((section) =>
          section.links.map((link) => (
            <NavigationLink
              activePage={activePage}
              compact
              hasPermission={hasPermission}
              key={link.key}
              link={link}
            />
          ))
        )}
      </nav>
    </div>
  );
}
