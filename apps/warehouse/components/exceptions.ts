const EXCEPTIONS = [
  { type: 'stock_missing', label: 'Stock missing' },
  { type: 'wrong_barcode', label: 'Wrong barcode' },
  { type: 'reprint_label', label: 'Reprint label' },
  { type: 'courier_failed', label: 'Courier failed' },
  { type: 'weight_mismatch', label: 'Weight mismatch' },
] as const;

export { EXCEPTIONS };
