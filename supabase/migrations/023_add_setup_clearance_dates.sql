-- Setup and clearance dates for own-venue bookings (AP/AM/AE/AR).
-- setup_date: typically one day before the event (decor dumping/setup).
-- clearance_date: typically one day after the event (teardown).
ALTER TABLE events ADD COLUMN IF NOT EXISTS setup_date DATE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS clearance_date DATE;
