-- =====================================================
-- WATER REMINDER SETTINGS TABLE
-- =====================================================
-- Stores user-configurable water reminder settings

CREATE TABLE IF NOT EXISTS water_reminder_settings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  enabled boolean DEFAULT false,
  interval_hours integer DEFAULT 2, -- Interval between reminders (in hours)
  start_hour integer DEFAULT 8, -- Start time (0-23)
  start_minute integer DEFAULT 0, -- Start minute (0-59)
  end_hour integer DEFAULT 22, -- End time (0-23)
  end_minute integer DEFAULT 0, -- End minute (0-59)
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  synced boolean DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_water_reminder_settings_user_id ON water_reminder_settings(user_id);

ALTER TABLE water_reminder_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own water reminder settings"
  ON water_reminder_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own water reminder settings"
  ON water_reminder_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own water reminder settings"
  ON water_reminder_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own water reminder settings"
  ON water_reminder_settings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE water_reminder_settings IS 'User-configurable settings for water intake reminders';
COMMENT ON COLUMN water_reminder_settings.interval_hours IS 'Hours between each reminder (1-12)';
COMMENT ON COLUMN water_reminder_settings.start_hour IS 'Starting hour for reminders (0-23)';
COMMENT ON COLUMN water_reminder_settings.end_hour IS 'Ending hour for reminders (0-23)';
