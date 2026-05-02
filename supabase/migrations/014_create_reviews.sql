-- 014: Post-event reviews for AP/AM/AE/AR bookings
-- One review per event (unique on event_id)

CREATE TABLE IF NOT EXISTS public.reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  review_payment_status text NOT NULL CHECK (review_payment_status IN ('Completed', 'Pending')),
  rating_food             smallint NOT NULL CHECK (rating_food BETWEEN 1 AND 5),
  rating_service          smallint NOT NULL CHECK (rating_service BETWEEN 1 AND 5),
  rating_decor            smallint NOT NULL CHECK (rating_decor BETWEEN 1 AND 5),
  rating_entertainment    smallint NOT NULL CHECK (rating_entertainment BETWEEN 1 AND 5),
  rating_housekeeping     smallint NOT NULL CHECK (rating_housekeeping BETWEEN 1 AND 5),
  rating_valet            smallint NOT NULL CHECK (rating_valet BETWEEN 1 AND 5),
  rating_overall          smallint NOT NULL CHECK (rating_overall BETWEEN 1 AND 5),
  rating_poc_availability smallint NOT NULL CHECK (rating_poc_availability BETWEEN 1 AND 5),
  remark          text,
  submitted_by    uuid REFERENCES public.users(id),
  submitted_by_name text,
  submitted_at    timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reviews_event_unique UNIQUE (event_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reviews_event_id ON public.reviews(event_id);
CREATE INDEX IF NOT EXISTS idx_reviews_submitted_at ON public.reviews(submitted_at DESC);

-- Enable RLS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read reviews
CREATE POLICY "Anyone can read reviews"
  ON public.reviews FOR SELECT
  USING (true);

-- Allow insert/update for all (app-level auth checks who can submit)
CREATE POLICY "Anyone can insert reviews"
  ON public.reviews FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update reviews"
  ON public.reviews FOR UPDATE
  USING (true);
