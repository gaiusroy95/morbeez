-- Case review: one queue row per farmer request (not one open row per farmer).

DROP INDEX IF EXISTS idx_escalations_one_open_per_farmer;

COMMENT ON TABLE agronomist_escalations IS
  'Agronomist case review queue — multiple open rows per farmer allowed (one per advisory / WhatsApp request).';
