
-- Profile (single row)
CREATE TABLE public.about_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Shubhojit Das',
  title TEXT NOT NULL DEFAULT 'Technical SEO Specialist · Front-End Enthusiast',
  about_paragraphs TEXT[] NOT NULL DEFAULT '{}',
  linkedin_url TEXT DEFAULT 'https://www.linkedin.com/in/shubhojitdas/',
  image_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.about_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view profile" ON public.about_profile FOR SELECT USING (true);
CREATE POLICY "Authenticated users can update profile" ON public.about_profile FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can insert profile" ON public.about_profile FOR INSERT TO authenticated WITH CHECK (true);

-- Skills
CREATE TABLE public.about_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  icon_name TEXT NOT NULL DEFAULT 'Code',
  sort_order INT NOT NULL DEFAULT 0
);

ALTER TABLE public.about_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view skills" ON public.about_skills FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert skills" ON public.about_skills FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update skills" ON public.about_skills FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete skills" ON public.about_skills FOR DELETE TO authenticated USING (true);

-- Experience
CREATE TABLE public.about_experience (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL,
  company TEXT NOT NULL,
  period TEXT NOT NULL,
  description TEXT,
  featured_post_url TEXT,
  featured_post_title TEXT,
  sort_order INT NOT NULL DEFAULT 0
);

ALTER TABLE public.about_experience ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view experience" ON public.about_experience FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert experience" ON public.about_experience FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update experience" ON public.about_experience FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete experience" ON public.about_experience FOR DELETE TO authenticated USING (true);

-- Experience achievements
CREATE TABLE public.about_experience_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experience_id UUID NOT NULL REFERENCES public.about_experience(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

ALTER TABLE public.about_experience_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view achievements" ON public.about_experience_achievements FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert achievements" ON public.about_experience_achievements FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update achievements" ON public.about_experience_achievements FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete achievements" ON public.about_experience_achievements FOR DELETE TO authenticated USING (true);

-- Featured posts
CREATE TABLE public.about_featured_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  url TEXT NOT NULL,
  source_label TEXT DEFAULT 'LinkedIn',
  sort_order INT NOT NULL DEFAULT 0
);

ALTER TABLE public.about_featured_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view featured posts" ON public.about_featured_posts FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert featured posts" ON public.about_featured_posts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update featured posts" ON public.about_featured_posts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete featured posts" ON public.about_featured_posts FOR DELETE TO authenticated USING (true);

-- Storage bucket for profile images
INSERT INTO storage.buckets (id, name, public) VALUES ('profile-images', 'profile-images', true);

CREATE POLICY "Anyone can view profile images" ON storage.objects FOR SELECT USING (bucket_id = 'profile-images');
CREATE POLICY "Authenticated users can upload profile images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'profile-images');
CREATE POLICY "Authenticated users can update profile images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'profile-images');
CREATE POLICY "Authenticated users can delete profile images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'profile-images');
