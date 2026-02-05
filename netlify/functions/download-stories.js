// Netlify function to download Instagram stories from a highlight using Apify
// Actor ID: A9vd1RbmpS40rjMxu

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
    const { highlight_id, highlight_title, creator_id } = JSON.parse(event.body);

    if (!highlight_id) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Highlight ID is required' })
      };
    }

    console.log(`Downloading stories from highlight: ${highlight_id} (${highlight_title || 'untitled'})`);

    // Call Apify Stories Download Actor
    const apifyResponse = await callApifyStoriesActor(highlight_id);

    if (!apifyResponse.success) {
      throw new Error(apifyResponse.error || 'Apify scraping failed');
    }

    // Optionally upload to Cloudinary and save to Supabase
    let processedStories = apifyResponse.stories;

    if (creator_id) {
      processedStories = await processAndSaveStories(apifyResponse.stories, creator_id, highlight_title);
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        success: true,
        highlight_id,
        highlight_title,
        stories_count: processedStories.length,
        stories: processedStories
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

// Call Apify Stories Download Actor (A9vd1RbmpS40rjMxu)
async function callApifyStoriesActor(highlightId) {
  const APIFY_TOKEN = process.env.APIFY_API_TOKEN;

  if (!APIFY_TOKEN) {
    throw new Error('APIFY_API_TOKEN not configured');
  }

  // Strip "highlight:" prefix if present (from get-highlights actor)
  let cleanId = String(highlightId);
  if (cleanId.startsWith('highlight:')) {
    cleanId = cleanId.replace('highlight:', '');
  }

  try {
    // Actor ID: A9vd1RbmpS40rjMxu
    const response = await fetch('https://api.apify.com/v2/acts/A9vd1RbmpS40rjMxu/run-sync-get-dataset-items', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${APIFY_TOKEN}`
      },
      body: JSON.stringify({
        highlightId: cleanId
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Apify API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // Transform response to our format
    // Log first item to debug field names
    if (data.length > 0) {
      console.log('Story item sample:', JSON.stringify(data[0], null, 2));
    }

    const stories = data.map((item, index) => ({
      id: item.storyId || item.id || item.pk || item.media_id || `story-${index}`,
      type: (item.media_type === 2 || item.is_video || item.type === 'video' || item.storyType === 'Video') ? 'video' : 'image',
      mediaUrl: item.imageUrl || item.videoUrl || item.video_url || item.image_url || item.display_url || item.url,
      thumbnailUrl: item.imageUrl || item.thumbnail_url || item.display_url || item.thumbnail || item.image_url,
      timestamp: item.taken_at || item.timestamp || item.created_at,
      duration: item.video_duration || item.duration || null
    }));

    return { success: true, stories };

  } catch (error) {
    console.error('Apify stories error:', error);
    return { success: false, error: error.message };
  }
}

// Process stories with Cloudinary upload
async function processAndSaveStories(stories, creatorId, highlightTitle) {
  const processed = [];

  // Upload to Cloudinary in batches of 3
  const batchSize = 3;
  for (let i = 0; i < stories.length; i += batchSize) {
    const batch = stories.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(async (story) => {
      try {
        let cloudinaryUrl = null;
        if (story.mediaUrl || story.thumbnailUrl) {
          const sourceUrl = story.mediaUrl || story.thumbnailUrl;
          console.log(`Uploading story ${story.id} from ${sourceUrl.substring(0, 50)}...`);
          const uploadResult = await uploadToCloudinary(
            sourceUrl,
            creatorId,
            story.id,
            story.type
          );
          cloudinaryUrl = uploadResult.url;
          console.log(`Story ${story.id} Cloudinary result: ${cloudinaryUrl}`);
        }
        return {
          ...story,
          cloudinary_url: cloudinaryUrl,
          thumbnail_url: cloudinaryUrl || story.thumbnailUrl,
          highlight_title: highlightTitle,
          creator_id: creatorId
        };
      } catch (error) {
        console.error(`Error processing story ${story.id}:`, error);
        return {
          ...story,
          thumbnail_url: story.thumbnailUrl,
          highlight_title: highlightTitle,
          creator_id: creatorId,
          error: error.message
        };
      }
    }));
    processed.push(...results);
  }

  return processed;
}

// Upload to Cloudinary (optional, for permanent storage)
async function uploadToCloudinary(mediaUrl, creatorId, storyId, mediaType) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return { url: mediaUrl }; // Return original if Cloudinary not configured
  }

  const crypto = require('crypto');
  // Sanitize IDs for Cloudinary (remove colons and other special chars)
  const safeCreatorId = String(creatorId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeStoryId = String(storyId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const folder = `creators/${safeCreatorId}/stories`;
  const publicId = `story-${safeStoryId}`;
  const resourceType = mediaType === 'video' ? 'video' : 'image';
  const timestamp = Math.round(Date.now() / 1000);

  const signatureString = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash('sha1').update(signatureString).digest('hex');

  const formData = new URLSearchParams();
  formData.append('file', mediaUrl);
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
    throw new Error('Cloudinary upload failed');
  }

  const result = await response.json();
  return { url: result.secure_url };
}
