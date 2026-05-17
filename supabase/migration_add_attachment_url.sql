-- Migration: Add attachment_url column to transactions table
-- Date: 2024
-- Description: Add support for file attachments in transactions

-- Add attachment_url column to transactions table
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS attachment_url TEXT;

-- Add comment to column
COMMENT ON COLUMN transactions.attachment_url IS 'URL of attachment file stored in Supabase Storage (transaction-attachments bucket)';

-- Create index for faster queries on transactions with attachments
CREATE INDEX IF NOT EXISTS idx_transactions_attachment_url 
ON transactions(attachment_url) 
WHERE attachment_url IS NOT NULL;
