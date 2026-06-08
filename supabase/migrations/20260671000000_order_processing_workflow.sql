-- Order processing workflow: returns/refunds, dispatch scan, audit logs

ALTER TABLE commerce_orders
  ADD COLUMN IF NOT EXISTS order_source TEXT NOT NULL DEFAULT 'website'
    CHECK (order_source IN ('website', 'telecaller_quote', 'telecaller_manual', 'commerce_hub')),
  ADD COLUMN IF NOT EXISTS courier_name TEXT,
  ADD COLUMN IF NOT EXISTS payment_method TEXT;

CREATE INDEX IF NOT EXISTS idx_commerce_orders_source ON commerce_orders(order_source);

-- Dispatch handoff verification (AWB scan before shipped)
CREATE TABLE dispatch_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commerce_order_id UUID NOT NULL REFERENCES commerce_orders(id) ON DELETE CASCADE,
  pick_list_id UUID REFERENCES pick_lists(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'verified', 'cancelled')),
  awb_code TEXT,
  courier_name TEXT,
  verified_by TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dispatch_sessions_order ON dispatch_sessions(commerce_order_id);

CREATE TABLE dispatch_scan_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_session_id UUID NOT NULL REFERENCES dispatch_sessions(id) ON DELETE CASCADE,
  scanned_code TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('ok', 'wrong_awb', 'unknown')),
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Customer return / refund workflow
CREATE TABLE return_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commerce_order_id UUID NOT NULL REFERENCES commerce_orders(id) ON DELETE CASCADE,
  return_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN (
      'requested',
      'verification_pending',
      'approved',
      'rejected',
      'received',
      'inspected',
      'refund_pending',
      'refund_completed',
      'closed'
    )),
  reason TEXT NOT NULL,
  customer_complaint TEXT,
  verification_call_done BOOLEAN NOT NULL DEFAULT FALSE,
  verified_by TEXT,
  verified_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  inspection_notes TEXT,
  product_condition TEXT CHECK (product_condition IN ('resalable', 'damaged', 'quarantine', 'unknown')),
  refund_type TEXT CHECK (refund_type IN ('full', 'partial', 'none')),
  refund_amount DECIMAL(12, 2),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  credit_note_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  stock_action TEXT CHECK (stock_action IN ('resalable', 'damaged', 'quarantine', 'writeoff')),
  lines JSONB NOT NULL DEFAULT '[]',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_return_requests_order ON return_requests(commerce_order_id);
CREATE INDEX idx_return_requests_status ON return_requests(status);

-- Employee action audit trail
CREATE TABLE employee_action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_email TEXT NOT NULL,
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_employee_action_logs_entity ON employee_action_logs(entity_type, entity_id);
CREATE INDEX idx_employee_action_logs_actor ON employee_action_logs(actor_email, created_at DESC);

ALTER TABLE dispatch_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_scan_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_action_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY dispatch_sessions_service ON dispatch_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY dispatch_scan_logs_service ON dispatch_scan_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY return_requests_service ON return_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY employee_action_logs_service ON employee_action_logs FOR ALL USING (true) WITH CHECK (true);
