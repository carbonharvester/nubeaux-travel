// Netlify Function to create Veriff verification session
// Using native fetch (Node 18+)

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { firstName, lastName, email, bookingId } = JSON.parse(event.body);

  // Validate required fields
  if (!firstName || !lastName || !email) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required fields' })
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
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
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
      body: JSON.stringify({ error: 'Failed to create verification session' })
    };
  }
};
