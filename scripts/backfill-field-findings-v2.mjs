#!/usr/bin/env node
/**
 * Backfill visit_issues rows for legacy crm_field_findings that only have disease_pest text.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/backfill-field-findings-v2.mjs
 *   node scripts/backfill-field-findings-v2.mjs --dry-run
 */
import { createClient } from '@supabase/supabase-js';

const dryRun = process.argv.includes('--dry-run');
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

function inferCategory(text) {
  const t = (text ?? '').toLowerCase();
  if (t.includes('pest') || t.includes('thrip') || t.includes('mite')) return 'pest';
  if (t.includes('defici') || t.includes('yellow')) return 'nutrient_deficiency';
  if (t.includes('water') || t.includes('drought') || t.includes('flood')) return 'water_stress';
  if (t.includes('weed')) return 'weed';
  if (t.includes('disease') || t.includes('spot') || t.includes('blight')) return 'disease';
  return 'other';
}

const { data: findings, error } = await supabase
  .from('crm_field_findings')
  .select('id, disease_pest, observations, severity')
  .is('archived_at', null)
  .order('visited_at', { ascending: false })
  .limit(5000);

if (error) {
  console.error(error.message);
  process.exit(1);
}

let created = 0;
let skipped = 0;

for (const finding of findings ?? []) {
  const { count } = await supabase
    .from('visit_issues')
    .select('id', { count: 'exact', head: true })
    .eq('field_finding_id', finding.id);

  if ((count ?? 0) > 0) {
    skipped++;
    continue;
  }

  const label = String(finding.disease_pest ?? finding.observations ?? 'Field observation').trim();
  if (!label) {
    skipped++;
    continue;
  }

  const row = {
    field_finding_id: finding.id,
    issue_category: inferCategory(label),
    issue_name: label.slice(0, 200),
    severity: finding.severity === 'severe' ? 'high' : finding.severity === 'moderate' ? 'medium' : 'low',
    observation: finding.observations ?? null,
    status: 'open',
    sort_order: 0,
  };

  if (dryRun) {
    console.log('[dry-run] would insert', row);
    created++;
    continue;
  }

  const { error: insertErr } = await supabase.from('visit_issues').insert(row);
  if (insertErr) {
    console.error('Insert failed for', finding.id, insertErr.message);
    continue;
  }
  created++;
}

console.log(JSON.stringify({ dryRun, created, skipped, scanned: findings?.length ?? 0 }, null, 2));
