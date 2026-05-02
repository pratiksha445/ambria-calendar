-- 016: Extend reviews for ADD (Ambria Design & Decor)
-- Make venue-specific rating columns nullable (ADD reviews won't use them)
ALTER TABLE public.reviews ALTER COLUMN rating_food DROP NOT NULL;
ALTER TABLE public.reviews ALTER COLUMN rating_service DROP NOT NULL;
ALTER TABLE public.reviews ALTER COLUMN rating_decor DROP NOT NULL;
ALTER TABLE public.reviews ALTER COLUMN rating_entertainment DROP NOT NULL;
ALTER TABLE public.reviews ALTER COLUMN rating_housekeeping DROP NOT NULL;
ALTER TABLE public.reviews ALTER COLUMN rating_valet DROP NOT NULL;
ALTER TABLE public.reviews ALTER COLUMN rating_overall DROP NOT NULL;

-- Add ADD-specific rating columns (nullable — venue reviews won't use them)
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS rating_furniture          smallint CHECK (rating_furniture BETWEEN 1 AND 5);
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS rating_structure_fabric   smallint CHECK (rating_structure_fabric BETWEEN 1 AND 5);
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS rating_floral            smallint CHECK (rating_floral BETWEEN 1 AND 5);
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS rating_transport         smallint CHECK (rating_transport BETWEEN 1 AND 5);
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS rating_light             smallint CHECK (rating_light BETWEEN 1 AND 5);
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS rating_timely_execution  smallint CHECK (rating_timely_execution BETWEEN 1 AND 5);
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS rating_cleanliness       smallint CHECK (rating_cleanliness BETWEEN 1 AND 5);
