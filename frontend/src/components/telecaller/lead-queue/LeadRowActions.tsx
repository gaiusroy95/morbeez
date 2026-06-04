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
  onMoreClick: (anchor: HTMLButtonElement) => void;
  onOpen: () => void;
};

export function LeadRowActions({ lead, canWrite, menuOpen, onMoreClick, onOpen }: Props) {
  const digits = phoneDigits(lead.phone);

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
      {canWrite ? (
        <button
          type="button"
          className={`tc-lq-icon-btn tc-lq-icon-btn--more${menuOpen ? ' is-open' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onMoreClick(e.currentTarget);
          }}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          title="More actions"
        >
          ···
        </button>
      ) : null}
    </div>
  );
}
