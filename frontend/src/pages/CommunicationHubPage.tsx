import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { agronomistClient } from '@morbeez/shared';
import { api } from '../lib/api';
import { CommunicationTimeline, type TimelineEntry } from '../components/intelligence/CommunicationTimeline';
import { PageShell, Loading, StaticSelect } from '../components/ui';

type FarmerOption = { id: string; name: string; phone?: string | null };

export function CommunicationHubPage() {
  const { farmerId: routeFarmerId } = useParams<{ farmerId?: string }>();
  const [farmers, setFarmers] = useState<FarmerOption[]>([]);
  const [farmerId, setFarmerId] = useState(routeFarmerId ?? '');
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void agronomistClient
      .listFarmers({ limit: 100 })
      .then((rows) =>
        setFarmers(rows.map((f) => ({ id: f.id, name: f.name, phone: f.phone })))
      )
      .catch(() => setFarmers([]));
  }, []);

  useEffect(() => {
    if (routeFarmerId) setFarmerId(routeFarmerId);
  }, [routeFarmerId]);

  useEffect(() => {
    if (!farmerId) {
      setEntries([]);
      return;
    }
    setLoading(true);
    void api<{ ok: boolean; profile: { timeline: TimelineEntry[] } }>(
      `/morbeez-staff/api/v1/os/intelligence/farmers/${farmerId}/360`
    )
      .then((r) => setEntries(r.profile?.timeline ?? []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [farmerId]);

  return (
    <PageShell title="Communication hub">
      <p className="muted mb-4">Unified calls, visits, WhatsApp, and advisory events for a farmer.</p>
      <StaticSelect
        className="mb-4 max-w-md"
        value={farmerId}
        onChange={(e) => setFarmerId(e.target.value)}
      >
        <option value="">Select farmer…</option>
        {farmers.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name} {f.phone ? `(${f.phone})` : ''}
          </option>
        ))}
      </StaticSelect>
      {loading ? <Loading label="Loading timeline…" /> : <CommunicationTimeline entries={entries} />}
    </PageShell>
  );
}
