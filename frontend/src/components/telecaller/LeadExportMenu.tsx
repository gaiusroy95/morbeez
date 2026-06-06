import { useState } from 'react';
import { openLeadExport, openWhatsAppShare, type ExportType } from '../../lib/crmExport';

type Props = {
  leadId: string;
  canShare?: boolean;
  onClose?: () => void;
};

export function LeadExportMenuItems({ leadId, canShare = true, onClose }: Props) {
  const [error, setError] = useState('');

  async function exportAs(type: ExportType) {
    onClose?.();
    setError('');
    try {
      await openLeadExport(leadId, type);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
    }
  }

  async function share() {
    onClose?.();
    setError('');
    try {
      await openWhatsAppShare(leadId, { type: 'lead' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Share failed');
    }
  }

  return (
    <>
      <button type="button" role="menuitem" onClick={() => exportAs('lead')}>
        Print farmer profile
      </button>
      <button type="button" role="menuitem" onClick={() => exportAs('recommendations')}>
        Print recommendations
      </button>
      <button type="button" role="menuitem" onClick={() => exportAs('interactions')}>
        Print interactions
      </button>
      <button type="button" role="menuitem" onClick={() => exportAs('findings')}>
        Print field findings
      </button>
      {canShare ? (
        <button type="button" role="menuitem" onClick={share}>
          Share on WhatsApp
        </button>
      ) : null}
      {error ? <p className="tc-header-dropdown-error">{error}</p> : null}
    </>
  );
}

export function LeadExportMenu({ leadId, canShare = true }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
      >
        Export / Share ▾
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            <LeadExportMenuItems leadId={leadId} canShare={canShare} onClose={() => setOpen(false)} />
          </div>
        </>
      ) : null}
    </div>
  );
}
