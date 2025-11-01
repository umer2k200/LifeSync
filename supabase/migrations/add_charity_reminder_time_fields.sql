-- Add reminder_hour and reminder_minute fields to charity_reminders table
ALTER TABLE charity_reminders
ADD COLUMN IF NOT EXISTS reminder_hour INTEGER DEFAULT 18,
ADD COLUMN IF NOT EXISTS reminder_minute INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS notification_id TEXT;

