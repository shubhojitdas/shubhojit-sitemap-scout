DROP POLICY IF EXISTS "Admins can insert profile" ON public.about_profile;
DROP POLICY IF EXISTS "Admins can update profile" ON public.about_profile;
DROP POLICY IF EXISTS "Admins can insert skills" ON public.about_skills;
DROP POLICY IF EXISTS "Admins can update skills" ON public.about_skills;
DROP POLICY IF EXISTS "Admins can delete skills" ON public.about_skills;
DROP POLICY IF EXISTS "Admins can insert experience" ON public.about_experience;
DROP POLICY IF EXISTS "Admins can update experience" ON public.about_experience;
DROP POLICY IF EXISTS "Admins can delete experience" ON public.about_experience;
DROP POLICY IF EXISTS "Admins can insert achievements" ON public.about_experience_achievements;
DROP POLICY IF EXISTS "Admins can update achievements" ON public.about_experience_achievements;
DROP POLICY IF EXISTS "Admins can delete achievements" ON public.about_experience_achievements;
DROP POLICY IF EXISTS "Admins can insert featured posts" ON public.about_featured_posts;
DROP POLICY IF EXISTS "Admins can update featured posts" ON public.about_featured_posts;
DROP POLICY IF EXISTS "Admins can delete featured posts" ON public.about_featured_posts;
DROP POLICY IF EXISTS "Admins can upload profile images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update profile images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete profile images" ON storage.objects;

CREATE POLICY "Admins can insert profile"
ON public.about_profile
FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'admin'::public.app_role
));

CREATE POLICY "Admins can update profile"
ON public.about_profile
FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'admin'::public.app_role
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'admin'::public.app_role
));

CREATE POLICY "Admins can insert skills"
ON public.about_skills
FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'admin'::public.app_role
));

CREATE POLICY "Admins can update skills"
ON public.about_skills
FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'admin'::public.app_role
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'admin'::public.app_role
));

CREATE POLICY "Admins can delete skills"
ON public.about_skills
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'admin'::public.app_role
));

CREATE POLICY "Admins can insert experience"
ON public.about_experience
FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'admin'::public.app_role
));

CREATE POLICY "Admins can update experience"
ON public.about_experience
FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'admin'::public.app_role
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'admin'::public.app_role
));

CREATE POLICY "Admins can delete experience"
ON public.about_experience
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'admin'::public.app_role
));

CREATE POLICY "Admins can insert achievements"
ON public.about_experience_achievements
FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'admin'::public.app_role
));

CREATE POLICY "Admins can update achievements"
ON public.about_experience_achievements
FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'admin'::public.app_role
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'admin'::public.app_role
));

CREATE POLICY "Admins can delete achievements"
ON public.about_experience_achievements
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'admin'::public.app_role
));

CREATE POLICY "Admins can insert featured posts"
ON public.about_featured_posts
FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'admin'::public.app_role
));

CREATE POLICY "Admins can update featured posts"
ON public.about_featured_posts
FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'admin'::public.app_role
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'admin'::public.app_role
));

CREATE POLICY "Admins can delete featured posts"
ON public.about_featured_posts
FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'admin'::public.app_role
));

CREATE POLICY "Admins can upload profile images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-images'
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'::public.app_role
  )
);

CREATE POLICY "Admins can update profile images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-images'
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'::public.app_role
  )
)
WITH CHECK (
  bucket_id = 'profile-images'
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'::public.app_role
  )
);

CREATE POLICY "Admins can delete profile images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-images'
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'::public.app_role
  )
);

DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);