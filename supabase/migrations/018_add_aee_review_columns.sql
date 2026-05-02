-- 018: Extend reviews for AEE (Ambria Events)
-- rating_timely_execution, rating_poc_availability already exist

ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS rating_baraat           smallint CHECK (rating_baraat BETWEEN 1 AND 5);
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS rating_bridal_entry     smallint CHECK (rating_bridal_entry BETWEEN 1 AND 5);
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS rating_groom_entry      smallint CHECK (rating_groom_entry BETWEEN 1 AND 5);
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS rating_jaimala          smallint CHECK (rating_jaimala BETWEEN 1 AND 5);
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS rating_artist_quality   smallint CHECK (rating_artist_quality BETWEEN 1 AND 5);
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS rating_product_quality  smallint CHECK (rating_product_quality BETWEEN 1 AND 5);
