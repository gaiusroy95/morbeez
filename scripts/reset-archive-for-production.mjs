#!/usr/bin/env node
/**
 * Remove demo / test data from the Morbeez farmer archive (Supabase).
 *
 * Usage:
 *   npm run archive:reset-demo
 *     → Deletes seed demo farmers (source=seed, phones 9876543210–9876543217) and orphan leads.
 *
 *   npm run archive:reset -- --confirm
 *     → Full transactional reset: all farmers, leads, orders, AI sessions, CRM rows, webhook logs.
 *     → Keeps admin_users, crm_masters, advisory_faq_cache, product_intelligence.
 *
 *   npm run db:reset-retest -- --confirm
 *     → Comprehensive re-test reset via REST API (same scope as scripts/sql/reset-transactional-keep-products.sql).
 *     → Preserves Morbeez employee DB (admin_users, payroll, attendance, KPI) and product/inventory catalog.
 *
 *   npm run db:reset-retest -- --confirm --sql
 *     → Same reset via DATABASE_URL + pg (faster, fewer FK issues). Requires DATABASE_URL in backend/.env.
 *
 * Requires backend/.env with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const DEMO_PHONES_10 = ['9876543210', '9876543211', '9876543212', '9876543213', '9876543214', '9876543215', '9876543216', '9876543217'];
const DEMO_PHONES = [...DEMO_PHONES_10, ...DEMO_PHONES_10.map((p) => `91${p}`)];

function loadEnv() {
  const path = join(root, 'backend', '.env');
  if (!existsSync(path)) {
    console.error('Missing backend/.env');
    process.exit(1);
  }
  const env = {};
  for (const line of readFileSync(path, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 1) continue;
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[t.slice(0, eq).trim()] = val;
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('backend/.env must define SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  return env;
}

function sbHeaders(env, prefer = 'return=representation') {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: prefer,
  };
}

async function sb(env, table, method, body, query = '', prefer) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}${query}`, {
    method,
    headers: sbHeaders(env, prefer),
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const msg = data?.message || data?.error || (typeof data === 'string' ? data : JSON.stringify(data));
    throw new Error(`${table}${query}: ${msg || `HTTP ${res.status}`}`);
  }
  return data;
}

async function sbCount(env, table, query = '') {
  const q = query ? `${query}&` : '';
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?${q}select=*`, {
    method: 'HEAD',
    headers: {
      ...sbHeaders(env, 'count=exact'),
      Prefer: 'count=exact',
    },
  });
  const range = res.headers.get('content-range') || '';
  const m = range.match(/\/(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}

async function deleteByFilter(env, table, filter) {
  const before = await sbCount(env, table, filter);
  if (before === 0) return 0;
  await sb(env, table, 'DELETE', null, `?${filter}`);
  return before;
}

async function deleteAllRows(env, table) {
  for (const filter of ['id=not.is.null', '']) {
    try {
      let total = 0;
      for (;;) {
        const q = filter ? `${filter}&select=id&limit=200` : 'select=id&limit=200';
        const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?${q}`, {
          headers: sbHeaders(env, 'return=representation'),
        });
        const rows = await res.json();
        if (!res.ok) throw new Error(rows?.message || JSON.stringify(rows));
        if (!Array.isArray(rows) || rows.length === 0) break;
        const ids = rows.map((r) => r.id).filter(Boolean);
        if (!ids.length) break;
        await sb(env, table, 'DELETE', null, `?id=in.(${ids.join(',')})`);
        total += ids.length;
      }
      if (total > 0 || filter === '') return total;
    } catch (e) {
      if (filter === '') throw e;
    }
  }
  return 0;
}

/** Tables keyed by farmer_id or other non-id columns — wipe all rows. */
const RETEST_FILTER_DELETES = [
  ['farmer_ai_usage_daily', 'farmer_id=not.is.null'],
  ['farmer_roi_settings', 'farmer_id=not.is.null'],
  ['farmer_experience_stats', 'farmer_id=not.is.null'],
  ['local_practices', 'id=not.is.null'],
  ['farmer_broadcast_preferences', 'farmer_id=not.is.null'],
  ['market_insight_pincode_cache', 'pincode=not.is.null'],
  ['market_insight_district_profiles', 'district=not.is.null'],
];

/** Tables cleared in retest mode (child-first). Product catalog tables are omitted. */
const RETEST_TABLES = [
  'partner_certification_attempts',
  'partner_training_progress',
  'partner_events',
  'partner_earnings_ledger',
  'partner_payout_batches',
  'partner_lead_allocations',
  'partner_reliability_signals',
  'partner_reliability_scores',
  'partner_kpi_snapshots',
  'partner_farmer_attribution',
  'partner_status_history',
  'partner_otp_challenges',
  'partner_applications',
  'partners',
  'farmer_ownership_history',
  'sales_opportunities',
  'pack_scan_logs',
  'pack_sessions',
  'pick_list_lines',
  'pick_lists',
  'pick_waves',
  'order_line_allocations',
  'commerce_order_lines',
  'shipping_labels',
  'warehouse_label_batches',
  'invoice_lines',
  'invoices',
  'shipment_exceptions',
  'cod_reconciliation',
  'finance_daily_snapshots',
  'order_packages',
  'courier_payloads',
  'dispatch_sessions',
  'return_requests',
  'farmer_product_reviews',
  'commerce_quotes',
  'payment_events',
  'shipment_events',
  'checkout_sessions',
  'commerce_orders',
  'visit_ai_evidence_requests',
  'visit_ai_recommendations',
  'visit_ai_questions',
  'visit_ai_hypotheses',
  'visit_ai_cases',
  'issue_photos',
  'visit_measurements',
  'visit_issues',
  'farmer_notes',
  'ml_gold_queue',
  'ai_request_logs',
  'ai_training_events',
  'ai_accuracy_events',
  'ai_case_outcomes',
  'ai_learning_samples',
  'ai_advisory_outputs',
  'ai_product_recommendations',
  'advisory_automation_jobs',
  'advisory_reuse_cases',
  'learned_follow_up_questions',
  'disease_history',
  'crop_images',
  'farmer_image_hashes',
  'farmer_advisory_feedback',
  'agronomist_escalations',
  'ai_advisory_sessions',
  'advisory_faq_cache',
  'whatsapp_reply_attributions',
  'recommendation_follow_ups',
  'recommendation_applications',
  'recommendation_records',
  'weather_snapshots',
  'crm_task_comments',
  'crm_interaction_sessions',
  'telecaller_notes',
  'crm_internal_notes',
  'crm_manual_orders',
  'crm_field_findings',
  'crm_recommendations',
  'crm_soil_reports',
  'crm_water_reports',
  'crm_leaf_reports',
  'crm_pathogen_reports',
  'block_stress_flags',
  'crm_tasks',
  'crm_call_logs',
  'cultivation_activities',
  'pending_tasks',
  'roi_activity_costs',
  'farmer_timeline_entries',
  'harvest_records',
  'crop_seasons',
  'farmer_roi_audit_log',
  'farmer_roi_entries',
  'farmer_roi_categories',
  'farmer_messages',
  'terminology_learning_history',
  'farmer_language_patterns',
  'regional_issue_stats',
  'regional_protocol_stats',
  'regional_farm_clusters',
  'market_insight_snapshots',
  'opportunity_intelligence_alerts',
  'user_table_preferences',
  'seo_ai_jobs',
  'farmer_market_preferences',
  'whatsapp_broadcast_events',
  'whatsapp_broadcast_campaigns',
  'conversation_sessions',
  'farmer_otp_challenges',
  'interaction_logs',
  'webhook_logs',
  'event_outbox',
  'crm_sync_queue',
  'quotation_inquiries',
  'callback_requests',
  'farmer_agronomist_assignments',
  'farm_blocks',
  'farmer_crops',
  'leads',
  'farmers',
];

async function resetDemo(env) {
  console.log('Removing demo seed farmers and related CRM data…\n');

  const seedCount = await deleteByFilter(env, 'farmers', 'source=eq.seed');
  console.log(`  farmers (source=seed): ${seedCount}`);

  const phoneFilter = `phone=in.(${DEMO_PHONES.join(',')})`;
  const phoneCount = await deleteByFilter(env, 'farmers', phoneFilter);
  console.log(`  farmers (demo phones): ${phoneCount}`);

  const orphanLeads = await deleteByFilter(env, 'leads', 'farmer_id=is.null');
  console.log(`  orphan leads: ${orphanLeads}`);

  console.log('\nDemo reset complete. Re-test signup and WhatsApp with real numbers.');
}

async function resetFull(env) {
  console.log('FULL archive reset — deleting all transactional farmer data…\n');

  const tables = [
    'webhook_logs',
    'event_outbox',
    'crm_sync_queue',
    'ai_request_logs',
    'advisory_automation_jobs',
    'telecaller_notes',
    'ai_product_recommendations',
    'ai_advisory_outputs',
    'agronomist_escalations',
    'disease_history',
    'farmer_ai_usage_daily',
    'farmer_image_hashes',
    'ai_advisory_sessions',
    'crm_manual_orders',
    'crm_field_findings',
    'crm_recommendations',
    'crm_soil_reports',
    'farmer_agronomist_assignments',
    'farm_blocks',
    'crm_tasks',
    'crm_call_logs',
    'farmer_crops',
    'interaction_logs',
    'quotation_inquiries',
    'callback_requests',
    'leads',
    'payment_events',
    'shipment_events',
    'commerce_orders',
    'checkout_sessions',
    'farmers',
  ];

  for (const table of tables) {
    try {
      const n = await deleteAllRows(env, table);
      console.log(`  ${table}: ${n}`);
    } catch (e) {
      console.warn(`  ${table}: skipped (${e.message})`);
    }
  }

  console.log('\nFull reset complete.');
  console.log('Preserved: admin_users, crm_masters, advisory_faq_cache, product_intelligence, commerce promos.');
  console.log('Next: redeploy API, push theme, create staff with npm run admin:create-user, test real signup + WhatsApp.');
}

async function resetRetest(env) {
  console.log('RE-TEST reset — clearing farmer/CRM/AI/order data (employee & product DB preserved)…\n');

  for (const table of RETEST_TABLES) {
    try {
      const n = await deleteAllRows(env, table);
      if (n > 0) console.log(`  ${table}: ${n}`);
    } catch (e) {
      console.warn(`  ${table}: skipped (${e.message})`);
    }
  }

  for (const [table, filter] of RETEST_FILTER_DELETES) {
    try {
      const n = await deleteByFilter(env, table, filter);
      if (n > 0) console.log(`  ${table}: ${n}`);
    } catch (e) {
      console.warn(`  ${table}: skipped (${e.message})`);
    }
  }

  console.log('\nRe-test reset complete.');
  console.log(
    'Preserved: Morbeez employees (admin_users, payroll, attendance, KPI), ' +
      'product catalog (product_intelligence, combos, offers, packaging), ' +
      'inventory (inventory_items, batches, stock movements, POs), crm_masters, pincode_master, whatsapp templates.'
  );
  console.log('Next: test farmer signup, WhatsApp Crop Doctor, Telecaller CRM from a clean slate.');
}

function parseMode() {
  const args = process.argv.slice(2);
  const modeArg = args.find((a) => a.startsWith('--mode='))?.split('=')[1];
  if (args.includes('--confirm') && args.includes('--sql')) return 'sql';
  if (modeArg === 'retest' || modeArg === 'retest-sql') return modeArg;
  if (args.includes('--confirm') || modeArg === 'full') return 'full';
  if (modeArg === 'retest') return 'retest';
  return modeArg === 'demo' || !modeArg ? 'demo' : 'demo';
}

async function main() {
  const env = loadEnv();
  const mode = parseMode();

  if (mode === 'sql') {
    if (!process.argv.includes('--confirm')) {
      console.error('Re-run with: npm run db:reset-retest -- --confirm --sql');
      process.exit(1);
    }
    const { spawnSync } = await import('child_process');
    const r = spawnSync(
      process.execPath,
      ['scripts/run-sql-reset.mjs', 'scripts/sql/reset-transactional-keep-products.sql', '--confirm'],
      { cwd: root, stdio: 'inherit' }
    );
    process.exit(r.status ?? 1);
  }

  if (mode === 'retest' || mode === 'retest-sql') {
    if (!process.argv.includes('--confirm')) {
      console.error(
        'Re-test reset deletes ALL farmers, CRM, AI sessions, orders, and WhatsApp state.\n' +
          'Morbeez employee records and product/inventory catalog are preserved.\n' +
          'Re-run with: npm run db:reset-retest -- --confirm'
      );
      process.exit(1);
    }
    console.log('⚠️  RE-TEST RESET (transactional only)\n');
    await resetRetest(env);
    return;
  }

  if (mode === 'full') {
    if (!process.argv.includes('--confirm')) {
      console.error(
        'Full reset deletes ALL farmers, leads, orders, and AI sessions.\n' +
          'Re-run with: npm run archive:reset -- --confirm'
      );
      process.exit(1);
    }
    console.log('⚠️  PRODUCTION FULL RESET\n');
    await resetFull(env);
  } else {
    await resetDemo(env);
  }
}

main().catch((e) => {
  console.error(e.message || e);
  setTimeout(() => process.exit(1), 50);
});
