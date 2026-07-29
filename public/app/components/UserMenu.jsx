import { useEffect, useRef, useState } from "react";
import { useAuthSession } from "../auth/AuthSessionProvider";
import { Icon } from "./Icon";

export function UserMenu() {
  const { logout, user } = useAuthSession();
  const [open, setOpen] = useState(false);
  const menuReference = useRef();

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const closeMenu = (event) => {
      if (
        event.key === "Escape" ||
        !menuReference.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", closeMenu);
    document.addEventListener("mousedown", closeMenu);

    return () => {
      document.removeEventListener("keydown", closeMenu);
      document.removeEventListener("mousedown", closeMenu);
    };
  }, [open]);

  return (
    <div className="user-menu" ref={menuReference}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Open ${user.displayName} account menu`}
        className="user-avatar"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        {user.initial}
      </button>

      {open && (
        <div className="user-menu-popover" role="menu">
          <div className="user-menu-identity">
            <span className="user-menu-avatar">{user.initial}</span>
            <span>
              <strong>{user.displayName}</strong>
              <small>
                {user.role === "owner"
                  ? "Owner"
                  : user.role === "guest"
                    ? "Guest access"
                    : "Member"}
              </small>
            </span>
          </div>
          <button onClick={logout} role="menuitem" type="button">
            <Icon name="logout" size={16} />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
