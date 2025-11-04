-- =====================================================
-- SHOPPING LIST ITEMS TABLE
-- =====================================================
-- Stores shopping list items for users
-- Similar to tasks but specifically for things to buy

CREATE TABLE IF NOT EXISTS shopping_list_items (
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

CREATE INDEX IF NOT EXISTS idx_shopping_list_items_user_id ON shopping_list_items(user_id);
CREATE INDEX IF NOT EXISTS idx_shopping_list_items_is_completed ON shopping_list_items(is_completed);
CREATE INDEX IF NOT EXISTS idx_shopping_list_items_priority ON shopping_list_items(priority);

ALTER TABLE shopping_list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own shopping list items"
  ON shopping_list_items FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own shopping list items"
  ON shopping_list_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own shopping list items"
  ON shopping_list_items FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own shopping list items"
  ON shopping_list_items FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE shopping_list_items IS 'Shopping list items - things to buy';
COMMENT ON COLUMN shopping_list_items.priority IS 'Priority level: low, medium, or high';
COMMENT ON COLUMN shopping_list_items.is_completed IS 'Whether the item has been purchased';
