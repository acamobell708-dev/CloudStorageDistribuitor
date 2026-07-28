import { Icon } from "./Icon";

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
        href: "/viewFiles.html",
        icon: "folder",
        key: "files",
        label: "View Files"
      },
      {
        disabled: true,
        href: "#",
        icon: "archive",
        key: "storage",
        label: "Available storage"
      }
    ]
  }
];

export function AppShell({ activePage, children }) {
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
        <nav aria-label="Primary navigation">
          <a className={activePage === "upload" ? "is-active" : ""} href="/">
            Home
          </a>
        </nav>
      </header>

      <div className="workspace">
        <aside className="side-rail" aria-label="Workspace sections">
          {navigationSections.map((section) => (
            <div className="rail-group" key={section.label}>
              <span className="rail-label">{section.label}</span>
              {section.links.map((link) => (
                <a
                  aria-current={activePage === link.key ? "page" : undefined}
                  aria-disabled={link.disabled ? "true" : undefined}
                  className={
                    activePage === link.key
                      ? "rail-link is-active"
                      : "rail-link"
                  }
                  href={link.href}
                  key={link.key}
                  onClick={
                    link.disabled
                      ? (event) => event.preventDefault()
                      : undefined
                  }
                >
                  <Icon
                    name={link.icon}
                    size={link.icon === "folder" ? 19 : 18}
                  />
                  <span>{link.label}</span>
                </a>
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
    </div>
  );
}
