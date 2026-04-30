CREATE POLICY "postmedia_owner_update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'post-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'post-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);