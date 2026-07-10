import type { OperationalLead } from './lead-queue-types';

function formatPhoneE164(phone: string | null) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
}

type Props = {
  lead: OperationalLead;
  canWrite: boolean;
  menuOpen: boolean;
  onMoreClick: (anchor: HTMLButtonElement) => void;
  onOpen: () => void;
};

export function LeadRowActions({ lead, canWrite, menuOpen, onMoreClick, onOpen }: Props) {
  const e164 = formatPhoneE164(lead.phone);
  const waDigits = e164?.replace(/\D/g, '') ?? '';

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
      {e164 ? (
        <>
          <a className="tc-lq-icon-btn" href={`tel:${e164}`} title="Call farmer">
            Call
          </a>
          <a
            className="tc-lq-icon-btn tc-lq-icon-btn--wa"
            href={`https://wa.me/${waDigits}`}
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
