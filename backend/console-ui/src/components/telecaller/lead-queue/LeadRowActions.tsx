import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { OperationalLead } from './lead-queue-types';

function phoneDigits(phone: string | null) {
  if (!phone) return '';
  const d = phone.replace(/\D/g, '');
  return d.length >= 10 ? d.slice(-10) : d;
}

type Props = {
  lead: OperationalLead;
  canWrite: boolean;
  menuOpen: boolean;
  onMenuToggle: () => void;
  onOpen: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
};

export function LeadRowActions({
  lead,
  canWrite,
  menuOpen,
  onMenuToggle,
  onOpen,
  onEdit,
  onDelete,
}: Props) {
  const digits = phoneDigits(lead.phone);
  const hasMenu = canWrite && (onEdit || onDelete);
  const moreRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!menuOpen || !moreRef.current) {
      setMenuPos(null);
      return;
    }
    const rect = moreRef.current.getBoundingClientRect();
    const menuWidth = 152;
    let left = rect.right - menuWidth;
    left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));
    setMenuPos({ top: rect.bottom + 6, left });
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onMenuToggle();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen, onMenuToggle]);

  const menu =
    menuOpen && menuPos && hasMenu
      ? createPortal(
          <div
            className="tc-lq-dropdown tc-lq-dropdown--portal"
            role="menu"
            style={{ top: menuPos.top, left: menuPos.left }}
            onClick={(e) => e.stopPropagation()}
          >
            {onEdit ? (
              <button type="button" role="menuitem" onClick={onEdit}>
                Edit lead
              </button>
            ) : null}
            {onDelete ? (
              <button type="button" role="menuitem" className="danger" onClick={onDelete}>
                Delete lead
              </button>
            ) : null}
          </div>,
          document.body
        )
      : null;

  return (
    <div className="tc-lq-row-actions" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="tc-lq-icon-btn tc-lq-icon-btn--primary"
        onClick={onOpen}
        title="Open workspace"
      >
        Open
      </button>
      {digits ? (
        <>
          <a className="tc-lq-icon-btn" href={`tel:+91${digits}`} title="Call farmer">
            Call
          </a>
          <a
            className="tc-lq-icon-btn tc-lq-icon-btn--wa"
            href={`https://wa.me/91${digits}`}
            target="_blank"
            rel="noopener noreferrer"
            title="WhatsApp"
          >
            WA
          </a>
        </>
      ) : null}
      {hasMenu ? (
        <>
          <button
            ref={moreRef}
            type="button"
            className={`tc-lq-icon-btn tc-lq-icon-btn--more${menuOpen ? ' is-open' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onMenuToggle();
            }}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            title="More actions"
          >
            ···
          </button>
          {menu}
        </>
      ) : null}
    </div>
  );
}
