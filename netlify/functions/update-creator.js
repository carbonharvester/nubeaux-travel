// Netlify function to update creator profile

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

exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Key',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: ''
    };
  }

  const supabase = getSupabase();
  const adminKey = process.env.ADMIN_API_KEY;

  if (!supabase) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Database not configured' })
    };
  }
  if (!adminKey) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Admin API key is not configured' })
    };
  }
  if (extractAdminKey(event) !== adminKey) {
    return {
      statusCode: 401,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  try {
    // GET - fetch creator profile
    if (event.httpMethod === 'GET') {
      const { creator_id } = event.queryStringParameters || {};

      if (!creator_id) {
        return {
          statusCode: 400,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: 'creator_id is required' })
        };
      }

      const { data: creator, error } = await supabase
        .from('creators')
        .select('*')
        .eq('id', creator_id)
        .single();

      if (error) throw error;

      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          success: true,
          creator: {
            id: creator.id,
            name: creator.name,
            handle: creator.handle,
            email: creator.email,
            bio: creator.bio,
            instagram: creator.instagram,
            avatar_url: creator.avatar_url,
            specialties: creator.specialties || [],
            regions: creator.regions || []
          }
        })
      };
    }

    // POST - update creator profile
    if (event.httpMethod === 'POST') {
      const { creator_id, name, handle, bio, instagram, avatar_url, specialties, regions } = JSON.parse(event.body);

      if (!creator_id) {
        return {
          statusCode: 400,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: 'creator_id is required' })
        };
      }

      // Build update object with only provided fields
      const updates = {};
      if (name !== undefined) updates.name = name;
      if (handle !== undefined) updates.handle = handle;
      if (bio !== undefined) updates.bio = bio;
      if (instagram !== undefined) updates.instagram = instagram;
      if (avatar_url !== undefined) updates.avatar_url = avatar_url;
      if (specialties !== undefined) updates.specialties = specialties;
      if (regions !== undefined) updates.regions = regions;

      if (Object.keys(updates).length === 0) {
        return {
          statusCode: 400,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: 'No fields to update' })
        };
      }

      const { data: creator, error } = await supabase
        .from('creators')
        .update(updates)
        .eq('id', creator_id)
        .select()
        .single();

      if (error) throw error;

      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type'
        },
        body: JSON.stringify({
          success: true,
          creator: {
            id: creator.id,
            name: creator.name,
            handle: creator.handle,
            email: creator.email,
            bio: creator.bio,
            instagram: creator.instagram,
            avatar_url: creator.avatar_url,
            specialties: creator.specialties || [],
            regions: creator.regions || []
          }
        })
      };
    }

    return {
      statusCode: 405,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };

  } catch (error) {
    console.error('Update creator error:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: error.message })
    };
  }
};
