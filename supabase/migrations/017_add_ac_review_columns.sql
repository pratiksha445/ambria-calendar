-- 017: Extend reviews for AC (Ambria Cuisine)
-- rating_transport, rating_timely_execution, rating_poc_availability already exist

ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS rating_chaat          smallint CHECK (rating_chaat BETWEEN 1 AND 5);
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS rating_beverages      smallint CHECK (rating_beverages BETWEEN 1 AND 5);
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS rating_main_course    smallint CHECK (rating_main_course BETWEEN 1 AND 5);
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS rating_pre_dining     smallint CHECK (rating_pre_dining BETWEEN 1 AND 5);
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS rating_desserts       smallint CHECK (rating_desserts BETWEEN 1 AND 5);
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS rating_service_staff  smallint CHECK (rating_service_staff BETWEEN 1 AND 5);
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS rating_quality        smallint CHECK (rating_quality BETWEEN 1 AND 5);
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS rating_hygiene        smallint CHECK (rating_hygiene BETWEEN 1 AND 5);
