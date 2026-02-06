// Netlify function to get admin dashboard stats

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
      body: JSON.stringify({
        totalCreators: 0,
        totalItineraries: 0,
        totalQuotes: 0,
        totalViews: 0,
        newCreators: 0,
        newItineraries: 0,
        quotesChange: 0,
        viewsChange: 0,
        recentQuotes: [],
        creators: [],
        recentActivity: []
      })
    };
  }

  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const { count: totalCreators } = await supabase
      .from('creators')
      .select('*', { count: 'exact', head: true });

    const { count: newCreators } = await supabase
      .from('creators')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfMonth.toISOString());

    const { count: totalItineraries } = await supabase
      .from('itineraries')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published');

    const { count: newItineraries } = await supabase
      .from('itineraries')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published')
      .gte('created_at', startOfMonth.toISOString());

    const { count: currentQuotes } = await supabase
      .from('quote_requests')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', thirtyDaysAgo.toISOString());

    const { count: previousQuotes } = await supabase
      .from('quote_requests')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sixtyDaysAgo.toISOString())
      .lt('created_at', thirtyDaysAgo.toISOString());

    const quotesChange = previousQuotes > 0
      ? Math.round(((currentQuotes - previousQuotes) / previousQuotes) * 100)
      : 0;

    const { count: currentViews } = await supabase
      .from('page_views')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', thirtyDaysAgo.toISOString());

    const { count: previousViews } = await supabase
      .from('page_views')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sixtyDaysAgo.toISOString())
      .lt('created_at', thirtyDaysAgo.toISOString());

    const viewsChange = previousViews > 0
      ? Math.round(((currentViews - previousViews) / previousViews) * 100)
      : 0;

    const { data: recentQuotes } = await supabase
      .from('quote_requests')
      .select('id, first_name, last_name, email, trip_name, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    const { data: creatorsData } = await supabase
      .from('creators')
      .select('id, display_name, instagram, avatar_url, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    const creators = [];
    if (creatorsData) {
      for (const creator of creatorsData) {
        const { count: itinCount } = await supabase
          .from('itineraries')
          .select('*', { count: 'exact', head: true })
          .eq('creator_id', creator.id)
          .eq('status', 'published');

        const { data: itins } = await supabase
          .from('itineraries')
          .select('id')
          .eq('creator_id', creator.id);

        const itinIds = (itins || []).map(i => i.id);
        let views = 0;
        let quotes = 0;

        if (itinIds.length > 0) {
          const { count: viewCount } = await supabase
            .from('page_views')
            .select('*', { count: 'exact', head: true })
            .in('itinerary_id', itinIds)
            .gte('created_at', thirtyDaysAgo.toISOString());
          views = viewCount || 0;

          const { count: quoteCount } = await supabase
            .from('quote_requests')
            .select('*', { count: 'exact', head: true })
            .in('itinerary_id', itinIds)
            .gte('created_at', thirtyDaysAgo.toISOString());
          quotes = quoteCount || 0;
        }

        creators.push({
          id: creator.id,
          name: creator.display_name || creator.instagram || 'Creator',
          instagram: creator.instagram,
          avatar: creator.avatar_url,
          itineraries: itinCount || 0,
          views,
          quotes
        });
      }
    }

    const recentActivity = [];
    (recentQuotes || []).slice(0, 3).forEach(q => {
      recentActivity.push({
        type: 'quote',
        text: 'New quote request from ' + q.first_name + ' ' + q.last_name,
        time: formatTimeAgo(new Date(q.created_at))
      });
    });

    (creatorsData || []).slice(0, 2).forEach(c => {
      recentActivity.push({
        type: 'creator',
        text: (c.display_name || c.instagram) + ' joined as a creator',
        time: formatTimeAgo(new Date(c.created_at))
      });
    });

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=60'
      },
      body: JSON.stringify({
        totalCreators: totalCreators || 0,
        totalItineraries: totalItineraries || 0,
        totalQuotes: currentQuotes || 0,
        totalViews: currentViews || 0,
        newCreators: newCreators || 0,
        newItineraries: newItineraries || 0,
        quotesChange,
        viewsChange,
        recentQuotes: (recentQuotes || []).map(q => ({
          id: q.id,
          firstName: q.first_name,
          lastName: q.last_name,
          email: q.email,
          tripName: q.trip_name
        })),
        creators,
        recentActivity
      })
    };

  } catch (error) {
    console.error('Admin stats error:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: error.message })
    };
  }
};

function formatTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
  if (seconds < 604800) return Math.floor(seconds / 86400) + 'd ago';
  return date.toLocaleDateString();
}
