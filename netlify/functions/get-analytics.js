// Netlify function to get creator analytics from Supabase

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
    const { creator_id, period = '30d' } = event.queryStringParameters || {};

    if (!creator_id) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'creator_id is required' })
      };
    }

    // Calculate date range
    const now = new Date();
    let startDate;
    let prevStartDate;

    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        prevStartDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        prevStartDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        prevStartDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        break;
      default: // all time
        startDate = new Date('2020-01-01');
        prevStartDate = null;
    }

    // Get creator's itineraries
    const { data: itineraries, error: itinError } = await supabase
      .from('itineraries')
      .select('id, title, destination')
      .eq('creator_id', creator_id);

    if (itinError) throw itinError;

    const itineraryIds = itineraries.map(i => i.id);

    if (itineraryIds.length === 0) {
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          totalViews: 0,
          totalQuotes: 0,
          conversionRate: 0,
          viewsChange: 0,
          quotesChange: 0,
          dailyViews: [],
          topItineraries: [],
          trafficSources: []
        })
      };
    }

    // Get current period views
    const { data: currentViews, error: viewsError } = await supabase
      .from('page_views')
      .select('id, itinerary_id, referrer, created_at')
      .in('itinerary_id', itineraryIds)
      .gte('created_at', startDate.toISOString());

    if (viewsError) throw viewsError;

    // Get current period quotes
    const { data: currentQuotes, error: quotesError } = await supabase
      .from('quote_requests')
      .select('id, itinerary_id, created_at')
      .in('itinerary_id', itineraryIds)
      .gte('created_at', startDate.toISOString());

    if (quotesError) throw quotesError;

    // Get previous period data for comparison
    let prevViews = [];
    let prevQuotes = [];

    if (prevStartDate) {
      const { data: pv } = await supabase
        .from('page_views')
        .select('id')
        .in('itinerary_id', itineraryIds)
        .gte('created_at', prevStartDate.toISOString())
        .lt('created_at', startDate.toISOString());
      prevViews = pv || [];

      const { data: pq } = await supabase
        .from('quote_requests')
        .select('id')
        .in('itinerary_id', itineraryIds)
        .gte('created_at', prevStartDate.toISOString())
        .lt('created_at', startDate.toISOString());
      prevQuotes = pq || [];
    }

    // Calculate totals and changes
    const totalViews = currentViews.length;
    const totalQuotes = currentQuotes.length;
    const conversionRate = totalViews > 0 ? (totalQuotes / totalViews * 100).toFixed(1) : 0;

    const viewsChange = prevViews.length > 0
      ? Math.round((totalViews - prevViews.length) / prevViews.length * 100)
      : 0;
    const quotesChange = prevQuotes.length > 0
      ? Math.round((totalQuotes - prevQuotes.length) / prevQuotes.length * 100)
      : 0;

    // Calculate daily views for chart
    const dailyViews = {};
    const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 30;

    for (let i = 0; i < days; i++) {
      const date = new Date(now.getTime() - (days - 1 - i) * 24 * 60 * 60 * 1000);
      const dateKey = date.toISOString().split('T')[0];
      dailyViews[dateKey] = 0;
    }

    currentViews.forEach(view => {
      const dateKey = view.created_at.split('T')[0];
      if (dailyViews.hasOwnProperty(dateKey)) {
        dailyViews[dateKey]++;
      }
    });

    const dailyViewsArray = Object.entries(dailyViews).map(([date, count]) => ({
      date,
      views: count
    }));

    // Calculate top itineraries
    const itineraryStats = {};
    itineraryIds.forEach(id => {
      itineraryStats[id] = { views: 0, quotes: 0 };
    });

    currentViews.forEach(view => {
      if (itineraryStats[view.itinerary_id]) {
        itineraryStats[view.itinerary_id].views++;
      }
    });

    currentQuotes.forEach(quote => {
      if (itineraryStats[quote.itinerary_id]) {
        itineraryStats[quote.itinerary_id].quotes++;
      }
    });

    const topItineraries = itineraries
      .map(itin => ({
        id: itin.id,
        title: itin.title,
        destination: itin.destination,
        views: itineraryStats[itin.id]?.views || 0,
        quotes: itineraryStats[itin.id]?.quotes || 0
      }))
      .sort((a, b) => b.views - a.views);

    // Calculate traffic sources from referrer
    const sources = {};
    currentViews.forEach(view => {
      let source = 'Direct';
      const referrer = view.referrer || '';

      if (referrer.includes('instagram.com')) source = 'Instagram';
      else if (referrer.includes('facebook.com')) source = 'Facebook';
      else if (referrer.includes('google.')) source = 'Google';
      else if (referrer.includes('twitter.com') || referrer.includes('x.com')) source = 'Twitter/X';
      else if (referrer.includes('tiktok.com')) source = 'TikTok';
      else if (referrer && !referrer.includes(process.env.URL || 'junotravel')) source = 'Other';

      sources[source] = (sources[source] || 0) + 1;
    });

    const trafficSources = Object.entries(sources)
      .map(([source, count]) => ({
        source,
        visitors: count,
        percentage: totalViews > 0 ? Math.round(count / totalViews * 100) : 0
      }))
      .sort((a, b) => b.visitors - a.visitors);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        totalViews,
        totalQuotes,
        conversionRate: parseFloat(conversionRate),
        viewsChange,
        quotesChange,
        dailyViews: dailyViewsArray,
        topItineraries,
        trafficSources
      })
    };

  } catch (error) {
    console.error('Analytics error:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: error.message })
    };
  }
};
