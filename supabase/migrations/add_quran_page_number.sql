-- Add page_number column to quran_progress table
ALTER TABLE quran_progress 
ADD COLUMN IF NOT EXISTS page_number integer;


