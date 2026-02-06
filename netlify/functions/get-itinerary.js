// Netlify function to fetch a single itinerary by ID from Supabase
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
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Database not configured' })
      };
    }

    // Get itinerary ID from query params
    const params = event.queryStringParameters || {};
    const id = params.id;

    if (!id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Itinerary ID is required' })
      };
    }

    // Fetch the itinerary with creator info
    const { data: itinerary, error } = await supabase
      .from('itineraries')
      .select(`
        *,
        creators (
          id,
          name,
          instagram,
          profile_image,
          bio
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Itinerary not found' })
        };
      }
      console.error('Supabase error:', error);
      throw new Error(error.message);
    }

    // Check if itinerary is published (unless accessing own itinerary)
    if (itinerary.status !== 'published') {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Itinerary not found' })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        itinerary: itinerary
      })
    };

  } catch (error) {
    console.error('Get itinerary error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Failed to fetch itinerary'
      })
    };
  }
};
