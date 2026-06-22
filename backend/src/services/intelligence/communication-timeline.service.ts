import { supabase } from '../../lib/supabase.js';

export type CommunicationTimelineEntry = {
  at: string;
  kind: string;
  summary: string;
  source?: string;
};

export const communicationTimelineService = {
  async buildForFarmer(farmerId: string, limit = 30): Promise<CommunicationTimelineEntry[]> {
    const cap = Math.min(Math.max(limit, 1), 100);

    const [interactions, applications, orders, jobs] = await Promise.all([
      supabase
        .from('interaction_logs')
        .select('created_at, interaction_type, summary, channel')
        .eq('farmer_id', farmerId)
        .order('created_at', { ascending: false })
        .limit(cap),
      supabase
        .from('application_history')
        .select('applied_at, product_name, dose, method, source')
        .eq('farmer_id', farmerId)
        .order('applied_at', { ascending: false })
        .limit(cap),
      supabase
        .from('orders')
        .select('created_at, total_amount, status')
        .eq('farmer_id', farmerId)
        .order('created_at', { ascending: false })
        .limit(cap),
      supabase
        .from('advisory_automation_jobs')
        .select('scheduled_at, completed_at, job_type, status')
        .eq('farmer_id', farmerId)
        .order('scheduled_at', { ascending: false })
        .limit(cap),
    ]);

    const entries: CommunicationTimelineEntry[] = [];

    for (const row of interactions.data ?? []) {
      entries.push({
        at: String(row.created_at),
        kind: String(row.interaction_type ?? 'interaction'),
        summary: String(row.summary ?? '—'),
        source: row.channel ? String(row.channel) : 'interaction',
      });
    }

    for (const row of applications.data ?? []) {
      const dose = row.dose ? ` (${row.dose})` : '';
      entries.push({
        at: String(row.applied_at),
        kind: 'application',
        summary: `${row.product_name}${dose} · ${row.method}`,
        source: String(row.source ?? 'visit'),
      });
    }

    for (const row of orders.data ?? []) {
      entries.push({
        at: String(row.created_at),
        kind: 'order',
        summary: `Order ${row.status ?? 'placed'} · ₹${Number(row.total_amount ?? 0).toFixed(0)}`,
        source: 'commerce',
      });
    }

    for (const row of jobs.data ?? []) {
      const at = row.completed_at ?? row.scheduled_at;
      entries.push({
        at: String(at),
        kind: 'automation',
        summary: `${row.job_type} · ${row.status}`,
        source: 'advisory_automation',
      });
    }

    return entries
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, cap);
  },
};
