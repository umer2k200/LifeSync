-- =====================================================
-- ADD is_production COLUMN TO push_tokens TABLE
-- =====================================================
-- This column distinguishes production builds from Expo Go tokens
-- Expo Go tokens should not receive notifications after app removal

ALTER TABLE push_tokens 
ADD COLUMN IF NOT EXISTS is_production boolean DEFAULT true;

-- Update existing tokens to be marked as production (safe default)
-- If you want to mark existing Expo Go tokens, you can update them manually
UPDATE push_tokens 
SET is_production = true 
WHERE is_production IS NULL;

-- Add index for filtering production tokens
CREATE INDEX IF NOT EXISTS idx_push_tokens_is_production ON push_tokens(is_production);

-- Add comment for documentation
COMMENT ON COLUMN push_tokens.is_production IS 'True for production builds, false for Expo Go (development). Only production tokens should receive push notifications.';
