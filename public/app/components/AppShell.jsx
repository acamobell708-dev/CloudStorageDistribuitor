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
        label: "Upload"
      },
      {
        href: "/dashboard.html",
        icon: "grid",
        key: "dashboard",
        label: "Dashboard"
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
        requiredPermission: permissions.listFiles
      },
      {
        href: "/availableStorage.html",
        icon: "archive",
        key: "storage",
        label: "Available storage",
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

export function AppShell({ activePage, children }) {
  const { hasPermission } = useAuthSession();

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Cloud Storage home">
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span>
            CLOUD<span>PORT</span>
          </span>
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
              {section.links.map((link) => {
                const disabled =
                  link.disabled ||
                  (link.requiredPermission &&
                    !hasPermission(link.requiredPermission));

                return (
                  <a
                    aria-current={
                      activePage === link.key ? "page" : undefined
                    }
                    aria-disabled={disabled ? "true" : undefined}
                    className={
                      activePage === link.key
                        ? "rail-link is-active"
                        : "rail-link"
                    }
                    href={disabled ? "#" : link.href}
                    key={link.key}
                    onClick={
                      disabled
                        ? (event) => event.preventDefault()
                        : undefined
                    }
                    title={
                      disabled && link.requiredPermission
                        ? "Guest accounts cannot manage files"
                        : undefined
                    }
                  >
                    <Icon
                      name={link.icon}
                      size={link.icon === "folder" ? 19 : 18}
                    />
                    <span>{link.label}</span>
                  </a>
                );
              })}
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
    </div>
  );
}
