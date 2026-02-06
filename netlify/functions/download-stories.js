// Netlify function to download Instagram stories from a highlight using Apify
// Actor ID: A9vd1RbmpS40rjMxu
// Uses async pattern: starts run, returns run ID, client polls for results

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
    const { highlight_id, highlight_title, creator_id, run_id } = JSON.parse(event.body);

    // If run_id provided, check status of existing run
    if (run_id) {
      return await checkRunStatus(run_id, creator_id, highlight_title);
    }

    // Otherwise start a new run
    if (!highlight_id) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Highlight ID is required' })
      };
    }

    // Validate highlight ID
    let cleanId = String(highlight_id);
    if (cleanId.startsWith('highlight:')) {
      cleanId = cleanId.split(':')[1];
    }

    if (cleanId.length < 17) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          error: `Invalid highlight ID: must be at least 17 characters (got ${cleanId.length}). Please re-sync your highlights.`
        })
      };
    }

    console.log(`Starting stories download for highlight: ${cleanId} (${highlight_title || 'untitled'})`);

    // Start Apify run (async - returns immediately)
    const runResult = await startApifyRun(cleanId);

    if (!runResult.success) {
      throw new Error(runResult.error || 'Failed to start Apify run');
    }

    return {
      statusCode: 202, // Accepted - processing started
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        success: true,
        status: 'processing',
        run_id: runResult.runId,
        highlight_id: cleanId,
        highlight_title,
        message: 'Stories download started. Poll with run_id to check status.'
      })
    };

  } catch (error) {
    console.error('Error in download-stories:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: false,
        error: error.message || 'Failed to download stories'
      })
    };
  }
};

// Start Apify run (async - returns run ID immediately)
async function startApifyRun(highlightId) {
  const APIFY_TOKEN = process.env.APIFY_API_TOKEN;

  if (!APIFY_TOKEN) {
    throw new Error('APIFY_API_TOKEN not configured');
  }

  try {
    // Actor ID: A9vd1RbmpS40rjMxu - start run (doesn't wait)
    const response = await fetch('https://api.apify.com/v2/acts/A9vd1RbmpS40rjMxu/runs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${APIFY_TOKEN}`
      },
      body: JSON.stringify({
        highlightId: highlightId
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
async function checkRunStatus(runId, creatorId, highlightTitle) {
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

      // Log first item to debug field names
      if (items.length > 0) {
        console.log('Story item sample:', JSON.stringify(items[0], null, 2));
      }

      // Transform to our format
      const stories = items.map((item, index) => ({
        id: item.storyId || item.id || item.pk || item.media_id || `story-${index}`,
        type: (item.media_type === 2 || item.is_video || item.type === 'video' || item.storyType === 'Video') ? 'video' : 'image',
        mediaUrl: item.imageUrl || item.videoUrl || item.video_url || item.image_url || item.display_url || item.url,
        thumbnailUrl: item.imageUrl || item.thumbnail_url || item.display_url || item.thumbnail || item.image_url,
        timestamp: item.taken_at || item.timestamp || item.created_at,
        duration: item.video_duration || item.duration || null,
        highlight_title: highlightTitle
      }));

      // Optionally upload to Cloudinary (skip for now to avoid timeout)
      // Can be done in a separate background process

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
          stories_count: stories.length,
          stories: stories
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
