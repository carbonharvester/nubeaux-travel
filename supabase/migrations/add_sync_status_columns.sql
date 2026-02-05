-- ============================================
-- Add Background Sync Status Columns to Creators Table
-- ============================================
-- Run this SQL in your Supabase SQL Editor
-- ============================================

-- Add sync_status column to track background sync state
-- Values: 'pending', 'syncing', 'completed', 'failed'
ALTER TABLE creators
ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'pending';

-- Add last_synced_at to track when content was last synced
ALTER TABLE creators
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- Add run IDs to track active Apify runs
ALTER TABLE creators
ADD COLUMN IF NOT EXISTS posts_run_id TEXT;

ALTER TABLE creators
ADD COLUMN IF NOT EXISTS highlights_run_id TEXT;

-- Create index for faster sync status queries
CREATE INDEX IF NOT EXISTS idx_creators_sync_status ON creators(sync_status);

-- Comment explaining the columns
COMMENT ON COLUMN creators.sync_status IS 'Background sync status: pending, syncing, completed, failed';
COMMENT ON COLUMN creators.last_synced_at IS 'Timestamp of last successful content sync';
COMMENT ON COLUMN creators.posts_run_id IS 'Active Apify run ID for posts sync';
COMMENT ON COLUMN creators.highlights_run_id IS 'Active Apify run ID for highlights sync';

-- ============================================
-- DONE!
-- ============================================
