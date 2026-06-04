import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { NavIcon } from './NavIcon';
import {
  defaultExpandedGroups,
  filterNav,
  isNavItemActive,
  type NavGroup,
  type NavItem,
} from '../lib/console-nav';
import { paths, toPath } from '../lib/routes';
import type { ApiModule } from '../lib/api';
import { cn } from '../lib/cn';

type Props = {
  modules: ApiModule[];
  collapsed?: boolean;
};

function isGroupActive(pathname: string, group: NavGroup): boolean {
  return group.children.some((c) => isNavItemActive(pathname, c.path));
}

export function SidebarNav({ modules, collapsed = false }: Props) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const groups = useMemo(() => filterNav(modules), [modules]);
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    try {
      const saved = window.localStorage.getItem('console.sidebar.expandedGroup');
      if (saved) return new Set([saved]);
    } catch {
      /* ignore storage failures */
    }
    const defaults = defaultExpandedGroups(pathname);
    return defaults.length > 0 ? new Set([defaults[0]]) : new Set();
  });
  const [flyoutGroupId, setFlyoutGroupId] = useState<string | null>(null);
  const [flyoutPos, setFlyoutPos] = useState({ top: 0, left: 0 });
  const flyoutAnchorRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const activeGroup = groups.find((group) => !('items' in group) && isGroupActive(pathname, group));
    if (!activeGroup || 'items' in activeGroup) return;
    setExpanded(new Set([activeGroup.id]));
  }, [groups, pathname]);

  useEffect(() => {
    setFlyoutGroupId(null);
  }, [pathname, collapsed]);

  useEffect(() => {
    if (!flyoutGroupId) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setFlyoutGroupId(null);
    }

    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (flyoutAnchorRef.current?.contains(target)) return;
      const panel = document.getElementById('sidebar-flyout-panel');
      if (panel?.contains(target)) return;
      setFlyoutGroupId(null);
    }

    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [flyoutGroupId]);

  useLayoutEffect(() => {
    if (!flyoutGroupId || !flyoutAnchorRef.current) return;

    function place() {
      const anchor = flyoutAnchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const panelWidth = 220;
      const margin = 8;
      let left = rect.right + margin;
      let top = rect.top;

      if (left + panelWidth > window.innerWidth - margin) {
        left = Math.max(margin, rect.left - panelWidth - margin);
      }

      const maxTop = window.innerHeight - margin - 40;
      top = Math.min(Math.max(margin, top), maxTop);

      setFlyoutPos({ top, left });
    }

    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [flyoutGroupId]);

  function toggleGroup(id: string) {
    setExpanded((prev) => {
      const next = new Set<string>();
      if (!prev.has(id)) next.add(id);
      try {
        const selected = next.values().next().value as string | undefined;
        if (selected) window.localStorage.setItem('console.sidebar.expandedGroup', selected);
        else window.localStorage.removeItem('console.sidebar.expandedGroup');
      } catch {
        /* ignore storage failures */
      }
      return next;
    });
  }

  function handleGroupClick(g: NavGroup) {
    if (!collapsed) {
      toggleGroup(g.id);
      return;
    }

    if (g.children.length === 1) {
      navigate(g.children[0].path);
    }
  }

  function openFlyout(g: NavGroup, anchor: HTMLButtonElement) {
    setFlyoutGroupId((current) => {
      if (current === g.id) {
        flyoutAnchorRef.current = null;
        return null;
      }
      flyoutAnchorRef.current = anchor;
      return g.id;
    });
  }

  function linkClassName(isActive: boolean, base: string) {
    return cn(base, isActive && 'active');
  }

  function renderItem(item: NavItem, baseClass: string) {
    if (item.external) {
      return (
        <li key={item.id}>
          <a
            href={item.path}
            target="_blank"
            rel="noopener noreferrer"
            className={baseClass}
            title={item.label}
            data-tooltip={item.label}
          >
            <NavIcon name={item.icon} />
            <span>{item.label}</span>
          </a>
        </li>
      );
    }

    return (
      <li key={item.id}>
        <NavLink
          to={item.path}
          end={item.path !== toPath(paths.employees)}
          title={item.label}
          data-tooltip={item.label}
          className={({ isActive }) =>
            linkClassName(isActive || isNavItemActive(pathname, item.path), baseClass)
          }
        >
          <NavIcon name={item.icon} />
          <span>{item.label}</span>
        </NavLink>
      </li>
    );
  }

  const flyoutGroup = flyoutGroupId
    ? groups.find((group) => !('items' in group) && group.id === flyoutGroupId)
    : null;

  const flyoutPanel =
    collapsed &&
    flyoutGroup &&
    !('items' in flyoutGroup) &&
    (flyoutGroup as NavGroup).children.length > 1
      ? createPortal(
          <>
            <div className="sidebar-flyout-backdrop" aria-hidden onClick={() => setFlyoutGroupId(null)} />
            <div
              id="sidebar-flyout-panel"
              className="sidebar-flyout"
              role="menu"
              aria-label={(flyoutGroup as NavGroup).label}
              style={{ top: flyoutPos.top, left: flyoutPos.left }}
            >
              <p className="sidebar-flyout-title">{(flyoutGroup as NavGroup).label}</p>
              <ul className="sidebar-flyout-list">
                {(flyoutGroup as NavGroup).children.map((child) => (
                  <li key={child.id}>
                    <NavLink
                      to={child.path}
                      end
                      role="menuitem"
                      className={({ isActive }) =>
                        linkClassName(
                          isActive || isNavItemActive(pathname, child.path),
                          'sidebar-flyout-link'
                        )
                      }
                      onClick={() => setFlyoutGroupId(null)}
                    >
                      <NavIcon name={child.icon} />
                      <span>{child.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          </>,
          document.body
        )
      : null;

  return (
    <>
      <ul className="sidebar-menu">
        {groups.flatMap((group) => {
          if ('items' in group) {
            return group.items.map((item) => renderItem(item, 'sidebar-link'));
          }

          const g = group as NavGroup;
          const groupActive = isGroupActive(pathname, g);
          const isOpen = expanded.has(g.id) || groupActive;
          const hasFlyout = collapsed && g.children.length > 1;
          const flyoutOpen = flyoutGroupId === g.id;

          return (
            <li key={g.id} className={cn('sidebar-group', isOpen && 'open', flyoutOpen && 'flyout-open')}>
              <button
                type="button"
                className={cn(
                  'sidebar-group-btn',
                  groupActive && 'active-group',
                  hasFlyout && 'has-flyout',
                  flyoutOpen && 'flyout-open'
                )}
                aria-expanded={collapsed ? flyoutOpen : isOpen}
                aria-haspopup={hasFlyout ? 'menu' : undefined}
                title={hasFlyout ? undefined : g.label}
                data-tooltip={hasFlyout ? undefined : g.label}
                onClick={(e) => {
                  if (hasFlyout) {
                    openFlyout(g, e.currentTarget);
                    return;
                  }
                  handleGroupClick(g);
                }}
              >
                <NavIcon name={g.icon} />
                <span className="sidebar-group-label">{g.label}</span>
                <span className="sidebar-chevron">{isOpen ? '▾' : '▸'}</span>
                {hasFlyout ? <span className="sidebar-flyout-indicator" aria-hidden /> : null}
              </button>
              <ul className="sidebar-submenu">
                {g.children.map((child) => (
                  <li key={child.id}>
                    <NavLink
                      to={child.path}
                      end
                      data-tooltip={child.label}
                      className={({ isActive }) =>
                        linkClassName(
                          isActive || isNavItemActive(pathname, child.path),
                          'sidebar-sublink'
                        )
                      }
                    >
                      <span>{child.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
      {flyoutPanel}
    </>
  );
}
