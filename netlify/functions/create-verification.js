// Netlify Function to create Veriff verification session
// Using native fetch (Node 18+)

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid JSON body' })
    };
  }

  const { firstName, lastName, email, bookingId } = payload;

  // Validate required fields
  if (!firstName || !lastName || !email) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Missing required fields' })
    };
  }

  if (!process.env.VERIFF_API_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'VERIFF_API_KEY not configured' })
    };
  }

  try {
    const response = await fetch('https://stationapi.veriff.com/v1/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AUTH-CLIENT': process.env.VERIFF_API_KEY
      },
      body: JSON.stringify({
        verification: {
          callback: `${process.env.URL}/verification-complete`,
          person: {
            firstName: firstName,
            lastName: lastName
          },
          vendorData: bookingId || email,
          timestamp: new Date().toISOString()
        }
      })
    });

    const data = await response.json();

    if (data.verification && data.verification.url) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          verificationUrl: data.verification.url,
          sessionId: data.verification.id
        })
      };
    } else {
      throw new Error('Failed to create verification session');
    }
  } catch (error) {
    console.error('Veriff error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to create verification session' })
    };
  }
};
