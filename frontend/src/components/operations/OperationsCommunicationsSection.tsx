import { Link } from 'react-router-dom';
import { paths, toPath } from '../../lib/routes';
import {
  LanguageTemplatesPanel,
  QuickRepliesPanel,
} from './OperationsMessagingExtras';

type QuickReply = {
  id: string;
  shortcut_key: string;
  category: string;
  label_en: string;
  body_en: string;
  body_ml: string | null;
  active: boolean;
  sort_order: number;
};

export function OperationsCommunicationsSection({
  subTab,
  canWrite,
  search,
  quickReplies,
  qrCategory,
  onQrCategoryChange,
  onRefresh,
  tplStatus,
  tplCategory,
  onTplStatusChange,
  onTplCategoryChange,
}: {
  subTab: 'broadcasts' | 'whatsappTemplates' | 'quickReplies';
  canWrite: boolean;
  search: string;
  quickReplies: QuickReply[];
  qrCategory: string;
  onQrCategoryChange: (c: string) => void;
  onRefresh: () => void;
  tplStatus: string;
  tplCategory: string;
  onTplStatusChange: (s: string) => void;
  onTplCategoryChange: (c: string) => void;
}) {
  if (subTab === 'broadcasts') {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-sky-100 bg-sky-50/80 px-4 py-3 text-sm text-sky-900">
          <strong>Campaign templates</strong> (broadcast copy for the wizard) live under{' '}
          <Link to={toPath(paths.broadcastsTemplates)} className="font-medium underline">
            Broadcasts → Template library
          </Link>
          . <strong>WhatsApp templates</strong> here are system messages (welcome, session, Meta names).
        </div>
        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Broadcast hub</h2>
          <p className="mt-1 text-sm text-slate-600">
            Create campaigns, schedule sends, track delivery, and manage automation rules.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <HubLink to={toPath(paths.broadcasts)} title="Dashboard" desc="Overview and recent campaigns" />
            <HubLink to={toPath(paths.broadcastsNew)} title="Create broadcast" desc="7-step campaign wizard" />
            <HubLink to={toPath(paths.broadcastsScheduled)} title="Scheduled" desc="Upcoming sends" />
            <HubLink to={toPath(paths.broadcastsSent)} title="Sent" desc="Delivery history" />
            <HubLink to={toPath(paths.broadcastsTemplates)} title="Campaign templates" desc="Reusable broadcast copy" />
            <HubLink to={toPath(paths.broadcastsAutomation)} title="Campaign rules" desc="DAP and crop automation" />
            <HubLink to={toPath(paths.broadcastsAnalytics)} title="Analytics" desc="Delivery and read rates" />
            {canWrite ? (
              <HubLink to={toPath(paths.broadcastsAdmin)} title="Admin" desc="Approvals and limits" />
            ) : null}
          </div>
        </section>
      </div>
    );
  }

  if (subTab === 'whatsappTemplates') {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-amber-100 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
          These are <strong>WhatsApp system templates</strong> (welcome, advisory, orders). For one-off campaign copy,
          use{' '}
          <Link to={toPath(paths.broadcastsTemplates)} className="font-medium underline">
            Broadcasts → Campaign templates
          </Link>
          .
        </div>
        <LanguageTemplatesPanel
          canWrite={canWrite}
          statusFilter={tplStatus}
          categoryFilter={tplCategory}
          search={search}
          onStatusChange={onTplStatusChange}
          onCategoryChange={onTplCategoryChange}
        />
      </div>
    );
  }

  return (
    <QuickRepliesPanel
      replies={quickReplies}
      canWrite={canWrite}
      category={qrCategory}
      onCategoryChange={onQrCategoryChange}
      onRefresh={onRefresh}
    />
  );
}

function HubLink({ to, title, desc }: { to: string; title: string; desc: string }) {
  return (
    <Link
      to={to}
      className="block rounded-lg border border-slate-200 bg-slate-50/50 p-4 transition hover:border-emerald-300 hover:bg-emerald-50/40"
    >
      <p className="font-medium text-slate-900">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{desc}</p>
    </Link>
  );
}
