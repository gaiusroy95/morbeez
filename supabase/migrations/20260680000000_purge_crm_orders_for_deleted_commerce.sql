-- Remove CRM manual order rows that mirror admin-deleted commerce orders
DELETE FROM crm_manual_orders mo
USING commerce_orders co
WHERE mo.commerce_order_id = co.id
  AND co.deleted_at IS NOT NULL;
