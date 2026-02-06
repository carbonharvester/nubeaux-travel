// Netlify function to get booking/quote statistics for social proof
// Returns quote request counts for recent periods

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
      body: JSON.stringify({ today: 0, week: 0, month: 0 })
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

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Get quote requests for different time periods
    const [todayResult, weekResult, monthResult] = await Promise.all([
      supabase
        .from('quote_requests')
        .select('id', { count: 'exact', head: true })
        .eq('itinerary_id', itinerary_id)
        .gte('created_at', todayStart),
      supabase
        .from('quote_requests')
        .select('id', { count: 'exact', head: true })
        .eq('itinerary_id', itinerary_id)
        .gte('created_at', weekAgo),
      supabase
        .from('quote_requests')
        .select('id', { count: 'exact', head: true })
        .eq('itinerary_id', itinerary_id)
        .gte('created_at', monthAgo)
    ]);

    // Determine the best message to show
    const today = todayResult.count || 0;
    const week = weekResult.count || 0;
    const month = monthResult.count || 0;

    let message = null;
    if (today > 0) {
      message = today === 1 ? '1 person booked today' : `${today} people booked today`;
    } else if (week > 0) {
      message = week === 1 ? '1 booking this week' : `${week} bookings this week`;
    } else if (month > 0) {
      message = month === 1 ? '1 booking this month' : `${month} bookings this month`;
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'max-age=300' // Cache for 5 minutes
      },
      body: JSON.stringify({
        today,
        week,
        month,
        message
      })
    };

  } catch (error) {
    console.error('Booking stats error:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: error.message })
    };
  }
};
