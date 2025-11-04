-- =====================================================
-- TRAVEL PLACES TABLE (Places to Visit)
-- =====================================================
-- Stores places to visit during travel/tour

CREATE TABLE IF NOT EXISTS travel_places (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  location text,
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  visit_date timestamptz,
  is_completed boolean DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  synced boolean DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_travel_places_user_id ON travel_places(user_id);
CREATE INDEX IF NOT EXISTS idx_travel_places_is_completed ON travel_places(is_completed);
CREATE INDEX IF NOT EXISTS idx_travel_places_priority ON travel_places(priority);
CREATE INDEX IF NOT EXISTS idx_travel_places_visit_date ON travel_places(visit_date);

ALTER TABLE travel_places ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own travel places"
  ON travel_places FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own travel places"
  ON travel_places FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own travel places"
  ON travel_places FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own travel places"
  ON travel_places FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE travel_places IS 'Travel places to visit - destinations, attractions, etc.';
COMMENT ON COLUMN travel_places.priority IS 'Priority level: low, medium, or high';
COMMENT ON COLUMN travel_places.visit_date IS 'Planned date to visit this place';
COMMENT ON COLUMN travel_places.location IS 'Location or address of the place';
COMMENT ON COLUMN travel_places.is_completed IS 'Whether the place has been visited';

-- =====================================================
-- TRAVEL ITEMS TABLE (Packing List)
-- =====================================================
-- Stores items to pack when traveling

CREATE TABLE IF NOT EXISTS travel_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  category text DEFAULT 'general' CHECK (category IN ('general', 'clothing', 'electronics', 'documents', 'toiletries', 'food', 'other')),
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status text DEFAULT 'not_packed' CHECK (status IN ('not_packed', 'packing', 'packed')),
  is_completed boolean DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  synced boolean DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_travel_items_user_id ON travel_items(user_id);
CREATE INDEX IF NOT EXISTS idx_travel_items_is_completed ON travel_items(is_completed);
CREATE INDEX IF NOT EXISTS idx_travel_items_priority ON travel_items(priority);
CREATE INDEX IF NOT EXISTS idx_travel_items_category ON travel_items(category);
CREATE INDEX IF NOT EXISTS idx_travel_items_status ON travel_items(status);

ALTER TABLE travel_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own travel items"
  ON travel_items FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own travel items"
  ON travel_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own travel items"
  ON travel_items FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own travel items"
  ON travel_items FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE travel_items IS 'Travel packing list items - things to pack when traveling';
COMMENT ON COLUMN travel_items.priority IS 'Priority level: low, medium, or high';
COMMENT ON COLUMN travel_items.category IS 'Category of the item: general, clothing, electronics, documents, toiletries, food, other';
COMMENT ON COLUMN travel_items.status IS 'Packing status: not_packed, packing, or packed';
COMMENT ON COLUMN travel_items.is_completed IS 'Whether the item has been packed';

