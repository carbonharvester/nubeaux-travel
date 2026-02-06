-- ============================================
-- JUNO Travel - Voice Calls Table
-- ============================================
-- Run this SQL in your Supabase SQL Editor
-- to add voice call tracking support
-- ============================================

-- Voice calls table - stores Retell AI call data
CREATE TABLE IF NOT EXISTS voice_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retell_call_id TEXT UNIQUE NOT NULL,
  agent_id TEXT,
  transcript TEXT,
  transcript_json JSONB,
  call_summary TEXT,
  caller_name TEXT,
  caller_email TEXT,
  caller_phone TEXT,
  destination_interest TEXT,
  travel_dates TEXT,
  travelers TEXT,
  budget TEXT,
  call_duration_seconds INTEGER,
  call_status TEXT,
  page_url TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_voice_calls_created ON voice_calls(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_calls_status ON voice_calls(call_status);
CREATE INDEX IF NOT EXISTS idx_voice_calls_retell_id ON voice_calls(retell_call_id);

-- Enable RLS
ALTER TABLE voice_calls ENABLE ROW LEVEL SECURITY;

-- Policy: Allow inserts from webhook (anon/service role)
CREATE POLICY "Allow webhook inserts" ON voice_calls
  FOR INSERT WITH CHECK (true);

-- Policy: Allow service role to read all
CREATE POLICY "Service role reads all" ON voice_calls
  FOR SELECT USING (true);
