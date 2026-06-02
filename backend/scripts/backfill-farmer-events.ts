/**
 * Backfill farmer_events from interaction_logs (WhatsApp only).
 *
 * Usage (from backend/):
 *   npx tsx scripts/backfill-farmer-events.ts [--dry-run] [--limit=5000]
 */
import { supabase } from '../src/lib/supabase.js';
import { farmerEventCaptureService } from '../src/services/intelligence/farmer-event-capture.service.js';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.find((a) => a.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.split('=')[1]) : 5000;

async function main() {
  const { data: rows, error } = await supabase
    .from('interaction_logs')
    .select('id, farmer_id, direction, message_type, content, external_message_id, created_at')
    .eq('channel', 'whatsapp')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Failed to load interaction_logs:', error.message);
    process.exit(1);
  }

  let processed = 0;
  let skipped = 0;

  for (const row of rows ?? []) {
    const farmerId = String(row.farmer_id);
    const direction = row.direction === 'inbound' ? 'inbound' : 'outbound';
    const externalMessageId = row.external_message_id
      ? String(row.external_message_id)
      : `ilog:${row.id}`;

    if (dryRun) {
      processed++;
      continue;
    }

    try {
      await farmerEventCaptureService.captureWhatsAppInteraction({
        farmerId,
        direction,
        messageType: String(row.message_type ?? 'text'),
        externalMessageId,
        contentPreview: String(row.content ?? '').slice(0, 200),
        occurredAt: String(row.created_at),
      });
      processed++;
    } catch {
      skipped++;
    }
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        loaded: rows?.length ?? 0,
        processed,
        skipped,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
