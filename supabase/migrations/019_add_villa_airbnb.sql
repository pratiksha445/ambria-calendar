-- 019: Add airbnb boolean to events for Villa bookings

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS airbnb boolean NOT NULL DEFAULT false;
