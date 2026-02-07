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

function extractAdminKey(event) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return event.headers?.['x-admin-key'] || event.headers?.['X-Admin-Key'] || '';
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Key',
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
    const adminKey = process.env.ADMIN_API_KEY;
    if (!adminKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Admin API key is not configured' })
      };
    }
    if (extractAdminKey(event) !== adminKey) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }

    const supabase = getSupabase();
    if (!supabase) {
      throw new Error('Database not configured');
    }

    let data;
    try {
      data = JSON.parse(event.body || '{}');
    } catch (parseError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid JSON body' })
      };
    }

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

    const baseRecord = {
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
      posts: data.posts || [],
      stories: data.stories || [],
      included: data.included || [],
      status: data.status || 'draft',
      published_at: data.status === 'published' ? new Date().toISOString() : null
    };

    let saved;

    // Update existing itinerary only when the creator owns it.
    if (data.id) {
      const { data: existing, error: existingError } = await supabase
        .from('itineraries')
        .select('id, creator_id')
        .eq('id', data.id)
        .maybeSingle();
      if (existingError) throw new Error(existingError.message);
      if (!existing) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Itinerary not found' })
        };
      }
      if (existing.creator_id !== data.creator_id) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ error: 'Creator does not own this itinerary' })
        };
      }

      const { data: updated, error: updateError } = await supabase
        .from('itineraries')
        .update(baseRecord)
        .eq('id', data.id)
        .eq('creator_id', data.creator_id)
        .select()
        .single();
      if (updateError) throw new Error(updateError.message);
      saved = updated;
    } else {
      // Create new itinerary with a creator-scoped slug and collision suffix.
      const creatorSlug = slugify(data.creator_id);
      const titleSlug = slugify(data.title);
      const stem = `${creatorSlug}-${titleSlug}`.slice(0, 100) || `itinerary-${Date.now()}`;
      let id = stem;
      let attempt = 1;

      while (attempt <= 25) {
        const { data: existingId, error: idCheckError } = await supabase
          .from('itineraries')
          .select('id')
          .eq('id', id)
          .maybeSingle();
        if (idCheckError) throw new Error(idCheckError.message);
        if (!existingId) break;
        attempt += 1;
        id = `${stem}-${attempt}`;
      }

      if (attempt > 25) {
        id = `${stem}-${Date.now()}`;
      }

      console.log('Saving itinerary:', id);
      const record = { id, ...baseRecord };
      const { data: inserted, error: insertError } = await supabase
        .from('itineraries')
        .insert(record)
        .select()
        .single();
      if (insertError) throw new Error(insertError.message);
      saved = inserted;
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
