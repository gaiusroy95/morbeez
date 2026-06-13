#!/usr/bin/env node
/**
 * Backfill farmer ownership for legacy rows (default: Morbeez enrollment + remote advisory).
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  const { data, error } = await supabase
    .from('farmers')
    .select('id')
    .is('enrollment_owner_type', null)
    .limit(5000);
  if (error) throw error;

  let updated = 0;
  for (const row of data ?? []) {
    const { error: updErr } = await supabase
      .from('farmers')
      .update({
        enrollment_owner_type: 'morbeez',
        customer_owner_type: 'morbeez',
        service_model: 'remote_advisory',
        enrollment_source: 'legacy_backfill',
      })
      .eq('id', row.id);
    if (!updErr) updated += 1;
  }
  console.log(`Backfilled ownership on ${updated} farmers`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
