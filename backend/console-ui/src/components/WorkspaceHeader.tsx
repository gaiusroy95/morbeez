import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { initials, roleLabel } from '../lib/format';
import { NavIcon } from './NavIcon';

export type WorkspaceHeaderSearch = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  onFocus?: () => void;
  onBlur?: () => void;
  dropdown?: ReactNode;
};

export type WorkspaceHeaderPrimaryAction = {
  label: string;
  onClick: () => void;
  hidden?: boolean;
};

type Props = {
  title: string;
  onOpenMenu: () => void;
  onLogout: () => void;
  search?: WorkspaceHeaderSearch;
  primaryAction?: WorkspaceHeaderPrimaryAction;
  /** Renders between primary action and utility icons (e.g. WhatsApp, Call). */
  trailingActions?: ReactNode;
  showDate?: boolean;
  dateText?: string;
  notificationCount?: number;
  onNotificationsClick?: () => void;
  menuAlwaysVisible?: boolean;
};

function ProfileBlock({
  onLogout,
}: {
  onLogout: () => void;
}) {
  const { admin } = useAuth();
  const profileBtnRef = useRef<HTMLButtonElement>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  const displayName = admin?.fullName ?? admin?.email ?? 'Admin';
  const avatar = initials(displayName);
  const role = roleLabel(admin?.role ?? 'admin');

  useLayoutEffect(() => {
    if (!profileOpen || !profileBtnRef.current) {
      setMenuPos(null);
      return;
    }
    const rect = profileBtnRef.current.getBoundingClientRect();
    const menuWidth = 220;
    const left = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8));
    setMenuPos({ top: rect.bottom + 8, left });
  }, [profileOpen]);

  useEffect(() => {
    if (!profileOpen) return;
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (profileBtnRef.current?.contains(target)) return;
      if ((target as HTMLElement).closest?.('.console-profile-menu--portal')) return;
      setProfileOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setProfileOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [profileOpen]);

  const profileMenu =
    profileOpen && menuPos
      ? createPortal(
          <div
            className="console-profile-menu console-profile-menu--portal"
            role="menu"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            <div className="console-profile-menu-head">
              <span className="avatar">{avatar}</span>
              <div>
                <strong>{displayName}</strong>
                <small>{role}</small>
              </div>
            </div>
            <button
              type="button"
              role="menuitem"
              className="console-profile-menu-item"
              onClick={() => {
                setProfileOpen(false);
                onLogout();
              }}
            >
              Sign out
            </button>
          </div>,
          document.body
        )
      : null;

  return (
    <div className="console-topbar-user-wrap">
      <button
        ref={profileBtnRef}
        type="button"
        className="console-topbar-user"
        aria-expanded={profileOpen}
        aria-haspopup="menu"
        onClick={() => setProfileOpen((v) => !v)}
      >
        <span className="avatar avatar-sm console-topbar-avatar">{avatar}</span>
        <span className="console-user-text">
          <strong>{displayName.split(' ')[0] || 'Admin'}</strong>
          <small>{role}</small>
        </span>
        <span className="console-user-chevron" aria-hidden>
          ▾
        </span>
      </button>
      {profileMenu}
    </div>
  );
}

export function WorkspaceHeader({
  title,
  onOpenMenu,
  onLogout,
  search,
  primaryAction,
  trailingActions,
  showDate = false,
  dateText = '',
  notificationCount = 0,
  onNotificationsClick,
  menuAlwaysVisible = false,
}: Props) {
  const searchRef = useRef<HTMLInputElement>(null);
  const searchId = search?.id ?? 'console-global-search';

  useEffect(() => {
    if (!search) return;
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [search]);

  return (
    <header
      className={`topbar console-topbar-shell${menuAlwaysVisible ? ' console-topbar-shell--menu-always' : ''}`}
      role="banner"
    >
      <div className="console-topbar-left">
        <button
          type="button"
          className="btn-menu console-btn-menu"
          aria-label="Open menu"
          onClick={onOpenMenu}
        >
          <span />
          <span />
          <span />
        </button>
        <h1 className="console-topbar-title">{title}</h1>
      </div>

      {search ? (
        <div className="console-topbar-center">
          <div className="console-topbar-search-host">
            <label className="console-topbar-search" htmlFor={searchId}>
              <span className="console-search-icon" aria-hidden>
                <svg
                  className="console-search-svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3-3" strokeLinecap="round" />
                </svg>
              </span>
              <input
                id={searchId}
                ref={searchRef}
                type="search"
                placeholder={search.placeholder}
                value={search.value}
                onChange={(e) => search.onChange(e.target.value)}
                onFocus={search.onFocus}
                onBlur={search.onBlur}
                autoComplete="off"
              />
              <kbd className="console-search-kbd" aria-hidden>
                Ctrl + K
              </kbd>
            </label>
            {search.dropdown}
          </div>
        </div>
      ) : (
        <div className="console-topbar-center console-topbar-center--spacer" aria-hidden />
      )}

      <div className="console-topbar-right">
        {primaryAction && !primaryAction.hidden ? (
          <button type="button" className="btn btn-primary console-btn-primary-action" onClick={primaryAction.onClick}>
            <span className="console-add-icon" aria-hidden>
              +
            </span>
            {primaryAction.label}
          </button>
        ) : null}

        {trailingActions}

        {showDate && dateText ? (
          <div className="console-date-pill">
            <NavIcon name="calendar" className="console-date-pill-icon" />
            <span>{dateText}</span>
          </div>
        ) : null}

        <button
          type="button"
          className="tool-btn tool-btn-bell"
          aria-label="Notifications"
          onClick={onNotificationsClick}
        >
          <NavIcon name="bell" className="icon-tool" />
          {notificationCount > 0 ? (
            <span className="bell-badge">{notificationCount > 99 ? '99+' : notificationCount}</span>
          ) : null}
        </button>

        <ProfileBlock onLogout={onLogout} />
      </div>
    </header>
  );
}
