-- 020: Extend reviews for Villa bookings
-- rating_housekeeping already exists from venue reviews (014)
-- review_payment_status, remark already exist

ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS rating_checkin_readiness    smallint CHECK (rating_checkin_readiness BETWEEN 1 AND 5);
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS rating_amenities            smallint CHECK (rating_amenities BETWEEN 1 AND 5);
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS rating_food_service         smallint CHECK (rating_food_service BETWEEN 1 AND 5);
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS rating_team_coordination    smallint CHECK (rating_team_coordination BETWEEN 1 AND 5);
