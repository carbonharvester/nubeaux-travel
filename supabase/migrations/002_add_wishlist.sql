-- Add wishlist table for travelers to save itineraries
-- Run this SQL in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS wishlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  itinerary_id TEXT REFERENCES itineraries(id) ON DELETE CASCADE,
  email TEXT, -- Optional: if user provides email to sync across devices
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, itinerary_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_wishlists_session ON wishlists(session_id);
CREATE INDEX IF NOT EXISTS idx_wishlists_itinerary ON wishlists(itinerary_id);
CREATE INDEX IF NOT EXISTS idx_wishlists_email ON wishlists(email) WHERE email IS NOT NULL;

-- Enable RLS
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;

-- Anyone can insert/delete their own wishlist items
CREATE POLICY "Anyone can manage their wishlist"
  ON wishlists FOR ALL
  USING (true)
  WITH CHECK (true);

-- Function to get wishlist count for an itinerary (for creators)
CREATE OR REPLACE FUNCTION get_wishlist_count(itin_id TEXT)
RETURNS BIGINT AS $$
BEGIN
  RETURN (SELECT COUNT(*) FROM wishlists WHERE itinerary_id = itin_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_wishlist_count(TEXT) TO anon, authenticated;
