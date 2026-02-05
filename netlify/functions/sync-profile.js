// Netlify function to sync Instagram profile posts using Apify API
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
    const { profile_url, creator_id, run_id, date_from, date_to, action } = JSON.parse(event.body);

    // Load saved posts from database (no scraping)
    if (action === 'load') {
      return await loadSavedPosts(creator_id, date_from, date_to);
    }

    // If run_id is provided, check status of existing run
    if (run_id) {
      return await checkRunStatus(run_id, creator_id, date_to);
    }

    // Otherwise, start a new run
    if (!profile_url) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Profile URL is required' })
      };
    }

    if (!creator_id) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Creator ID is required' })
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

    console.log(`Starting sync for @${username} (creator: ${creator_id}, date_from: ${date_from || '6 months'})`);

    // Start Apify run (async - returns immediately)
    const runResult = await startApifyRun(username, date_from);

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
        username,
        message: 'Sync started. Poll with run_id to check status.'
      })
    };

  } catch (error) {
    console.error('Error in sync-profile:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: false,
        error: error.message || 'Failed to sync profile'
      })
    };
  }
};

// Start Apify run (async - returns run ID immediately)
async function startApifyRun(username, dateFrom) {
  const APIFY_TOKEN = process.env.APIFY_API_TOKEN;

  if (!APIFY_TOKEN) {
    throw new Error('APIFY_API_TOKEN not configured');
  }

  try {
    // Build request body with date filter
    const requestBody = {
      directUrls: [`https://www.instagram.com/${username}/`],
      // Fetch more posts (default is often limited)
      resultsLimit: 200
    };

    // Only add date filter if explicitly provided
    if (dateFrom) {
      requestBody.onlyPostsNewerThan = dateFrom;
    }

    console.log('Apify request:', JSON.stringify(requestBody));

    // Start the actor run (doesn't wait for completion)
    const response = await fetch('https://api.apify.com/v2/acts/apify~instagram-scraper/runs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${APIFY_TOKEN}`
      },
      body: JSON.stringify(requestBody)
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
async function checkRunStatus(runId, creatorId, dateTo) {
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

      let items = await itemsResponse.json();

      // Filter by date_to if provided (Apify only supports "newer than", not "older than")
      if (dateTo) {
        const dateToTimestamp = new Date(dateTo).getTime();
        items = items.filter(item => {
          const postDate = new Date(item.timestamp).getTime();
          return postDate <= dateToTimestamp;
        });
        console.log(`Filtered to ${items.length} posts before ${dateTo}`);
      }

      // Transform and save posts
      const posts = items.map(item => ({
        id: item.id,
        shortCode: item.shortCode,
        type: item.type,
        caption: item.caption,
        displayUrl: item.displayUrl,
        videoUrl: item.videoUrl,
        likesCount: item.likesCount,
        commentsCount: item.commentsCount,
        locationName: item.locationName,
        timestamp: item.timestamp
      }));

      // Save to Supabase if configured
      const savedPosts = await savePosts(posts, creatorId);

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
          posts_count: savedPosts.length,
          posts: savedPosts
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

// Load saved posts from Supabase (no scraping)
async function loadSavedPosts(creatorId, dateFrom, dateTo) {
  const supabase = getSupabase();

  if (!supabase) {
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true, posts: [], message: 'Database not configured' })
    };
  }

  if (!creatorId) {
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true, posts: [], message: 'No creator ID' })
    };
  }

  // Check if creatorId looks like a valid UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(creatorId)) {
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true, posts: [], message: 'No saved posts for this session' })
    };
  }

  try {
    let query = supabase
      .from('creator_posts')
      .select('*')
      .eq('creator_id', creatorId)
      .order('posted_at', { ascending: false });

    // Apply date filters if provided
    if (dateFrom) {
      query = query.gte('posted_at', new Date(dateFrom).toISOString());
    }
    if (dateTo) {
      // Add 1 day to include posts on the "to" date
      const toDate = new Date(dateTo);
      toDate.setDate(toDate.getDate() + 1);
      query = query.lt('posted_at', toDate.toISOString());
    }

    const { data: posts, error } = await query;

    if (error) {
      throw error;
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        success: true,
        status: 'loaded',
        posts_count: posts.length,
        posts: posts
      })
    };
  } catch (error) {
    console.error('Load posts error:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
}

// Save posts to Supabase (with Cloudinary thumbnail upload)
async function savePosts(posts, creatorId) {
  const supabase = getSupabase();
  const savedPosts = [];

  // Upload thumbnails to Cloudinary in parallel (batch of 5 at a time)
  const batchSize = 5;
  for (let i = 0; i < posts.length; i += batchSize) {
    const batch = posts.slice(i, i + batchSize);
    await Promise.all(batch.map(async (post) => {
      if (post.displayUrl) {
        try {
          const cloudinaryUrl = await uploadThumbnailToCloudinary(post.displayUrl, creatorId, post.shortCode);
          post.cloudinaryThumbnail = cloudinaryUrl;
        } catch (err) {
          console.error(`Failed to upload thumbnail for ${post.shortCode}:`, err.message);
          post.cloudinaryThumbnail = null;
        }
      }
    }));
  }

  for (const post of posts) {
    try {
      const postRecord = {
        creator_id: creatorId,
        instagram_id: post.id,
        shortcode: post.shortCode,
        post_type: post.type,
        caption: post.caption,
        display_url: post.displayUrl,
        video_url: post.videoUrl || null,
        thumbnail_url: post.cloudinaryThumbnail || post.displayUrl,
        likes_count: post.likesCount || 0,
        comments_count: post.commentsCount || 0,
        location_name: post.locationName || null,
        posted_at: post.timestamp,
        synced_at: new Date().toISOString()
      };

      if (supabase) {
        const { data, error } = await supabase
          .from('creator_posts')
          .upsert(postRecord, {
            onConflict: 'creator_id,shortcode',
            ignoreDuplicates: false
          })
          .select()
          .single();

        if (error) {
          console.error(`Error saving post ${post.shortCode}:`, error);
          savedPosts.push(postRecord);
        } else {
          savedPosts.push(data);
        }
      } else {
        savedPosts.push(postRecord);
      }
    } catch (postError) {
      console.error(`Error processing post ${post.shortCode}:`, postError);
    }
  }

  return savedPosts;
}

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

// Upload thumbnail to Cloudinary and return permanent URL
async function uploadThumbnailToCloudinary(imageUrl, creatorId, shortcode) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    console.warn('Cloudinary not configured, skipping thumbnail upload');
    return null;
  }

  const crypto = require('crypto');
  const folder = `creators/${creatorId}/thumbnails`;
  const publicId = `thumb_${shortcode}`;
  const timestamp = Math.round(Date.now() / 1000);

  // Create signature for Cloudinary API
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

  // Return a thumbnail-sized URL
  return result.secure_url.replace('/upload/', '/upload/w_200,h_200,c_fill,f_auto,q_auto/');
}
