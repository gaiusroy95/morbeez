-- Product wizard media (images, PDFs, videos) for commerce catalog

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-assets',
  'product-assets',
  true,
  52428800,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'video/mp4',
    'video/quicktime'
  ]::text[]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY product_assets_select ON storage.objects
  FOR SELECT USING (bucket_id = 'product-assets');

CREATE POLICY product_assets_insert ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'product-assets');

CREATE POLICY product_assets_update ON storage.objects
  FOR UPDATE USING (bucket_id = 'product-assets');

CREATE POLICY product_assets_delete ON storage.objects
  FOR DELETE USING (bucket_id = 'product-assets');
