-- Create tasbeehs table for managing tasbeeh list
CREATE TABLE IF NOT EXISTS tasbeehs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  target_count integer NOT NULL DEFAULT 33,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  synced boolean DEFAULT false
);

ALTER TABLE tasbeehs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tasbeehs"
  ON tasbeehs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tasbeehs"
  ON tasbeehs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tasbeehs"
  ON tasbeehs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own tasbeehs"
  ON tasbeehs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_tasbeehs_user_id ON tasbeehs(user_id);

