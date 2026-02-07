/**
 * Netlify Function: create-call
 * Creates a Retell AI web call and returns the access token
 * Uses Node 18+ built-in fetch
 */

exports.handler = async (event, context) => {
  const RETELL_API_KEY = process.env.RETELL_API_KEY;
  const RETELL_AGENT_ID = process.env.RETELL_AGENT_ID;

  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight
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

  if (!RETELL_API_KEY || !RETELL_AGENT_ID) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Retell is not configured' })
    };
  }

  try {
    // Parse request body for any metadata
    let metadata = {};
    try {
      const body = JSON.parse(event.body || '{}');
      metadata = body.metadata || {};
    } catch (e) {
      // Ignore parse errors
    }

    // Create web call with Retell API
    const response = await fetch('https://api.retellai.com/v2/create-web-call', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RETELL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        agent_id: RETELL_AGENT_ID,
        metadata: metadata,
        retell_llm_dynamic_variables: {
          // Pass any dynamic variables to your agent here
          page_url: metadata.page_url || 'unknown'
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Retell API error:', errorText);
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: 'Failed to create call', details: errorText })
      };
    }

    const data = await response.json();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        access_token: data.access_token,
        call_id: data.call_id
      })
    };

  } catch (error) {
    console.error('Error creating call:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error', message: error.message })
    };
  }
};
