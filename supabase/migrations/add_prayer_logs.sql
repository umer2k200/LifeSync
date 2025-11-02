-- Create prayer_logs table for tracking 5 daily prayers
CREATE TABLE IF NOT EXISTS prayer_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  prayer_name text NOT NULL CHECK (prayer_name IN ('Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha')),
  completed_at date NOT NULL,
  created_at timestamptz DEFAULT now(),
  synced boolean DEFAULT false,
  UNIQUE(user_id, prayer_name, completed_at)
);

ALTER TABLE prayer_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own prayer logs"
  ON prayer_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own prayer logs"
  ON prayer_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own prayer logs"
  ON prayer_logs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_prayer_logs_user_id ON prayer_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_prayer_logs_completed_at ON prayer_logs(completed_at);

