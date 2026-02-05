// Netlify function to scrape Instagram content using Apify API
// and upload to Cloudinary for permanent hosting

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

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
    const { urls, creator_id } = JSON.parse(event.body);

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'No valid URLs provided' })
      };
    }

    console.log(`Processing ${urls.length} Instagram URLs for creator ${creator_id}`);

    // Extract shortcodes from URLs
    const shortcodes = urls.map(url => {
      const match = url.match(/instagram\.com\/(p|reel|tv)\/([A-Za-z0-9_-]+)/);
      return match ? { url, shortcode: match[2], type: match[1] } : null;
    }).filter(Boolean);

    if (shortcodes.length === 0) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'No valid Instagram URLs found' })
      };
    }

    // Call Apify Instagram Post Scraper
    const apifyResponse = await callApify(shortcodes.map(s => s.url));

    if (!apifyResponse.success) {
      throw new Error(apifyResponse.error || 'Apify scraping failed');
    }

    // Process results and upload to Cloudinary
    const processedContent = [];

    for (const post of apifyResponse.data) {
      try {
        // Upload media to Cloudinary
        const cloudinaryResult = await uploadToCloudinary(post, creator_id);

        // Save to Supabase
        const contentRecord = {
          creator_id,
          instagram_url: post.url,
          instagram_shortcode: post.shortcode,
          content_type: post.type, // 'Video', 'Image', 'Sidecar'
          caption: post.caption,
          cloudinary_url: cloudinaryResult.image_url,
          cloudinary_video_url: cloudinaryResult.video_url,
          thumbnail_url: cloudinaryResult.thumbnail_url,
          carousel_urls: cloudinaryResult.carousel_urls,
          location_name: post.locationName,
          posted_at: post.timestamp,
          status: 'ready'
        };

        const { data, error } = await supabase
          .from('creator_content')
          .insert(contentRecord)
          .select()
          .single();

        if (error) {
          console.error('Supabase insert error:', error);
          contentRecord.status = 'failed';
          contentRecord.error_message = error.message;
        }

        processedContent.push(data || contentRecord);
      } catch (postError) {
        console.error(`Error processing post ${post.shortcode}:`, postError);
        processedContent.push({
          instagram_shortcode: post.shortcode,
          instagram_url: post.url,
          status: 'failed',
          error_message: postError.message
        });
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        success: true,
        content: processedContent
      })
    };

  } catch (error) {
    console.error('Error in scrape-instagram:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: false,
        error: error.message || 'Failed to scrape Instagram content'
      })
    };
  }
};

// Call Apify Instagram Post Scraper
async function callApify(urls) {
  const APIFY_TOKEN = process.env.APIFY_API_TOKEN;

  if (!APIFY_TOKEN) {
    throw new Error('APIFY_API_TOKEN not configured');
  }

  try {
    // Use Apify's Instagram Post Scraper actor
    const response = await fetch('https://api.apify.com/v2/acts/apify~instagram-post-scraper/run-sync-get-dataset-items', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${APIFY_TOKEN}`
      },
      body: JSON.stringify({
        directUrls: urls,
        resultsLimit: urls.length,
        addParentData: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Apify API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // Transform Apify response to our format
    const posts = data.map(item => ({
      shortcode: item.shortCode || item.id,
      url: item.url,
      type: item.type, // 'Video', 'Image', 'Sidecar'
      caption: item.caption,
      displayUrl: item.displayUrl, // Main image URL
      videoUrl: item.videoUrl, // Video URL if applicable
      childPosts: item.childPosts || [], // Carousel items
      locationName: item.locationName,
      timestamp: item.timestamp,
      likesCount: item.likesCount,
      commentsCount: item.commentsCount
    }));

    return { success: true, data: posts };

  } catch (error) {
    console.error('Apify error:', error);
    return { success: false, error: error.message };
  }
}

// Upload media to Cloudinary
async function uploadToCloudinary(post, creator_id) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    console.warn('Cloudinary not configured, returning original URLs');
    return {
      image_url: post.displayUrl,
      video_url: post.videoUrl,
      thumbnail_url: post.displayUrl,
      carousel_urls: post.childPosts?.map(c => c.displayUrl) || null
    };
  }

  const folder = `creators/${creator_id}/content`;
  const results = {
    image_url: null,
    video_url: null,
    thumbnail_url: null,
    carousel_urls: null
  };

  try {
    // Generate authentication signature
    const timestamp = Math.round(Date.now() / 1000);
    const crypto = require('crypto');

    // Upload main image
    if (post.displayUrl) {
      const imageResult = await cloudinaryUpload(post.displayUrl, {
        folder,
        public_id: `${post.shortcode}_main`,
        resource_type: 'image',
        cloudName,
        apiKey,
        apiSecret,
        timestamp
      });
      results.image_url = imageResult.secure_url;
      results.thumbnail_url = imageResult.secure_url;
    }

    // Upload video if present
    if (post.videoUrl) {
      const videoResult = await cloudinaryUpload(post.videoUrl, {
        folder,
        public_id: `${post.shortcode}_video`,
        resource_type: 'video',
        cloudName,
        apiKey,
        apiSecret,
        timestamp
      });
      results.video_url = videoResult.secure_url;

      // Generate video thumbnail
      results.thumbnail_url = videoResult.secure_url.replace('/video/upload/', '/video/upload/so_0,w_400,h_400,c_fill,f_jpg/');
    }

    // Upload carousel items
    if (post.childPosts && post.childPosts.length > 0) {
      const carouselUrls = [];
      for (let i = 0; i < post.childPosts.length; i++) {
        const child = post.childPosts[i];
        const resourceType = child.type === 'Video' ? 'video' : 'image';
        const childResult = await cloudinaryUpload(child.displayUrl || child.videoUrl, {
          folder,
          public_id: `${post.shortcode}_carousel_${i}`,
          resource_type: resourceType,
          cloudName,
          apiKey,
          apiSecret,
          timestamp
        });
        carouselUrls.push({
          url: childResult.secure_url,
          type: resourceType
        });
      }
      results.carousel_urls = carouselUrls;
    }

    return results;

  } catch (error) {
    console.error('Cloudinary upload error:', error);
    // Return original URLs as fallback
    return {
      image_url: post.displayUrl,
      video_url: post.videoUrl,
      thumbnail_url: post.displayUrl,
      carousel_urls: post.childPosts?.map(c => ({ url: c.displayUrl, type: c.type })) || null
    };
  }
}

// Helper function for Cloudinary upload
async function cloudinaryUpload(url, options) {
  const { folder, public_id, resource_type, cloudName, apiKey, apiSecret, timestamp } = options;
  const crypto = require('crypto');

  // Create signature
  const signatureString = `folder=${folder}&public_id=${public_id}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash('sha1').update(signatureString).digest('hex');

  const formData = new URLSearchParams();
  formData.append('file', url);
  formData.append('folder', folder);
  formData.append('public_id', public_id);
  formData.append('timestamp', timestamp);
  formData.append('api_key', apiKey);
  formData.append('signature', signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resource_type}/upload`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cloudinary upload failed: ${errorText}`);
  }

  return response.json();
}
