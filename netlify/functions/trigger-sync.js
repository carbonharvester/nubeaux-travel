// Netlify function to trigger background Instagram sync
// Starts Apify runs with webhooks and returns immediately
// The actual processing happens in process-sync-background.js

const { createClient } = require('@supabase/supabase-js');

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

// Get the site URL for webhooks
function getSiteUrl() {
  // Netlify provides this in production
  if (process.env.URL) {
    return process.env.URL;
  }
  // Fallback for local development
  return process.env.SITE_URL || 'http://localhost:8888';
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
    const { creator_id, instagram_username } = JSON.parse(event.body);

    if (!creator_id) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'creator_id is required' })
      };
    }

    if (!instagram_username) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'instagram_username is required' })
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

    const siteUrl = getSiteUrl();
    const webhookUrl = `${siteUrl}/.netlify/functions/process-sync-background`;
    const username = extractUsername(instagram_username);

    console.log(`Starting background sync for @${username} (creator: ${creator_id})`);
    console.log(`Webhook URL: ${webhookUrl}`);

    // Start Apify run for posts
    const postsRunResult = await startApifyPostsRun(username, creator_id, webhookUrl, APIFY_TOKEN);

    // Start Apify run for highlights
    const highlightsRunResult = await startApifyHighlightsRun(username, creator_id, webhookUrl, APIFY_TOKEN);

    // Update creator sync status
    const { error: updateError } = await supabase
      .from('creators')
      .update({
        sync_status: 'syncing',
        posts_run_id: postsRunResult.success ? postsRunResult.runId : null,
        highlights_run_id: highlightsRunResult.success ? highlightsRunResult.runId : null
      })
      .eq('id', creator_id);

    if (updateError) {
      console.error('Error updating sync status:', updateError);
    }

    return {
      statusCode: 202, // Accepted - processing started
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        success: true,
        message: 'Background sync started',
        posts_run_id: postsRunResult.success ? postsRunResult.runId : null,
        highlights_run_id: highlightsRunResult.success ? highlightsRunResult.runId : null,
        posts_error: postsRunResult.error || null,
        highlights_error: highlightsRunResult.error || null
      })
    };

  } catch (error) {
    console.error('Error in trigger-sync:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: false,
        error: error.message || 'Failed to start sync'
      })
    };
  }
};

// Extract username from various Instagram URL formats
function extractUsername(input) {
  // If it's a URL, extract username
  const match = input.match(/instagram\.com\/([A-Za-z0-9._]+)/);
  if (match) {
    const reserved = ['p', 'reel', 'tv', 'stories', 'explore', 'accounts', 'direct'];
    if (!reserved.includes(match[1].toLowerCase())) {
      return match[1];
    }
  }
  // If it's already a username, return as-is
  if (/^[A-Za-z0-9._]+$/.test(input)) {
    return input;
  }
  return input;
}

// Start Apify run for posts with webhook
async function startApifyPostsRun(username, creatorId, webhookUrl, token) {
  try {
    // Build webhook payload template
    const webhookPayload = {
      creator_id: creatorId,
      sync_type: 'posts',
      run_id: '{{runId}}',
      dataset_id: '{{defaultDatasetId}}'
    };

    const requestBody = {
      directUrls: [`https://www.instagram.com/${username}/`],
      onlyPostsNewerThan: '6 months',
      webhooks: [{
        eventTypes: ['ACTOR.RUN.SUCCEEDED', 'ACTOR.RUN.FAILED'],
        requestUrl: webhookUrl,
        payloadTemplate: JSON.stringify(webhookPayload)
      }]
    };

    console.log('Starting posts Apify run:', JSON.stringify(requestBody, null, 2));

    const response = await fetch('https://api.apify.com/v2/acts/apify~instagram-scraper/runs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Apify API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Posts run started:', data.data.id);
    return { success: true, runId: data.data.id };

  } catch (error) {
    console.error('Error starting posts run:', error);
    return { success: false, error: error.message };
  }
}

// Start Apify run for highlights with webhook
async function startApifyHighlightsRun(username, creatorId, webhookUrl, token) {
  try {
    // Build webhook payload template
    const webhookPayload = {
      creator_id: creatorId,
      sync_type: 'highlights',
      run_id: '{{runId}}',
      dataset_id: '{{defaultDatasetId}}'
    };

    const requestBody = {
      startUrls: [`https://www.instagram.com/${username}/`],
      webhooks: [{
        eventTypes: ['ACTOR.RUN.SUCCEEDED', 'ACTOR.RUN.FAILED'],
        requestUrl: webhookUrl,
        payloadTemplate: JSON.stringify(webhookPayload)
      }]
    };

    console.log('Starting highlights Apify run:', JSON.stringify(requestBody, null, 2));

    // Actor ID for highlights: 9oQm3jSOiztZqDIZu
    const response = await fetch('https://api.apify.com/v2/acts/9oQm3jSOiztZqDIZu/runs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Apify API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Highlights run started:', data.data.id);
    return { success: true, runId: data.data.id };

  } catch (error) {
    console.error('Error starting highlights run:', error);
    return { success: false, error: error.message };
  }
}
