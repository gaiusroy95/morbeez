import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  agronomistClient,
  type AgronomistBlockRow,
  type AgronomistRecommendationRow,
  type FarmerNoteRow,
  type FarmerWorkspaceDashboard,
} from '@morbeez/shared';
import { api } from '../../lib/api';
import { Alert, Btn, HubTabs, Loading } from '../ui';
import { BlocksTab } from '../telecaller/BlocksTab';
import { FieldFindingsTab } from '../telecaller/FieldFindingsTab';
import { CrmModals, type CrmModalType } from '../telecaller/CrmModals';
import {
  FieldFindingDetailModal,
  type FieldFindingListRow,
} from '../telecaller/FieldFindingDetailModal';
import { buildVisitWizardUrl } from '../../lib/visitNavigation';
import { paths, toPath } from '../../lib/routes';

type Tab =
  | 'overview'
  | 'calls'
  | 'blocks'
  | 'fieldFindings'
  | 'recommendations'
  | 'followUps'
  | 'notes'
  | 'team'
  | 'orders';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'calls', label: 'Calls' },
  { id: 'blocks', label: 'Blocks' },
  { id: 'fieldFindings', label: 'Field Findings' },
  { id: 'recommendations', label: 'Recommendations' },
  { id: 'followUps', label: 'Follow-ups' },
  { id: 'notes', label: 'Notes' },
  { id: 'team', label: 'Team' },
  { id: 'orders', label: 'Orders' },
];

type BlockOption = { id: string; name: string; cropName?: string };

type Props = {
  farmerId: string;
  farmerName: string;
  leadId: string | null;
  canWrite: boolean;
  onClose: () => void;
};

export function AgronomistFarmerWorkspacePanel({
  farmerId,
  farmerName,
  leadId,
  canWrite,
  onClose,
}: Props) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dashboard, setDashboard] = useState<FarmerWorkspaceDashboard | null>(null);
  const [agroBlocks, setAgroBlocks] = useState<AgronomistBlockRow[]>([]);
  const [leadBlocks, setLeadBlocks] = useState<BlockOption[]>([]);
  const [notes, setNotes] = useState<FarmerNoteRow[]>([]);
  const [recommendations, setRecommendations] = useState<AgronomistRecommendationRow[]>([]);
  const [team, setTeam] = useState<Array<Record<string, unknown>>>([]);
  const [interactions, setInteractions] = useState<Array<Record<string, unknown>>>([]);
  const [orders, setOrders] = useState<Array<Record<string, unknown>>>([]);
  const [followUps, setFollowUps] = useState<Array<Record<string, unknown>>>([]);
  const [dataVersion, setDataVersion] = useState(0);
  const [modal, setModal] = useState<CrmModalType>(null);
  const [selectedFinding, setSelectedFinding] = useState<FieldFindingListRow | null>(null);

  const visitContext = useMemo(
    () => ({ farmerId, farmerName }),
    [farmerId, farmerName]
  );

  const bump = () => setDataVersion((v) => v + 1);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [dash, blockRows, noteRows, recRows, timeline, fu, inter, orderRows] = await Promise.all([
        agronomistClient.getWorkspaceDashboard(farmerId),
        agronomistClient.getFarmerBlocks(farmerId),
        agronomistClient.listFarmerNotes(farmerId).catch(() => []),
        agronomistClient.listFarmerRecommendations(farmerId).catch(() => []),
        agronomistClient.getFarmerTeamTimeline(farmerId).catch(() => []),
        agronomistClient.getFarmerFollowUps(farmerId).catch(() => ({ tasks: [], recommendationFollowUps: [], callbacks: [] })),
        agronomistClient.listFarmerInteractions(farmerId, 20).catch(() => []),
        agronomistClient.listFarmerOrders(farmerId).catch(() => []),
      ]);
      setDashboard(dash);
      setAgroBlocks(blockRows);
      setNotes(noteRows);
      setRecommendations(recRows);
      setTeam(timeline);
      setInteractions(inter as Array<Record<string, unknown>>);
      setOrders(orderRows as Array<Record<string, unknown>>);
      const tasks = [
        ...(fu.tasks ?? []),
        ...(fu.recommendationFollowUps ?? []),
        ...(fu.callbacks ?? []),
      ];
      setFollowUps(tasks);

      if (leadId) {
        const data = await api<{ ok: boolean; blocks: BlockOption[] }>(
          `/morbeez-staff/api/v1/os/telecaller/leads/${leadId}/blocks`
        );
        setLeadBlocks(
          (data.blocks ?? []).map((b) => ({
            id: b.id,
            name: b.name,
            cropName: b.cropName,
          }))
        );
      } else {
        setLeadBlocks(
          blockRows.map((b) => ({
            id: b.id,
            name: b.name,
            cropName: b.cropType ?? undefined,
          }))
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load farmer workspace');
    } finally {
      setLoading(false);
    }
  }, [farmerId, leadId]);

  useEffect(() => {
    void load();
  }, [load, dataVersion]);

  function startVisit(block: Pick<AgronomistBlockRow, 'id' | 'name' | 'cropType'>) {
    navigate(
      buildVisitWizardUrl({
        farmerId,
        blockId: block.id,
        blockName: block.name,
        cropType: block.cropType || '_default',
        farmerName,
      })
    );
  }

  async function archiveFinding(id: string) {
    if (!leadId) return;
    await api(`/morbeez-staff/api/v1/os/telecaller/leads/${leadId}/field-findings/${id}`, {
      method: 'DELETE',
    });
    bump();
  }

  if (loading && !dashboard) return <Loading label="Loading farmer workspace…" />;

  const primaryBlock = agroBlocks[0];

  return (
    <div className="agro-farmer-workspace">
      <div className="agro-farmer-workspace-head">
        <div>
          <h2>{farmerName}</h2>
          <p className="muted">
            {[dashboard?.farmer?.district, dashboard?.activeCrops?.join(', ')].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="visit-wizard-actions">
          {primaryBlock && canWrite ? (
            <Btn label="Start visit" onClick={() => startVisit(primaryBlock)} />
          ) : null}
          <Btn label="Close" variant="secondary" onClick={onClose} />
        </div>
      </div>
      {error ? <Alert>{error}</Alert> : null}
      <HubTabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'overview' ? (
        <div className="agro-ops-stats">
          <div className="agro-ops-panel">
            <strong>Open issues</strong>
            <div>{dashboard?.openIssuesCount ?? 0}</div>
          </div>
          <div className="agro-ops-panel">
            <strong>Pending recommendations</strong>
            <div>{dashboard?.pendingRecommendationsCount ?? 0}</div>
          </div>
          <div className="agro-ops-panel">
            <strong>Today&apos;s visits</strong>
            <div>{dashboard?.todaysVisitsCount ?? 0}</div>
          </div>
          <div className="agro-ops-panel">
            <strong>Blocks</strong>
            <div>{agroBlocks.length}</div>
          </div>
          <Link to={toPath(paths.agronomistMap)}>Open farmer map</Link>
          <button type="button" className="link-btn" onClick={() => setTab('fieldFindings')}>
            View field findings
          </button>
        </div>
      ) : null}

      {tab === 'calls' ? (
        <div>
          {canWrite && leadId ? (
            <Btn label="Log call" className="mb-3" onClick={() => setModal('call')} />
          ) : null}
          <ul className="visit-detail-list">
            {interactions.map((row, i) => (
              <li key={String(row.id ?? i)}>
                {String(row.interactionType ?? row.type ?? 'Call')} —{' '}
                {String(row.summary ?? row.notes ?? '—')}
                <div className="muted">{String(row.createdAtLabel ?? row.created_at ?? '')}</div>
              </li>
            ))}
            {!interactions.length ? <li className="muted">No recent calls logged.</li> : null}
          </ul>
        </div>
      ) : null}

      {tab === 'blocks' && leadId ? (
        <BlocksTab
          leadId={leadId}
          canWrite={canWrite}
          refreshKey={dataVersion}
          visitContext={visitContext}
          onAddBlock={() => setModal('block')}
          onOpenFinding={(row) => setSelectedFinding(row)}
          onScheduleVisit={() => setModal('visit')}
          onAddRecommendation={() => setModal('recommendation')}
          onAddFieldFinding={() => setModal('finding')}
        />
      ) : tab === 'blocks' ? (
        <ul className="visit-detail-list">
          {agroBlocks.map((b) => (
            <li key={b.id}>
              {b.name} · {b.cropType}
              {canWrite ? (
                <>
                  {' '}
                  <button type="button" className="link-btn" onClick={() => startVisit(b)}>
                    Start visit
                  </button>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {tab === 'fieldFindings' && leadId ? (
        <FieldFindingsTab
          leadId={leadId}
          canWrite={canWrite}
          blocks={leadBlocks}
          refreshKey={dataVersion}
          visitContext={visitContext}
          onAddFinding={() => setModal('finding')}
          onOpenDetail={(row) => setSelectedFinding(row)}
          onArchive={(id) => void archiveFinding(id)}
        />
      ) : tab === 'fieldFindings' ? (
        <p className="muted">Link this farmer to a CRM lead to manage structured field findings.</p>
      ) : null}

      {tab === 'recommendations' ? (
        <ul className="visit-detail-list">
          {recommendations.map((rec) => (
            <li key={rec.id}>
              <strong>{rec.issueDetected ?? 'Issue'}</strong> — {rec.recommendationText}
            </li>
          ))}
          {!recommendations.length ? <li className="muted">No recommendations yet.</li> : null}
        </ul>
      ) : null}

      {tab === 'followUps' ? (
        <ul className="visit-detail-list">
          {followUps.map((t, i) => (
            <li key={String(t.id ?? i)}>{String(t.title ?? t.reason ?? 'Follow-up')}</li>
          ))}
          {!followUps.length ? <li className="muted">No pending follow-ups.</li> : null}
        </ul>
      ) : null}

      {tab === 'notes' ? (
        <div>
          {canWrite && leadId ? (
            <Btn label="Add note" className="mb-3" onClick={() => setModal('note')} />
          ) : null}
          <ul className="visit-detail-list">
            {notes.map((n) => (
              <li key={n.id}>
                {n.noteText}
                <div className="muted">{new Date(n.createdAt).toLocaleString()}</div>
              </li>
            ))}
            {!notes.length ? <li className="muted">No notes yet.</li> : null}
          </ul>
        </div>
      ) : null}

      {tab === 'team' ? (
        <ul className="visit-detail-list">
          {team.map((row, i) => (
            <li key={i}>
              {String(row.title ?? row.kind ?? 'Event')} — {String(row.atLabel ?? row.at ?? '')}
            </li>
          ))}
          {!team.length ? <li className="muted">No team timeline entries.</li> : null}
        </ul>
      ) : null}

      {tab === 'orders' ? (
        <ul className="visit-detail-list">
          {orders.map((o, i) => (
            <li key={String(o.id ?? i)}>
              {String(o.orderNumber ?? o.id ?? 'Order')} — {String(o.status ?? '—')}
            </li>
          ))}
          {!orders.length ? <li className="muted">No orders on record.</li> : null}
        </ul>
      ) : null}

      {leadId ? (
        <CrmModals
          type={modal}
          leadId={leadId}
          blocks={leadBlocks}
          onClose={() => setModal(null)}
          onSaved={bump}
        />
      ) : null}

      {selectedFinding && leadId ? (
        <FieldFindingDetailModal
          leadId={leadId}
          row={selectedFinding}
          canWrite={canWrite}
          onClose={() => setSelectedFinding(null)}
          onSaved={bump}
        />
      ) : null}
    </div>
  );
}
