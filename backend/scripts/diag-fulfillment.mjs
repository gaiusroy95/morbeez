import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envText = readFileSync(resolve(__dirname, '../.env'), 'utf8');
const env = Object.fromEntries(
  envText
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')];
    })
);

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const statuses = ['confirmed', 'awb_generated', 'picking', 'packed', 'ready_dispatch'];

const { data: orders, error: oErr } = await supabase
  .from('commerce_orders')
  .select(
    `id, order_name, oms_status,
     pick_lists(id, pick_list_lines(id, qty_required)),
     commerce_order_lines(id, sku, product_title, qty_ordered, inventory_item_id)`
  )
  .in('oms_status', statuses)
  .order('created_at', { ascending: true })
  .limit(10);

if (oErr) {
  console.error('orders error', oErr);
  process.exit(1);
}

console.log('=== FULFILLMENT ORDERS ===');
for (const o of orders ?? []) {
  const picks = Array.isArray(o.pick_lists) ? o.pick_lists : o.pick_lists ? [o.pick_lists] : [];
  const pickLines = picks.flatMap((p) => p.pick_list_lines ?? []);
  const orderQty = (o.commerce_order_lines ?? []).reduce((s, l) => s + Number(l.qty_ordered), 0);
  console.log('\n', o.order_name, o.oms_status);
  console.log('  pick_lists:', picks.length, 'pick_lines:', pickLines.length, 'order_qty:', orderQty);
  for (const l of o.commerce_order_lines ?? []) {
    console.log('  line:', l.product_title, 'sku:', l.sku, 'item:', l.inventory_item_id);
    if (l.inventory_item_id) {
      const { data: item } = await supabase
        .from('inventory_items')
        .select('sku, shopify_variant_id')
        .eq('id', l.inventory_item_id)
        .maybeSingle();
      const { data: wh } = await supabase.from('warehouses').select('id').eq('active', true).limit(1).maybeSingle();
      const { data: batches } = await supabase
        .from('inventory_batches')
        .select('batch_code, qty_on_hand, qty_reserved')
        .eq('inventory_item_id', l.inventory_item_id)
        .eq('warehouse_id', wh?.id ?? '');
      const { data: cb } = item?.shopify_variant_id
        ? await supabase
            .from('commerce_stock_batches')
            .select('batch_code, qty')
            .eq('shopify_variant_id', item.shopify_variant_id)
        : { data: [] };
      console.log('    inv_item:', item);
      console.log('    wh_batches:', batches);
      console.log('    commerce_batches:', cb);
    }
  }
}

const { count: commerceBatchCount } = await supabase
  .from('commerce_stock_batches')
  .select('id', { count: 'exact', head: true });
const { count: whBatchCount } = await supabase
  .from('inventory_batches')
  .select('id', { count: 'exact', head: true });

console.log('\n=== TOTALS ===');
console.log('commerce_stock_batches:', commerceBatchCount);
console.log('inventory_batches:', whBatchCount);
