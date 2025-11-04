-- =====================================================
-- REMOVE PRIORITY AND STATUS FROM TRAVEL ITEMS TABLE
-- =====================================================
-- Removes priority and status columns from travel_items table
-- Status is redundant since is_completed already tracks packing status
-- This migration is for existing travel_items table

-- Remove priority column from travel_items if it exists
-- Note: This will remove priority feature from packing list items
ALTER TABLE travel_items
DROP COLUMN IF EXISTS priority;

-- Remove status column from travel_items if it exists
-- Note: Status is redundant - is_completed already tracks packing status
ALTER TABLE travel_items
DROP COLUMN IF EXISTS status;

-- Drop status index if it exists
DROP INDEX IF EXISTS idx_travel_items_status;

