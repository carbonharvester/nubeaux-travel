// Instagram OAuth - Exchange code for access token and get user profile
const INSTAGRAM_APP_ID = '887486630914098';

exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
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
    const { code, redirect_uri } = JSON.parse(event.body);

    if (!code) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Authorization code is required' })
      };
    }

    const INSTAGRAM_APP_SECRET = process.env.INSTAGRAM_APP_SECRET;

    if (!INSTAGRAM_APP_SECRET) {
      console.error('INSTAGRAM_APP_SECRET not configured');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Instagram OAuth not configured' })
      };
    }

    // Step 1: Exchange code for short-lived access token
    const tokenUrl = 'https://api.instagram.com/oauth/access_token';
    const tokenParams = new URLSearchParams({
      client_id: INSTAGRAM_APP_ID,
      client_secret: INSTAGRAM_APP_SECRET,
      grant_type: 'authorization_code',
      redirect_uri: redirect_uri,
      code: code
    });

    console.log('Exchanging code for token...');

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString()
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error_type || tokenData.error_message) {
      console.error('Token exchange error:', tokenData);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: tokenData.error_message || 'Failed to authenticate with Instagram',
          details: tokenData
        })
      };
    }

    const { access_token, user_id } = tokenData;

    if (!access_token) {
      console.error('No access token in response:', tokenData);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Failed to get access token from Instagram' })
      };
    }

    // Step 2: Get user profile using the access token
    const profileUrl = `https://graph.instagram.com/me?fields=user_id,username,account_type,name&access_token=${access_token}`;

    console.log('Fetching user profile...');

    const profileResponse = await fetch(profileUrl);
    const profileData = await profileResponse.json();

    if (profileData.error) {
      console.error('Profile fetch error:', profileData);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: profileData.error.message || 'Failed to get Instagram profile',
          details: profileData
        })
      };
    }

    console.log('Successfully verified Instagram user:', profileData.username);

    // Return the verified profile data
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        instagram: {
          user_id: profileData.user_id || user_id,
          username: profileData.username,
          account_type: profileData.account_type,
          name: profileData.name
        }
      })
    };

  } catch (error) {
    console.error('Instagram auth error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error', message: error.message })
    };
  }
};
