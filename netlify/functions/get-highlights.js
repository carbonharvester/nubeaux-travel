// Netlify function to get Instagram story highlights list using Apify
// Actor ID: 9oQm3jSOiztZqDIZu

const { createClient } = require('@supabase/supabase-js');

// Lazily initialize Supabase client (only when needed)
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
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { profile_url, creator_id, action, run_id } = JSON.parse(event.body);

    // Load saved highlights from database (instant)
    if (action === 'load') {
      return await loadSavedHighlights(creator_id);
    }

    // Check status of existing run
    if (run_id) {
      return await checkRunStatus(run_id, creator_id);
    }

    if (!profile_url) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Profile URL is required' })
      };
    }

    // Extract username from profile URL
    const username = extractUsername(profile_url);
    if (!username) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Invalid Instagram profile URL' })
      };
    }

    console.log(`Starting highlights sync for @${username}`);

    // Start Apify run (async - returns immediately)
    const runResult = await startApifyRun(username);

    if (!runResult.success) {
      throw new Error(runResult.error || 'Failed to start Apify run');
    }

    return {
      statusCode: 202,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        success: true,
        status: 'processing',
        run_id: runResult.runId,
        username,
        message: 'Highlights sync started. Poll with run_id to check status.'
      })
    };

  } catch (error) {
    console.error('Error in get-highlights:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: false,
        error: error.message || 'Failed to get highlights'
      })
    };
  }
};

// Extract username from various Instagram URL formats
function extractUsername(url) {
  const match = url.match(/instagram\.com\/([A-Za-z0-9._]+)/);
  if (match) {
    const reserved = ['p', 'reel', 'tv', 'stories', 'explore', 'accounts', 'direct'];
    if (!reserved.includes(match[1].toLowerCase())) {
      return match[1];
    }
  }
  if (/^[A-Za-z0-9._]+$/.test(url)) {
    return url;
  }
  return null;
}

// Start Apify run (async - returns run ID immediately)
async function startApifyRun(username) {
  const APIFY_TOKEN = process.env.APIFY_API_TOKEN;

  if (!APIFY_TOKEN) {
    throw new Error('APIFY_API_TOKEN not configured');
  }

  try {
    // Actor ID: 9oQm3jSOiztZqDIZu - start run (doesn't wait)
    const response = await fetch('https://api.apify.com/v2/acts/9oQm3jSOiztZqDIZu/runs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${APIFY_TOKEN}`
      },
      body: JSON.stringify({
        startUrls: [`https://www.instagram.com/${username}/`]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Apify API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return { success: true, runId: data.data.id };

  } catch (error) {
    console.error('Apify start error:', error);
    return { success: false, error: error.message };
  }
}

// Check status of an existing run
async function checkRunStatus(runId, creatorId) {
  const APIFY_TOKEN = process.env.APIFY_API_TOKEN;

  if (!APIFY_TOKEN) {
    throw new Error('APIFY_API_TOKEN not configured');
  }

  try {
    // Get run status
    const statusResponse = await fetch(`https://api.apify.com/v2/actor-runs/${runId}`, {
      headers: { 'Authorization': `Bearer ${APIFY_TOKEN}` }
    });

    if (!statusResponse.ok) {
      throw new Error(`Failed to get run status: ${statusResponse.status}`);
    }

    const statusData = await statusResponse.json();
    const runStatus = statusData.data.status;

    // If still running, return processing status
    if (runStatus === 'RUNNING' || runStatus === 'READY') {
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          success: true,
          status: 'processing',
          run_id: runId,
          run_status: runStatus
        })
      };
    }

    // If failed, return error
    if (runStatus === 'FAILED' || runStatus === 'ABORTED' || runStatus === 'TIMED-OUT') {
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          success: false,
          status: 'failed',
          run_id: runId,
          error: `Run ${runStatus.toLowerCase()}`
        })
      };
    }

    // If succeeded, get the dataset items
    if (runStatus === 'SUCCEEDED') {
      const datasetId = statusData.data.defaultDatasetId;
      const itemsResponse = await fetch(
        `https://api.apify.com/v2/datasets/${datasetId}/items?format=json`,
        { headers: { 'Authorization': `Bearer ${APIFY_TOKEN}` } }
      );

      if (!itemsResponse.ok) {
        throw new Error('Failed to get dataset items');
      }

      const items = await itemsResponse.json();

      // Transform to our format
      // Log first item to debug field names
      if (items.length > 0) {
        console.log('Highlight item sample:', JSON.stringify(items[0], null, 2));
      }
      const highlights = items.map(item => {
        // Extract highlight ID - Instagram IDs are 17+ digit numbers
        // Try multiple fields where the ID might be stored
        let highlightId = item.pk || item.highlight_id || item.highlightId || item.id;

        // If ID has "highlight:" prefix, keep the numeric part
        if (typeof highlightId === 'string' && highlightId.includes('highlight:')) {
          highlightId = highlightId.split(':')[1];
        }

        // Ensure we have a valid ID (17+ characters for Instagram)
        highlightId = String(highlightId || '');

        // Extract cover URL from various possible field locations
        let coverUrl = null;
        if (item.coverUrl) {
          coverUrl = item.coverUrl;
        } else if (item.cover_url) {
          coverUrl = item.cover_url;
        } else if (typeof item.cover_media === 'string') {
          coverUrl = item.cover_media;
        } else if (item.cover_media?.cropped_image_version?.url) {
          coverUrl = item.cover_media.cropped_image_version.url;
        } else if (item.cover_media?.thumbnail_src) {
          coverUrl = item.cover_media.thumbnail_src;
        } else if (item.cover_media_cropped_thumbnail?.url) {
          coverUrl = item.cover_media_cropped_thumbnail.url;
        } else if (item.thumbnail_src) {
          coverUrl = item.thumbnail_src;
        } else if (item.thumbnail) {
          coverUrl = item.thumbnail;
        } else if (item.image_url) {
          coverUrl = item.image_url;
        } else if (item.profilePicUrl) {
          // Fallback to profile pic if no cover
          coverUrl = item.profilePicUrl;
        }

        console.log(`Highlight "${item.title || item.name}": ID=${highlightId} (${highlightId.length} chars), Cover=${coverUrl ? 'found' : 'missing'}`);

        return {
          id: highlightId,
          title: item.title || item.name,
          coverUrl: coverUrl,
          storiesCount: item.media_count || item.storiesCount || item.stories_count || item.count || item.items?.length || 0
        };
      });

      // Filter out highlights with invalid IDs (need 17+ chars for Instagram)
      const validHighlights = highlights.filter(h => {
        if (!h.id || h.id.length < 10) {
          console.warn(`Skipping highlight "${h.title}" - invalid ID: "${h.id}"`);
          return false;
        }
        return true;
      });

      console.log(`Valid highlights: ${validHighlights.length} of ${highlights.length}`);

      // Skip Cloudinary for covers - Instagram blocks them with CORS anyway
      // We'll show styled placeholders with titles instead
      // Stories content will use Cloudinary when downloaded
      const savedHighlights = await saveHighlightsWithoutCloudinary(validHighlights, creatorId);

      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type'
        },
        body: JSON.stringify({
          success: true,
          status: 'completed',
          run_id: runId,
          highlights_count: savedHighlights.length,
          total_found: highlights.length,
          highlights: savedHighlights
        })
      };
    }

    // Unknown status
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: true,
        status: 'unknown',
        run_id: runId,
        run_status: runStatus
      })
    };

  } catch (error) {
    console.error('Check status error:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
}

// Load saved highlights from Supabase
async function loadSavedHighlights(creatorId) {
  const supabase = getSupabase();

  if (!supabase) {
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true, highlights: [], message: 'Database not configured' })
    };
  }

  if (!creatorId) {
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true, highlights: [], message: 'No creator ID' })
    };
  }

  // Check if creatorId looks like a valid UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(creatorId)) {
    // Return empty results for non-UUID creator IDs (like "demo")
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true, highlights: [], message: 'No saved highlights for this session' })
    };
  }

  try {
    const { data: highlights, error } = await supabase
      .from('creator_highlights')
      .select('*')
      .eq('creator_id', creatorId)
      .order('title', { ascending: true });

    if (error) throw error;

    // Transform to frontend format
    const formattedHighlights = highlights.map(h => ({
      id: h.highlight_id,
      title: h.title,
      coverUrl: h.cover_url,
      storiesCount: h.stories_count
    }));

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: true,
        highlights: formattedHighlights
      })
    };
  } catch (error) {
    console.error('Load highlights error:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
}

// Save highlights to Supabase WITHOUT Cloudinary upload (fast, no timeout)
async function saveHighlightsWithoutCloudinary(highlights, creatorId) {
  const supabase = getSupabase();
  const savedHighlights = [];

  // Check if creatorId is a valid UUID before trying to save to DB
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const canSaveToDb = supabase && creatorId && uuidRegex.test(creatorId);

  for (const highlight of highlights) {
    try {
      // Use original Instagram cover URL (no Cloudinary upload)
      const coverUrl = highlight.coverUrl;

      if (canSaveToDb) {
        const record = {
          creator_id: creatorId,
          highlight_id: highlight.id,
          title: highlight.title,
          cover_url: coverUrl,
          stories_count: highlight.storiesCount || 0,
          synced_at: new Date().toISOString()
        };

        const { data, error } = await supabase
          .from('creator_highlights')
          .upsert(record, {
            onConflict: 'creator_id,highlight_id',
            ignoreDuplicates: false
          })
          .select()
          .single();

        if (error) {
          console.error(`Error saving highlight ${highlight.id}:`, error);
        }
      }

      // Always return the highlight
      savedHighlights.push({
        id: highlight.id,
        title: highlight.title,
        coverUrl: coverUrl,
        storiesCount: highlight.storiesCount
      });
    } catch (err) {
      console.error(`Error processing highlight ${highlight.id}:`, err);
      savedHighlights.push({
        id: highlight.id,
        title: highlight.title,
        coverUrl: highlight.coverUrl,
        storiesCount: highlight.storiesCount
      });
    }
  }

  return savedHighlights;
}

// Save highlights to Supabase with Cloudinary cover upload (SLOW - can timeout)
async function saveHighlights(highlights, creatorId) {
  const supabase = getSupabase();
  const savedHighlights = [];

  // Check if creatorId is a valid UUID before trying to save to DB
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const canSaveToDb = supabase && creatorId && uuidRegex.test(creatorId);

  // Upload covers to Cloudinary in parallel (batch of 5 for speed)
  const batchSize = 5;
  for (let i = 0; i < highlights.length; i += batchSize) {
    const batch = highlights.slice(i, i + batchSize);
    await Promise.all(batch.map(async (highlight) => {
      if (highlight.coverUrl) {
        try {
          const cloudinaryUrl = await uploadCoverToCloudinary(highlight.coverUrl, creatorId, highlight.id);
          highlight.cloudinaryCover = cloudinaryUrl;
        } catch (err) {
          console.error(`Failed to upload cover for ${highlight.id}:`, err.message);
          highlight.cloudinaryCover = null;
        }
      }
    }));
  }

  for (const highlight of highlights) {
    try {
      const coverUrl = highlight.cloudinaryCover || highlight.coverUrl;

      if (canSaveToDb) {
        const record = {
          creator_id: creatorId,
          highlight_id: highlight.id,
          title: highlight.title,
          cover_url: coverUrl,
          stories_count: highlight.storiesCount || 0,
          synced_at: new Date().toISOString()
        };

        const { data, error } = await supabase
          .from('creator_highlights')
          .upsert(record, {
            onConflict: 'creator_id,highlight_id',
            ignoreDuplicates: false
          })
          .select()
          .single();

        if (error) {
          console.error(`Error saving highlight ${highlight.id}:`, error);
        }
      }

      // Always return the highlight
      savedHighlights.push({
        id: highlight.id,
        title: highlight.title,
        coverUrl: coverUrl,
        storiesCount: highlight.storiesCount
      });
    } catch (err) {
      console.error(`Error processing highlight ${highlight.id}:`, err);
      savedHighlights.push({
        id: highlight.id,
        title: highlight.title,
        coverUrl: highlight.cloudinaryCover || highlight.coverUrl,
        storiesCount: highlight.storiesCount
      });
    }
  }

  return savedHighlights;
}

// Upload cover image to Cloudinary
async function uploadCoverToCloudinary(imageUrl, creatorId, highlightId) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    console.warn('Cloudinary not configured');
    return null;
  }

  const crypto = require('crypto');
  // Sanitize IDs for Cloudinary (remove colons and other special chars)
  const safeCreatorId = String(creatorId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeHighlightId = String(highlightId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const folder = `creators/${safeCreatorId}/highlights`;
  const publicId = `cover_${safeHighlightId}`;
  const timestamp = Math.round(Date.now() / 1000);

  const signatureString = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash('sha1').update(signatureString).digest('hex');

  const formData = new URLSearchParams();
  formData.append('file', imageUrl);
  formData.append('folder', folder);
  formData.append('public_id', publicId);
  formData.append('timestamp', timestamp);
  formData.append('api_key', apiKey);
  formData.append('signature', signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cloudinary upload failed: ${errorText}`);
  }

  const result = await response.json();
  return result.secure_url.replace('/upload/', '/upload/w_150,h_150,c_fill,f_auto,q_auto/');
}
