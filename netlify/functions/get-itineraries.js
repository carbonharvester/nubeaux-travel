// Netlify function to fetch published itineraries from Supabase
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

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const supabase = getSupabase();
    if (!supabase) {
      // Return empty array if no database
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, itineraries: [] })
      };
    }

    // Parse query parameters
    const params = event.queryStringParameters || {};
    const status = params.status || 'published'; // Default to published only
    const creatorId = params.creator_id;
    const region = params.region;
    const limit = parseInt(params.limit) || 50;

    // Build query
    let query = supabase
      .from('itineraries')
      .select(`
        id,
        title,
        destination,
        region,
        duration,
        price_from,
        hero_image,
        intro,
        status,
        published_at,
        created_at,
        creator_id,
        creators (
          id,
          name,
          instagram,
          profile_image
        )
      `)
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(limit);

    // Filter by status
    if (status !== 'all') {
      query = query.eq('status', status);
    }

    // Filter by creator if specified
    if (creatorId) {
      query = query.eq('creator_id', creatorId);
    }

    // Filter by region if specified
    if (region) {
      query = query.eq('region', region);
    }

    const { data: itineraries, error } = await query;

    if (error) {
      console.error('Supabase error:', error);
      throw new Error(error.message);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        count: itineraries.length,
        itineraries: itineraries
      })
    };

  } catch (error) {
    console.error('Get itineraries error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Failed to fetch itineraries'
      })
    };
  }
};
