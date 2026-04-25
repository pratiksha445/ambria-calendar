-- Add pheras_next_day boolean for post-midnight ceremony times
ALTER TABLE events ADD COLUMN IF NOT EXISTS pheras_next_day boolean DEFAULT false;
