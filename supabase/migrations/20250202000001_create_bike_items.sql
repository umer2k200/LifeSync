-- =====================================================
-- BIKE ITEMS TABLE (Things to Buy)
-- =====================================================
-- Stores items to buy for bike maintenance/upgrades

CREATE TABLE IF NOT EXISTS bike_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  is_completed boolean DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  synced boolean DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_bike_items_user_id ON bike_items(user_id);
CREATE INDEX IF NOT EXISTS idx_bike_items_is_completed ON bike_items(is_completed);
CREATE INDEX IF NOT EXISTS idx_bike_items_priority ON bike_items(priority);

ALTER TABLE bike_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bike items"
  ON bike_items FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bike items"
  ON bike_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bike items"
  ON bike_items FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own bike items"
  ON bike_items FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE bike_items IS 'Bike items to buy - parts, accessories, etc.';
COMMENT ON COLUMN bike_items.priority IS 'Priority level: low, medium, or high';
COMMENT ON COLUMN bike_items.is_completed IS 'Whether the item has been purchased';

-- =====================================================
-- BIKE TASKS TABLE (Work to Do)
-- =====================================================
-- Stores bike maintenance tasks like oil change, tire rotation, etc.

CREATE TABLE IF NOT EXISTS bike_tasks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  due_date timestamptz,
  is_completed boolean DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  synced boolean DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_bike_tasks_user_id ON bike_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_bike_tasks_is_completed ON bike_tasks(is_completed);
CREATE INDEX IF NOT EXISTS idx_bike_tasks_priority ON bike_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_bike_tasks_due_date ON bike_tasks(due_date);

ALTER TABLE bike_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bike tasks"
  ON bike_tasks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bike tasks"
  ON bike_tasks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bike tasks"
  ON bike_tasks FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own bike tasks"
  ON bike_tasks FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE bike_tasks IS 'Bike maintenance tasks - oil change, tire rotation, etc.';
COMMENT ON COLUMN bike_tasks.priority IS 'Priority level: low, medium, or high';
COMMENT ON COLUMN bike_tasks.due_date IS 'Due date for the maintenance task';
COMMENT ON COLUMN bike_tasks.is_completed IS 'Whether the task has been completed';
