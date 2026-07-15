-- 025: Add Client Feedback and Presentation & Hygiene ratings for venue dept reviews
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS rating_client_feedback smallint CHECK (rating_client_feedback BETWEEN 1 AND 5);
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS rating_presentation_hygiene smallint CHECK (rating_presentation_hygiene BETWEEN 1 AND 5);
