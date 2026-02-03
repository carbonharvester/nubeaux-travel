-- ============================================
-- NUBEAUX Travel - Supabase Database Schema
-- ============================================
-- Run this SQL in your Supabase SQL Editor
-- (Project > SQL Editor > New Query)
-- ============================================

-- 1. CREATORS TABLE
-- Stores creator profiles (linked to Supabase Auth users)
-- ============================================
CREATE TABLE IF NOT EXISTS creators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handle TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  instagram TEXT,
  specialties TEXT[],
  regions TEXT[],
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ITINERARIES TABLE
-- Stores itinerary data for each creator
-- ============================================
CREATE TABLE IF NOT EXISTS itineraries (
  id TEXT PRIMARY KEY,
  creator_id UUID REFERENCES creators(id),
  title TEXT NOT NULL,
  destination TEXT,
  region TEXT,
  duration TEXT,
  price_from INTEGER,
  hero_image TEXT,
  intro TEXT,
  days JSONB,
  stays JSONB,
  included TEXT[],
  status TEXT DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. QUOTE REQUESTS TABLE
-- Stores quote requests from visitors
-- ============================================
CREATE TABLE IF NOT EXISTS quote_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  itinerary_id TEXT REFERENCES itineraries(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  start_date DATE,
  end_date DATE,
  adults INTEGER DEFAULT 2,
  children INTEGER DEFAULT 0,
  special_requests TEXT,
  status TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. PAGE VIEWS TABLE
-- Tracks page views for itineraries
-- ============================================
CREATE TABLE IF NOT EXISTS page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  itinerary_id TEXT REFERENCES itineraries(id),
  session_id TEXT,
  referrer TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TRIP INQUIRIES TABLE
-- General trip inquiries (not tied to specific itinerary)
-- ============================================
CREATE TABLE IF NOT EXISTS trip_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  destination TEXT,
  travel_dates TEXT,
  travelers TEXT,
  budget TEXT,
  message TEXT,
  status TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES for better query performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_itineraries_creator ON itineraries(creator_id);
CREATE INDEX IF NOT EXISTS idx_itineraries_status ON itineraries(status);
CREATE INDEX IF NOT EXISTS idx_quote_requests_itinerary ON quote_requests(itinerary_id);
CREATE INDEX IF NOT EXISTS idx_quote_requests_status ON quote_requests(status);
CREATE INDEX IF NOT EXISTS idx_quote_requests_created ON quote_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_itinerary ON page_views(itinerary_id);
CREATE INDEX IF NOT EXISTS idx_page_views_created ON page_views(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trip_inquiries_status ON trip_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_trip_inquiries_created ON trip_inquiries(created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE itineraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_inquiries ENABLE ROW LEVEL SECURITY;

-- Creators: public read, owner write
CREATE POLICY "Creators are publicly readable"
  ON creators FOR SELECT
  USING (true);

CREATE POLICY "Creators can update own profile"
  ON creators FOR UPDATE
  USING (auth.uid()::text = id::text);

-- Itineraries: published are public, creators can manage own
CREATE POLICY "Published itineraries are public"
  ON itineraries FOR SELECT
  USING (status = 'published' OR creator_id::text = auth.uid()::text);

CREATE POLICY "Creators can insert own itineraries"
  ON itineraries FOR INSERT
  WITH CHECK (creator_id::text = auth.uid()::text);

CREATE POLICY "Creators can update own itineraries"
  ON itineraries FOR UPDATE
  USING (creator_id::text = auth.uid()::text);

CREATE POLICY "Creators can delete own itineraries"
  ON itineraries FOR DELETE
  USING (creator_id::text = auth.uid()::text);

-- Quote requests: anyone can insert, creators see own itineraries' quotes
CREATE POLICY "Anyone can submit quote requests"
  ON quote_requests FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Creators can view their itineraries' quotes"
  ON quote_requests FOR SELECT
  USING (
    itinerary_id IN (
      SELECT id FROM itineraries WHERE creator_id::text = auth.uid()::text
    )
  );

-- Page views: anyone can insert, creators see own itineraries' views
CREATE POLICY "Anyone can log page views"
  ON page_views FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Creators can view their itineraries' page views"
  ON page_views FOR SELECT
  USING (
    itinerary_id IN (
      SELECT id FROM itineraries WHERE creator_id::text = auth.uid()::text
    )
  );

-- Trip inquiries: anyone can submit
CREATE POLICY "Anyone can submit trip inquiries"
  ON trip_inquiries FOR INSERT
  WITH CHECK (true);

-- Admin can view all inquiries (you'll need to create admin role)
-- For now, no SELECT policy means only service role can view

-- ============================================
-- HELPER FUNCTIONS for aggregates
-- ============================================

-- Get view counts for multiple itineraries
CREATE OR REPLACE FUNCTION get_view_counts(itinerary_ids TEXT[])
RETURNS TABLE(itinerary_id TEXT, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT pv.itinerary_id, COUNT(*)::BIGINT as count
  FROM page_views pv
  WHERE pv.itinerary_id = ANY(itinerary_ids)
  GROUP BY pv.itinerary_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get quote counts for multiple itineraries
CREATE OR REPLACE FUNCTION get_quote_counts(itinerary_ids TEXT[])
RETURNS TABLE(itinerary_id TEXT, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT qr.itinerary_id, COUNT(*)::BIGINT as count
  FROM quote_requests qr
  WHERE qr.itinerary_id = ANY(itinerary_ids)
  GROUP BY qr.itinerary_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- SEED DATA - Nia The Light
-- ============================================

-- Insert Nia as a creator
INSERT INTO creators (id, handle, name, email, avatar_url, bio, instagram, specialties, regions)
VALUES (
  gen_random_uuid(),
  'niathelight',
  'Nia The Light',
  'nia@nubeauxcollective.com',
  'https://res.cloudinary.com/dng12bd0a/image/upload/c_fill,w_400,h_400,q_auto,f_auto/v1769949588/RNI-Films-IMG-3CFAE959-6D3F-4C6A-96D4-F3158BB2F3E8_shblk6.jpg',
  'Travel creator and wellness advocate. Documenting luxury African experiences with intention.',
  'niathelight',
  ARRAY['Safari', 'Wellness', 'Luxury'],
  ARRAY['Southern Africa', 'East Africa']
)
ON CONFLICT (email) DO NOTHING;

-- Get Nia's ID for itineraries
DO $$
DECLARE
  nia_id UUID;
BEGIN
  SELECT id INTO nia_id FROM creators WHERE email = 'nia@nubeauxcollective.com';

  -- Insert Namibia Safari itinerary
  INSERT INTO itineraries (id, creator_id, title, destination, region, duration, price_from, hero_image, status, published_at)
  VALUES (
    'namibia-safari',
    nia_id,
    'Wilderness & Wonder',
    'Namibia',
    'Southern Africa',
    '4 days / 3 nights',
    4500,
    'https://res.cloudinary.com/dng12bd0a/image/upload/c_fill,w_1920,h_1080,q_auto,f_auto/v1770005193/Namibia_onguma_Klein-268_gjsdoh.jpg',
    'published',
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  -- Insert Mozambique itinerary
  INSERT INTO itineraries (id, creator_id, title, destination, region, duration, price_from, hero_image, status, published_at)
  VALUES (
    'mozambique-island-escape',
    nia_id,
    'Island Escape',
    'Mozambique',
    'Southern Africa',
    '5 days / 4 nights',
    6500,
    'https://images.unsplash.com/photo-1590523277543-a94d2e4eb00b?w=1920&h=1080&fit=crop&q=80',
    'published',
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

END $$;

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

-- Grant usage on functions to anon and authenticated
GRANT EXECUTE ON FUNCTION get_view_counts(TEXT[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_quote_counts(TEXT[]) TO anon, authenticated;

-- ============================================
-- DONE!
-- ============================================
-- After running this:
-- 1. Go to Authentication > Users and create a user for Nia
-- 2. Update the creator record to link to that auth user ID
-- 3. Copy your project URL and anon key to /js/supabase.js
