import { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { canSendQuoteWithBulkReview, type BulkMarginReviewStatus } from './BulkMarginReviewBadge';

type Props = {
  status: string;
  codAmount?: number;
  bulkMarginReviewStatus?: BulkMarginReviewStatus;
  busy?: boolean;
  onView: () => void;
  onEdit: () => void;
  onSendWhatsApp: () => void;
  onSendMail: () => void;
  onConfirmCod?: () => void;
  onDelete: () => void;
};

export function QuoteActionsDropdown({
  status,
  codAmount = 0,
  bulkMarginReviewStatus,
  busy,
  onView,
  onEdit,
  onSendWhatsApp,
  onSendMail,
  onConfirmCod,
  onDelete,
}: Props) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const canEdit = status === 'pending' && bulkMarginReviewStatus !== 'pending';
  const canSend = canSendQuoteWithBulkReview(bulkMarginReviewStatus);
  const canConfirmCod =
    Boolean(onConfirmCod) &&
    (status === 'checkout' || status === 'pending') &&
    (codAmount ?? 0) > 0;

  useLayoutEffect(() => {
    if (!open || !anchor) {
      setPos(null);
      return;
    }
    const rect = anchor.getBoundingClientRect();
    const menuWidth = 168;
    let left = rect.right - menuWidth;
    left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));
    setPos({ top: rect.bottom + 6, left });
  }, [open, anchor]);

  useEffect(() => {
    if (!open) return;
    function close(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (anchor?.contains(target)) return;
      if (target.closest('.est-quote-actions-menu')) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', close);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, anchor]);

  function run(action: () => void) {
    action();
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        ref={setAnchor}
        className={`est-quote-actions-trigger${open ? ' is-open' : ''}`}
        disabled={busy}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        Action ▾
      </button>
      {open && pos
        ? createPortal(
            <div
              className="tc-lq-dropdown tc-lq-dropdown--portal est-quote-actions-menu"
              role="menu"
              style={{ top: pos.top, left: pos.left }}
              onClick={(e) => e.stopPropagation()}
            >
              <button type="button" role="menuitem" onClick={() => run(onView)}>
                View
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={!canEdit}
                title={canEdit ? undefined : 'Only pending quotes can be edited'}
                onClick={() => canEdit && run(onEdit)}
              >
                Edit
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={!canSend}
                title={!canSend ? 'Waiting for bulk margin approval' : undefined}
                onClick={() => canSend && run(onSendWhatsApp)}
              >
                Send WhatsApp
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={!canSend}
                title={!canSend ? 'Waiting for bulk margin approval' : undefined}
                onClick={() => canSend && run(onSendMail)}
              >
                Send mail
              </button>
              {canConfirmCod ? (
                <button type="button" role="menuitem" onClick={() => run(onConfirmCod!)}>
                  Confirm COD → warehouse
                </button>
              ) : null}
              <button type="button" role="menuitem" className="danger" onClick={() => run(onDelete)}>
                Delete
              </button>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
