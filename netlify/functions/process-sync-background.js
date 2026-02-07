// Netlify Background Function to process Apify webhook results
// This function can run up to 15 minutes (background function)
// Receives webhook from Apify when scraping completes

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

function safeEqual(a, b) {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function verifySyncWebhookSecret(event, expectedSecret) {
  if (!expectedSecret) return false;
  const headerSecret =
    event.headers?.['x-webhook-secret'] ||
    event.headers?.['X-Webhook-Secret'];
  const querySecret = event.queryStringParameters?.secret;
  return safeEqual(headerSecret || '', expectedSecret) || safeEqual(querySecret || '', expectedSecret);
}

// Initialize Supabase client
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
        'Access-Control-Allow-Headers': 'Content-Type, X-Webhook-Secret',
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

  const syncWebhookSecret = process.env.SYNC_WEBHOOK_SECRET;
  if (!syncWebhookSecret) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'SYNC_WEBHOOK_SECRET not configured' })
    };
  }

  if (!verifySyncWebhookSecret(event, syncWebhookSecret)) {
    return {
      statusCode: 401,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Unauthorized webhook request' })
    };
  }

  try {
    // Parse webhook payload
    // Apify sends either raw payload template or wrapped in eventData
    let payload;
    try {
      const rawBody = JSON.parse(event.body);

      // Check if it's a direct payload or Apify's standard webhook format
      if (rawBody.creator_id && rawBody.sync_type) {
        // Direct payload from our template
        payload = rawBody;
      } else if (rawBody.eventData) {
        // Standard Apify webhook format - extract our custom payload
        // The payloadTemplate variables get replaced by Apify
        payload = {
          creator_id: rawBody.creator_id,
          sync_type: rawBody.sync_type,
          run_id: rawBody.run_id || rawBody.eventData.actorRunId,
          dataset_id: rawBody.dataset_id || rawBody.eventData.defaultDatasetId
        };
      } else {
        throw new Error('Unknown webhook payload format');
      }
    } catch (parseError) {
      console.error('Error parsing webhook payload:', parseError);
      console.log('Raw body:', event.body);
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Invalid webhook payload' })
      };
    }

    const { creator_id, sync_type, run_id, dataset_id } = payload;

    console.log(`Processing ${sync_type} sync for creator ${creator_id}`);
    console.log(`Run ID: ${run_id}, Dataset ID: ${dataset_id}`);

    if (!creator_id || !sync_type || !dataset_id) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Missing required fields: creator_id, sync_type, dataset_id' })
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

    const APIFY_TOKEN = process.env.APIFY_API_TOKEN;
    if (!APIFY_TOKEN) {
      return {
        statusCode: 500,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'APIFY_API_TOKEN not configured' })
      };
    }

    // Fetch dataset items from Apify
    console.log(`Fetching dataset ${dataset_id}...`);
    const itemsResponse = await fetch(
      `https://api.apify.com/v2/datasets/${dataset_id}/items?format=json`,
      { headers: { 'Authorization': `Bearer ${APIFY_TOKEN}` } }
    );

    if (!itemsResponse.ok) {
      throw new Error(`Failed to fetch dataset: ${itemsResponse.status}`);
    }

    const items = await itemsResponse.json();
    console.log(`Fetched ${items.length} items from dataset`);

    // Process based on sync type
    let processedCount = 0;
    if (sync_type === 'posts') {
      processedCount = await processPosts(items, creator_id, supabase);
    } else if (sync_type === 'highlights') {
      processedCount = await processHighlights(items, creator_id, supabase);
    } else {
      throw new Error(`Unknown sync_type: ${sync_type}`);
    }

    // Clear the run ID for this sync type
    const runIdField = sync_type === 'posts' ? 'posts_run_id' : 'highlights_run_id';
    await supabase
      .from('creators')
      .update({ [runIdField]: null })
      .eq('id', creator_id);

    // Check if both syncs are complete
    await checkAndUpdateSyncStatus(creator_id, supabase);

    console.log(`Successfully processed ${processedCount} ${sync_type}`);

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: true,
        sync_type,
        processed_count: processedCount
      })
    };

  } catch (error) {
    console.error('Error in process-sync-background:', error);

    // Try to update sync status to failed
    try {
      const supabase = getSupabase();
      const payload = JSON.parse(event.body);
      if (supabase && payload.creator_id) {
        await supabase
          .from('creators')
          .update({ sync_status: 'failed' })
          .eq('id', payload.creator_id);
      }
    } catch (updateError) {
      console.error('Error updating sync status to failed:', updateError);
    }

    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: false,
        error: error.message || 'Failed to process sync'
      })
    };
  }
};

// Process posts from Apify dataset
async function processPosts(items, creatorId, supabase) {
  console.log(`Processing ${items.length} posts...`);

  // Transform Apify data
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

  // Upload thumbnails to Cloudinary in batches
  const batchSize = 5;
  for (let i = 0; i < posts.length; i += batchSize) {
    const batch = posts.slice(i, i + batchSize);
    await Promise.all(batch.map(async (post) => {
      if (post.displayUrl) {
        try {
          const cloudinaryUrl = await uploadToCloudinary(
            post.displayUrl,
            `creators/${creatorId}/thumbnails`,
            `thumb_${post.shortCode}`,
            'image'
          );
          post.cloudinaryThumbnail = cloudinaryUrl;
        } catch (err) {
          console.error(`Failed to upload thumbnail for ${post.shortCode}:`, err.message);
          post.cloudinaryThumbnail = null;
        }
      }
    }));
    console.log(`Uploaded batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(posts.length / batchSize)}`);
  }

  // Save posts to Supabase
  let savedCount = 0;
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

      const { error } = await supabase
        .from('creator_posts')
        .upsert(postRecord, {
          onConflict: 'creator_id,shortcode',
          ignoreDuplicates: false
        });

      if (error) {
        console.error(`Error saving post ${post.shortCode}:`, error);
      } else {
        savedCount++;
      }
    } catch (postError) {
      console.error(`Error processing post ${post.shortCode}:`, postError);
    }
  }

  console.log(`Saved ${savedCount} posts to database`);
  return savedCount;
}

// Process highlights from Apify dataset
async function processHighlights(items, creatorId, supabase) {
  console.log(`Processing ${items.length} highlights...`);

  // Transform Apify data
  const highlights = items.map(item => ({
    id: item.id || item.highlightId || item.highlight_id,
    title: item.title || item.name,
    coverUrl: item.coverUrl || item.cover_url ||
      (typeof item.cover_media === 'string' ? item.cover_media : item.cover_media?.cropped_image_version?.url) ||
      item.thumbnail_src,
    storiesCount: item.media_count || item.storiesCount || item.stories_count || item.count || item.items?.length || 0
  }));

  // Upload covers to Cloudinary in batches
  const batchSize = 5;
  for (let i = 0; i < highlights.length; i += batchSize) {
    const batch = highlights.slice(i, i + batchSize);
    await Promise.all(batch.map(async (highlight) => {
      if (highlight.coverUrl) {
        try {
          // Sanitize IDs for Cloudinary
          const safeCreatorId = String(creatorId).replace(/[^a-zA-Z0-9_-]/g, '_');
          const safeHighlightId = String(highlight.id).replace(/[^a-zA-Z0-9_-]/g, '_');

          const cloudinaryUrl = await uploadToCloudinary(
            highlight.coverUrl,
            `creators/${safeCreatorId}/highlights`,
            `cover_${safeHighlightId}`,
            'image'
          );
          highlight.cloudinaryCover = cloudinaryUrl;
        } catch (err) {
          console.error(`Failed to upload cover for ${highlight.id}:`, err.message);
          highlight.cloudinaryCover = null;
        }
      }
    }));
    console.log(`Uploaded batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(highlights.length / batchSize)}`);
  }

  // Save highlights to Supabase
  let savedCount = 0;
  for (const highlight of highlights) {
    try {
      const coverUrl = highlight.cloudinaryCover || highlight.coverUrl;

      const record = {
        creator_id: creatorId,
        highlight_id: highlight.id,
        title: highlight.title,
        cover_url: coverUrl,
        stories_count: highlight.storiesCount || 0,
        synced_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('creator_highlights')
        .upsert(record, {
          onConflict: 'creator_id,highlight_id',
          ignoreDuplicates: false
        });

      if (error) {
        console.error(`Error saving highlight ${highlight.id}:`, error);
      } else {
        savedCount++;
      }
    } catch (highlightError) {
      console.error(`Error processing highlight ${highlight.id}:`, highlightError);
    }
  }

  console.log(`Saved ${savedCount} highlights to database`);
  return savedCount;
}

// Upload image to Cloudinary
async function uploadToCloudinary(imageUrl, folder, publicId, resourceType = 'image') {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    console.warn('Cloudinary not configured, skipping upload');
    return null;
  }

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

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cloudinary upload failed: ${errorText}`);
  }

  const result = await response.json();

  // Return optimized thumbnail URL
  if (resourceType === 'image') {
    return result.secure_url.replace('/upload/', '/upload/w_200,h_200,c_fill,f_auto,q_auto/');
  }
  return result.secure_url;
}

// Check if both posts and highlights syncs are complete, update status accordingly
async function checkAndUpdateSyncStatus(creatorId, supabase) {
  try {
    // Get current creator state
    const { data: creator, error: fetchError } = await supabase
      .from('creators')
      .select('posts_run_id, highlights_run_id')
      .eq('id', creatorId)
      .single();

    if (fetchError) {
      console.error('Error fetching creator:', fetchError);
      return;
    }

    // If both run IDs are null, both syncs are complete
    if (!creator.posts_run_id && !creator.highlights_run_id) {
      console.log('Both syncs complete, updating status to completed');

      const { error: updateError } = await supabase
        .from('creators')
        .update({
          sync_status: 'completed',
          last_synced_at: new Date().toISOString()
        })
        .eq('id', creatorId);

      if (updateError) {
        console.error('Error updating sync status to completed:', updateError);
      }
    } else {
      console.log('Waiting for other sync to complete:', {
        posts_run_id: creator.posts_run_id,
        highlights_run_id: creator.highlights_run_id
      });
    }
  } catch (error) {
    console.error('Error checking sync status:', error);
  }
}
