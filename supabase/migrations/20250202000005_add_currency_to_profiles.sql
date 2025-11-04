-- =====================================================
-- ADD CURRENCY COLUMN TO PROFILES
-- =====================================================
-- This migration adds a currency column to the profiles table
-- to store user's preferred currency as JSON

-- Add currency column
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS currency text;

-- Set default currency for existing users (PKR)
UPDATE profiles
SET currency = '{"symbol":"Rs.","code":"PKR","name":"Pakistani Rupee"}'
WHERE currency IS NULL;

