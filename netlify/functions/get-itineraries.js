// Netlify function to get published itineraries

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
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const supabase = getSupabase();
  if (!supabase) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Database not configured' })
    };
  }

  try {
    const params = event.queryStringParameters || {};
    const limit = parseInt(params.limit) || 20;
    const destination = params.destination;
    const tag = params.tag;

    let query = supabase
      .from('itineraries')
      .select(`
        id,
        slug,
        title,
        destination,
        duration,
        price_from,
        hero_image,
        intro,
        tags,
        created_at
      `)
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(limit);

    // Optional filters
    if (destination) {
      query = query.ilike('destination', `%${destination}%`);
    }

    if (tag) {
      query = query.contains('tags', [tag]);
    }

    const { data, error } = await query;

    if (error) throw error;

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=60'
      },
      body: JSON.stringify({
        success: true,
        itineraries: data || []
      })
    };

  } catch (error) {
    console.error('Get itineraries error:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: error.message })
    };
  }
};
