// Netlify function to save itinerary to Supabase
const { createClient } = require('@supabase/supabase-js');

function getSupabase() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return null;
  }
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
}

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const supabase = getSupabase();
    if (!supabase) {
      throw new Error('Database not configured');
    }

    const data = JSON.parse(event.body);

    // Validate required fields
    if (!data.title || !data.title.trim()) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Title is required' })
      };
    }

    if (!data.creator_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Creator ID is required' })
      };
    }

    // Generate ID from title if not provided
    const id = data.id || data.title.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Prepare the record
    const record = {
      id: id,
      creator_id: data.creator_id,
      title: data.title.trim(),
      destination: data.destination || null,
      region: data.region || null,
      duration: data.duration || null,
      price_from: data.price_from || null,
      hero_image: data.hero_image || null,
      intro: data.intro || null,
      why_curated: data.why_curated || null,
      days: data.days || [],
      stays: data.stays || [],
      included: data.included || [],
      status: data.status || 'draft',
      published_at: data.status === 'published' ? new Date().toISOString() : null
    };

    console.log('Saving itinerary:', id);

    // Upsert (insert or update)
    const { data: saved, error } = await supabase
      .from('itineraries')
      .upsert(record, {
        onConflict: 'id'
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      throw new Error(error.message);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        itinerary: saved,
        message: 'Itinerary saved successfully'
      })
    };

  } catch (error) {
    console.error('Save itinerary error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Failed to save itinerary'
      })
    };
  }
};
