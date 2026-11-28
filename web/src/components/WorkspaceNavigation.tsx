import type { CSSProperties } from "react";

type NavigationItem = {
  id: string;
  label: string;
  icon: string;
};

type WorkspaceNavigationProps = {
  items: NavigationItem[];
  selectedId: string;
  pendingCount: number;
  displayName: string;
  email: string;
  onNavigate: (id: string) => void;
  onSignOut: () => void;
};

/**
 * Functional 3D navigation rail. The cards are real navigation buttons;
 * pointer tilt only adds depth and never changes their hit area or meaning.
 */
export default function WorkspaceNavigation({
  items,
  selectedId,
  pendingCount,
  displayName,
  email,
  onNavigate,
  onSignOut,
}: WorkspaceNavigationProps) {
  return (
    <aside className="sidebar workspace-sidebar">
      <div className="brand-lockup">
        <div className="brand-mark">S</div>
        <span>Saral Form</span>
      </div>

      <div className="workspace-nav-heading">
        <span className="workspace-label">YOUR WORKSPACE</span>
        <span className="workspace-nav-hint">Choose a space</span>
      </div>

      <nav className="nav-deck" aria-label="Main navigation">
        {items.map((item, index) => {
          const active = selectedId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={active ? "nav-card active" : "nav-card"}
              aria-current={active ? "page" : undefined}
              onClick={() => onNavigate(item.id)}
              onPointerMove={(event) => {
                if (event.pointerType !== "mouse") return;
                const bounds = event.currentTarget.getBoundingClientRect();
                const x = (event.clientX - bounds.left) / bounds.width - 0.5;
                const y = (event.clientY - bounds.top) / bounds.height - 0.5;
                event.currentTarget.style.setProperty("--nav-rx", `${(-y * 5).toFixed(2)}deg`);
                event.currentTarget.style.setProperty("--nav-ry", `${(x * 5).toFixed(2)}deg`);
              }}
              onPointerLeave={(event) => {
                event.currentTarget.style.setProperty("--nav-rx", "0deg");
                event.currentTarget.style.setProperty("--nav-ry", "0deg");
              }}
              style={{ "--nav-order": index } as CSSProperties}
            >
              <span className="nav-card-icon" aria-hidden="true">{item.icon}</span>
              <span className="nav-card-label">{item.label}</span>
              <span className="nav-card-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              {item.id === "profile" && pendingCount > 0 && (
                <span className="nav-card-count" aria-label={pendingCount + " details waiting for review"}>
                  {pendingCount > 99 ? "99+" : pendingCount}
                </span>
              )}
              <span className="nav-card-edge" aria-hidden="true" />
            </button>
          );
        })}
      </nav>

      <div className="sidebar-bottom">
        <div className="user-card">
          <div className="avatar">{(displayName || email || "S").slice(0, 1).toUpperCase()}</div>
          <div className="user-meta">
            <strong>{displayName}</strong>
            <span>{email}</span>
          </div>
          <button className="icon-button signout" onClick={onSignOut} title="Sign out" aria-label="Sign out">↗</button>
        </div>
      </div>
    </aside>
  );
}
