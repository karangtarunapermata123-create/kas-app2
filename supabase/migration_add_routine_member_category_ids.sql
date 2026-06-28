-- Add category_ids column to routine_members table
ALTER TABLE public.routine_members 
ADD COLUMN IF NOT EXISTS category_ids jsonb DEFAULT '[]'::jsonb;

-- Drop the old columns (optional, but recommended)
ALTER TABLE public.routine_members 
DROP COLUMN IF EXISTS joins_kas;
ALTER TABLE public.routine_members 
DROP COLUMN IF EXISTS joins_arisan;
