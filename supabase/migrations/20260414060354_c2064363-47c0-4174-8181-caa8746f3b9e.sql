
ALTER TABLE public.about_featured_posts ADD COLUMN image_url text;

ALTER TABLE public.about_experience 
  ADD COLUMN image_url text,
  ADD COLUMN start_date date,
  ADD COLUMN end_date date,
  ADD COLUMN is_current boolean NOT NULL DEFAULT false;
