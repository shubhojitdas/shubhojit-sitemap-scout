DROP POLICY IF EXISTS "Authenticated users can upload profile images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update profile images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete profile images" ON storage.objects;

CREATE POLICY "Admins can upload profile images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'profile-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update profile images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'profile-images' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'profile-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete profile images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'profile-images' AND public.has_role(auth.uid(), 'admin'));