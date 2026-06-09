import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type MenuPos = { top: number; left: number };

type Props = {
  open: boolean;
  anchor: HTMLElement | null;
  onClose: () => void;
  children: ReactNode;
};

const MENU_MIN_WIDTH = 168;
const MENU_EST_HEIGHT = 220;

export function ProductActionMenu({ open, anchor, onClose, children }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<MenuPos | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchor) {
      setPos(null);
      return;
    }

    function place() {
      const rect = anchor.getBoundingClientRect();
      const panelH = panelRef.current?.offsetHeight ?? MENU_EST_HEIGHT;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < panelH + 12;
      const top = openUp ? Math.max(8, rect.top - panelH - 4) : rect.bottom + 4;
      const left = Math.min(
        Math.max(8, rect.right - MENU_MIN_WIDTH),
        window.innerWidth - MENU_MIN_WIDTH - 8
      );
      setPos({ top, left });
    }

    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', onClose, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', onClose, true);
    };
  }, [open, anchor, onClose]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (anchor?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      onClose();
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open, anchor, onClose]);

  if (!open || !anchor || !pos) return null;

  return createPortal(
    <div
      ref={panelRef}
      className="commerce-products__action-menu commerce-products__action-menu--portal"
      role="menu"
      style={{ top: pos.top, left: pos.left }}
    >
      {children}
    </div>,
    document.body
  );
}
