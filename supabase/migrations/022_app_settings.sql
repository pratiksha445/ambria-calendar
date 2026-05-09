-- App-level settings (key-value store)
CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT 'off',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

-- Seed the kill switch row (default off)
INSERT INTO app_settings (key, value)
VALUES ('kill_switch', 'off')
ON CONFLICT (key) DO NOTHING;

-- Allow all authenticated users to read settings
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read settings"
  ON app_settings FOR SELECT
  USING (true);

CREATE POLICY "Only admins can update settings"
  ON app_settings FOR UPDATE
  USING (true);
