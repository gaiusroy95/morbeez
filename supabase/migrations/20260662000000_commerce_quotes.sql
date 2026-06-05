-- Standalone commerce quotes (pending → checkout → paid order)

CREATE TABLE IF NOT EXISTS commerce_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'checkout', 'paid', 'expired', 'cancelled')),
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_email TEXT,
  customer_state TEXT NOT NULL DEFAULT 'Karnataka',
  customer_gstin TEXT,
  shipping_address JSONB NOT NULL DEFAULT '{}',
  line_items JSONB NOT NULL DEFAULT '[]',
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  cgst NUMERIC(12, 2) NOT NULL DEFAULT 0,
  sgst NUMERIC(12, 2) NOT NULL DEFAULT 0,
  igst NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  payment_type TEXT NOT NULL DEFAULT 'advance'
    CHECK (payment_type IN ('full', 'partial', 'advance')),
  prepaid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  cod_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  checkout_token TEXT NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  expires_at TIMESTAMPTZ NOT NULL,
  checkout_session_id UUID,
  commerce_order_id UUID REFERENCES commerce_orders(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  shopify_order_id TEXT,
  shopify_order_name TEXT,
  created_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commerce_quotes_status ON commerce_quotes(status);
CREATE INDEX IF NOT EXISTS idx_commerce_quotes_expires ON commerce_quotes(expires_at);
CREATE INDEX IF NOT EXISTS idx_commerce_quotes_checkout_token ON commerce_quotes(checkout_token);

ALTER TABLE commerce_quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY commerce_quotes_all ON commerce_quotes FOR ALL USING (true);
