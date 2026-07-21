import { supabase } from '../../lib/supabase.js';
import { expertCaseQueueService } from './expert-case-queue.service.js';

export type ExpertCaseNavItem = {
  id: string;
  caseCode: string;
  farmerName: string | null;
  cropType: string | null;
  priority: string | null;
  primaryIssue: string | null;
  assignmentStatus: string | null;
  bucket: 'my_work' | 'available' | 'at_risk';
};

export type ExpertCaseNavigation = {
  currentIndex: number;
  total: number;
  previousCaseId: string | null;
  nextCaseId: string | null;
  items: ExpertCaseNavItem[];
};

function caseCode(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

function toNavItem(
  row: Record<string, unknown>,
  bucket: ExpertCaseNavItem['bucket'],
  farmerNames: Map<string, string>
): ExpertCaseNavItem {
  const farmerId = String(row.farmer_id ?? '');
  return {
    id: String(row.id),
    caseCode: caseCode(String(row.id)),
    farmerName: farmerNames.get(farmerId) ?? null,
    cropType: (row.crop_type as string | null) ?? null,
    priority: (row.priority as string | null) ?? null,
    primaryIssue: (row.primary_issue_label as string | null) ?? null,
    assignmentStatus: (row.assignment_status as string | null) ?? null,
    bucket,
  };
}

export async function buildExpertCaseNavigation(params: {
  ownerEmail: string;
  caseId: string;
}): Promise<ExpertCaseNavigation> {
  const empty: ExpertCaseNavigation = {
    currentIndex: 0,
    total: 0,
    previousCaseId: null,
    nextCaseId: null,
    items: [],
  };

  if (!expertCaseQueueService.enabled()) return empty;

  const buckets = await expertCaseQueueService.listBuckets(params.ownerEmail);
  const ordered: Array<{ row: Record<string, unknown>; bucket: ExpertCaseNavItem['bucket'] }> = [];

  for (const row of buckets.my_work) {
    ordered.push({ row, bucket: 'my_work' });
  }
  for (const row of buckets.at_risk) {
    if (!ordered.some((item) => String(item.row.id) === String(row.id))) {
      ordered.push({ row, bucket: 'at_risk' });
    }
  }
  for (const row of buckets.available) {
    if (!ordered.some((item) => String(item.row.id) === String(row.id))) {
      ordered.push({ row, bucket: 'available' });
    }
  }

  if (!ordered.length) return empty;

  const farmerIds = [...new Set(ordered.map((item) => String(item.row.farmer_id ?? '')).filter(Boolean))];
  const farmerNames = new Map<string, string>();
  if (farmerIds.length) {
    const { data: farmers } = await supabase
      .from('farmers')
      .select('id, name, phone')
      .in('id', farmerIds);
    for (const farmer of farmers ?? []) {
      farmerNames.set(
        String(farmer.id),
        String(farmer.name ?? farmer.phone ?? '').trim() || 'Farmer'
      );
    }
  }

  const items = ordered.map((item) => toNavItem(item.row, item.bucket, farmerNames));
  const index = items.findIndex((item) => item.id === params.caseId);
  const currentIndex = index >= 0 ? index + 1 : 0;

  return {
    currentIndex,
    total: items.length,
    previousCaseId: index > 0 ? items[index - 1].id : null,
    nextCaseId: index >= 0 && index < items.length - 1 ? items[index + 1].id : null,
    items,
  };
}

export function formatCaseListMessage(
  navigation: ExpertCaseNavigation,
  locale: string = 'en'
): string {
  if (!navigation.items.length) {
    return locale === 'hi'
      ? 'कोई खुला केस नहीं है।'
      : locale === 'ml'
        ? 'തുറന്ന കേസുകൾ ഇല്ല.'
        : locale === 'ta'
          ? 'திறந்த கேஸ்கள் இல்லை.'
          : locale === 'kn'
            ? 'ತೆರೆದ ಕೇಸ್‌ಗಳಿಲ್ಲ.'
            : 'No open cases in your queue.';
  }

  const header =
    locale === 'hi'
      ? `📋 केस सूची (${navigation.currentIndex || '—'}/${navigation.total})`
      : locale === 'ml'
        ? `📋 കേസ് ലിസ്റ്റ് (${navigation.currentIndex || '—'}/${navigation.total})`
        : locale === 'ta'
          ? `📋 கேஸ் பட்டியல் (${navigation.currentIndex || '—'}/${navigation.total})`
          : locale === 'kn'
            ? `📋 ಕೇಸ್ ಪಟ್ಟಿ (${navigation.currentIndex || '—'}/${navigation.total})`
            : `📋 Case list (${navigation.currentIndex || '—'}/${navigation.total})`;

  const lines = navigation.items.map((item, i) => {
    const marker = navigation.currentIndex === i + 1 ? '▶' : `${i + 1}.`;
    const farmer = item.farmerName || 'Farmer';
    const crop = item.cropType ? ` · ${item.cropType}` : '';
    const issue = item.primaryIssue ? ` — ${item.primaryIssue}` : '';
    return `${marker} ${item.caseCode} · ${farmer}${crop}${issue}`;
  });

  const footer =
    locale === 'hi'
      ? '\n\nलिखें: "next case" · "previous case" · केस खोलने के लिए ID टैप करें'
      : locale === 'ml'
        ? '\n\n"next case" · "previous case" എഴുതൂ'
        : locale === 'ta'
          ? '\n\n"next case" · "previous case" எழுதுங்கள்'
          : locale === 'kn'
            ? '\n\n"next case" · "previous case" ಬರೆಯಿರಿ'
            : '\n\nType "next case" or "previous case" to navigate.';

  return [header, '', ...lines, footer].join('\n');
}
