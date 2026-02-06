// Netlify function to get live viewer count for an itinerary
// Returns count of unique sessions viewing in the last 5 minutes

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
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ count: 0 })
    };
  }

  try {
    const { itinerary_id } = event.queryStringParameters || {};

    if (!itinerary_id) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'itinerary_id is required' })
      };
    }

    // Get unique sessions that viewed in the last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('page_views')
      .select('session_id')
      .eq('itinerary_id', itinerary_id)
      .gte('created_at', fiveMinutesAgo);

    if (error) throw error;

    // Count unique sessions
    const uniqueSessions = new Set(data.map(v => v.session_id));
    const count = uniqueSessions.size;

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'max-age=30' // Cache for 30 seconds
      },
      body: JSON.stringify({ count })
    };

  } catch (error) {
    console.error('Live viewers error:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: error.message })
    };
  }
};
