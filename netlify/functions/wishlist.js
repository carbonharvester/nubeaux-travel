// Netlify function to manage traveler wishlists

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
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
      },
      body: ''
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
    // GET - get user's wishlist or check if item is saved
    if (event.httpMethod === 'GET') {
      const { session_id, itinerary_id } = event.queryStringParameters || {};

      if (!session_id) {
        return {
          statusCode: 400,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: 'session_id is required' })
        };
      }

      // If itinerary_id provided, check if this specific item is saved
      if (itinerary_id) {
        const { data, error } = await supabase
          .from('wishlists')
          .select('id')
          .eq('session_id', session_id)
          .eq('itinerary_id', itinerary_id)
          .single();

        return {
          statusCode: 200,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ saved: !!data && !error })
        };
      }

      // Otherwise, get full wishlist with itinerary details
      const { data: wishlistItems, error } = await supabase
        .from('wishlists')
        .select(`
          id,
          itinerary_id,
          created_at,
          itineraries (
            id,
            title,
            destination,
            duration,
            price_from,
            hero_image
          )
        `)
        .eq('session_id', session_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          success: true,
          items: wishlistItems.map(item => ({
            id: item.id,
            saved_at: item.created_at,
            itinerary: item.itineraries
          }))
        })
      };
    }

    // POST - add to wishlist
    if (event.httpMethod === 'POST') {
      const { session_id, itinerary_id, email } = JSON.parse(event.body);

      if (!session_id || !itinerary_id) {
        return {
          statusCode: 400,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: 'session_id and itinerary_id are required' })
        };
      }

      const { data, error } = await supabase
        .from('wishlists')
        .upsert({
          session_id,
          itinerary_id,
          email: email || null
        }, {
          onConflict: 'session_id,itinerary_id',
          ignoreDuplicates: true
        })
        .select()
        .single();

      if (error && error.code !== '23505') throw error; // Ignore duplicate key error

      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: true, saved: true })
      };
    }

    // DELETE - remove from wishlist
    if (event.httpMethod === 'DELETE') {
      const { session_id, itinerary_id } = event.queryStringParameters || {};

      if (!session_id || !itinerary_id) {
        return {
          statusCode: 400,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: 'session_id and itinerary_id are required' })
        };
      }

      const { error } = await supabase
        .from('wishlists')
        .delete()
        .eq('session_id', session_id)
        .eq('itinerary_id', itinerary_id);

      if (error) throw error;

      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: true, saved: false })
      };
    }

    return {
      statusCode: 405,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };

  } catch (error) {
    console.error('Wishlist error:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: error.message })
    };
  }
};
