// Netlify function to get creator leaderboard

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
    const { period = 'month', current_creator_id } = event.queryStringParameters || {};

    // Calculate date range
    const now = new Date();
    let startDate;

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'all':
        startDate = new Date('2020-01-01');
        break;
    }

    // Get all creators with their itineraries
    const { data: creators, error: creatorsError } = await supabase
      .from('creators')
      .select(`
        id,
        display_name,
        instagram,
        avatar_url
      `);

    if (creatorsError) throw creatorsError;

    if (!creators || creators.length === 0) {
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ leaderboard: [], currentRank: null })
      };
    }

    // Get itineraries for all creators
    const { data: allItineraries, error: itinError } = await supabase
      .from('itineraries')
      .select('id, creator_id');

    if (itinError) throw itinError;

    // Map creator_id to itinerary_ids
    const creatorItineraries = {};
    (allItineraries || []).forEach(itin => {
      if (!creatorItineraries[itin.creator_id]) {
        creatorItineraries[itin.creator_id] = [];
      }
      creatorItineraries[itin.creator_id].push(itin.id);
    });

    // Get views for all itineraries in period
    const allItinIds = (allItineraries || []).map(i => i.id);

    const { data: views, error: viewsError } = await supabase
      .from('page_views')
      .select('itinerary_id')
      .in('itinerary_id', allItinIds.length ? allItinIds : ['none'])
      .gte('created_at', startDate.toISOString());

    if (viewsError) throw viewsError;

    // Get quotes for all itineraries in period
    const { data: quotes, error: quotesError } = await supabase
      .from('quote_requests')
      .select('itinerary_id')
      .in('itinerary_id', allItinIds.length ? allItinIds : ['none'])
      .gte('created_at', startDate.toISOString());

    if (quotesError) throw quotesError;

    // Calculate views per itinerary
    const itineraryViews = {};
    const itineraryQuotes = {};

    (views || []).forEach(v => {
      itineraryViews[v.itinerary_id] = (itineraryViews[v.itinerary_id] || 0) + 1;
    });

    (quotes || []).forEach(q => {
      itineraryQuotes[q.itinerary_id] = (itineraryQuotes[q.itinerary_id] || 0) + 1;
    });

    // Calculate creator scores
    const creatorScores = creators.map(creator => {
      const itinIds = creatorItineraries[creator.id] || [];
      let totalViews = 0;
      let totalQuotes = 0;

      itinIds.forEach(id => {
        totalViews += itineraryViews[id] || 0;
        totalQuotes += itineraryQuotes[id] || 0;
      });

      // Score = views + (quotes * 10)
      const score = totalViews + (totalQuotes * 10);

      return {
        id: creator.id,
        name: creator.display_name || creator.instagram || 'Creator',
        instagram: creator.instagram,
        avatar: creator.avatar_url,
        views: totalViews,
        quotes: totalQuotes,
        itineraries: itinIds.length,
        score
      };
    });

    // Sort by score descending
    const sorted = creatorScores
      .filter(c => c.score > 0 || c.itineraries > 0)
      .sort((a, b) => b.score - a.score);

    // Get top 10
    const leaderboard = sorted.slice(0, 10).map((creator, index) => ({
      rank: index + 1,
      ...creator
    }));

    // Find current creator's rank
    let currentRank = null;
    if (current_creator_id) {
      const myIndex = sorted.findIndex(c => c.id === current_creator_id);
      if (myIndex !== -1) {
        currentRank = {
          rank: myIndex + 1,
          total: sorted.length,
          ...sorted[myIndex]
        };
      }
    }

    // Get period label
    const periodLabels = {
      week: 'This Week',
      month: new Date().toLocaleString('default', { month: 'long' }),
      all: 'All Time'
    };

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300'
      },
      body: JSON.stringify({
        success: true,
        period: periodLabels[period] || 'This Month',
        leaderboard,
        currentRank
      })
    };

  } catch (error) {
    console.error('Leaderboard error:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: error.message })
    };
  }
};
