-- =====================================================
-- TRAVEL EXPENSES TABLE
-- =====================================================
-- Stores expenses related to travel/tour
-- Similar to expenses table but specific to travel

CREATE TABLE IF NOT EXISTS travel_expenses (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  amount numeric NOT NULL,
  description text,
  category text DEFAULT 'other' CHECK (category IN ('accommodation', 'food', 'transport', 'activities', 'shopping', 'other')),
  expense_date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  synced boolean DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_travel_expenses_user_id ON travel_expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_travel_expenses_expense_date ON travel_expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_travel_expenses_category ON travel_expenses(category);

ALTER TABLE travel_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own travel expenses"
  ON travel_expenses FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own travel expenses"
  ON travel_expenses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own travel expenses"
  ON travel_expenses FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own travel expenses"
  ON travel_expenses FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE travel_expenses IS 'Travel expenses - spending during travel/tour';
COMMENT ON COLUMN travel_expenses.category IS 'Category: accommodation, food, transport, activities, shopping, other';
COMMENT ON COLUMN travel_expenses.amount IS 'Expense amount';
COMMENT ON COLUMN travel_expenses.expense_date IS 'Date of the expense';

