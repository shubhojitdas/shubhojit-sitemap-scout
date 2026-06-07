
-- 1. Roles
CREATE TYPE public.app_role AS ENUM ('admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Seed: existing auth user becomes admin
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users
ON CONFLICT DO NOTHING;

-- 2. Replace permissive policies on about_* tables
DROP POLICY IF EXISTS "Authenticated users can insert profile" ON public.about_profile;
DROP POLICY IF EXISTS "Authenticated users can update profile" ON public.about_profile;
CREATE POLICY "Admins can insert profile" ON public.about_profile
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update profile" ON public.about_profile
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated users can insert skills" ON public.about_skills;
DROP POLICY IF EXISTS "Authenticated users can update skills" ON public.about_skills;
DROP POLICY IF EXISTS "Authenticated users can delete skills" ON public.about_skills;
CREATE POLICY "Admins can insert skills" ON public.about_skills
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update skills" ON public.about_skills
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete skills" ON public.about_skills
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated users can insert featured posts" ON public.about_featured_posts;
DROP POLICY IF EXISTS "Authenticated users can update featured posts" ON public.about_featured_posts;
DROP POLICY IF EXISTS "Authenticated users can delete featured posts" ON public.about_featured_posts;
CREATE POLICY "Admins can insert featured posts" ON public.about_featured_posts
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update featured posts" ON public.about_featured_posts
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete featured posts" ON public.about_featured_posts
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated users can insert experience" ON public.about_experience;
DROP POLICY IF EXISTS "Authenticated users can update experience" ON public.about_experience;
DROP POLICY IF EXISTS "Authenticated users can delete experience" ON public.about_experience;
CREATE POLICY "Admins can insert experience" ON public.about_experience
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update experience" ON public.about_experience
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete experience" ON public.about_experience
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated users can insert achievements" ON public.about_experience_achievements;
DROP POLICY IF EXISTS "Authenticated users can update achievements" ON public.about_experience_achievements;
DROP POLICY IF EXISTS "Authenticated users can delete achievements" ON public.about_experience_achievements;
CREATE POLICY "Admins can insert achievements" ON public.about_experience_achievements
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update achievements" ON public.about_experience_achievements
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete achievements" ON public.about_experience_achievements
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 3. Storage: drop broad listing policy. Public bucket flag still serves direct file URLs.
DROP POLICY IF EXISTS "Anyone can view profile images" ON storage.objects;
