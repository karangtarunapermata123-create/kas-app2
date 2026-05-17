-- Migration: Add transferred flag to routine_checklists table
-- This allows marking routine checklist items as transferred to transaction book

ALTER TABLE routine_checklists 
ADD COLUMN transferred BOOLEAN DEFAULT FALSE;

-- Add index for better query performance
CREATE INDEX idx_routine_checklists_transferred 
ON routine_checklists(book_id, period_key, category_id, transferred);