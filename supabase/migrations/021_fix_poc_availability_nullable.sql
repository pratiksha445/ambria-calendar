-- 021: Make rating_poc_availability nullable
-- Migration 016 dropped NOT NULL from the other AP/AM rating columns but
-- missed rating_poc_availability.  Villa reviews do not include this column,
-- so the NOT NULL constraint causes every Villa review insert to fail.

ALTER TABLE public.reviews ALTER COLUMN rating_poc_availability DROP NOT NULL;
