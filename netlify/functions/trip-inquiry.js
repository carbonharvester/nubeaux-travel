// Netlify function to handle trip inquiry submissions
// View logs in Netlify dashboard: Functions > trip-inquiry > Logs

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
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const data = JSON.parse(event.body);
    const {
      firstName,
      lastName,
      email,
      phone,
      destination,
      travelDates,
      travelers,
      budget,
      travelStyle,
      message,
      howFound,
      timestamp,
      userAgent
    } = data;

    // Log to Netlify function logs (viewable in dashboard)
    console.log('=== NEW TRIP INQUIRY ===');
    console.log(`Name: ${firstName} ${lastName}`);
    console.log(`Email: ${email}`);
    console.log(`Phone: ${phone || 'Not provided'}`);
    console.log(`Destination: ${destination}`);
    console.log(`Travel Dates: ${travelDates || 'Not specified'}`);
    console.log(`Travelers: ${travelers || 'Not specified'}`);
    console.log(`Budget: ${budget || 'Not specified'}`);
    console.log(`Travel Style: ${travelStyle || 'Not specified'}`);
    console.log(`Message: ${message || 'None'}`);
    console.log(`How Found: ${howFound || 'Not specified'}`);
    console.log(`Submitted: ${timestamp}`);
    console.log(`IP: ${event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown'}`);
    console.log('========================');

    // Optional: Send email notification via SendGrid, Mailgun, or other service
    // Configure API keys in Netlify environment variables
    /*
    if (process.env.SENDGRID_API_KEY) {
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);

      await sgMail.send({
        to: 'travel@junotravel.com',
        from: 'noreply@junotravel.com',
        subject: `New Trip Inquiry: ${destination} - ${firstName} ${lastName}`,
        html: `
          <h2>New Trip Inquiry</h2>
          <p><strong>Name:</strong> ${firstName} ${lastName}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
          <p><strong>Destination:</strong> ${destination}</p>
          <p><strong>Travel Dates:</strong> ${travelDates || 'Not specified'}</p>
          <p><strong>Travelers:</strong> ${travelers || 'Not specified'}</p>
          <p><strong>Budget:</strong> ${budget || 'Not specified'}</p>
          <p><strong>Travel Style:</strong> ${travelStyle || 'Not specified'}</p>
          <p><strong>Message:</strong> ${message || 'None'}</p>
          <p><strong>How Found:</strong> ${howFound || 'Not specified'}</p>
        `
      });
    }
    */

    // Optional: Send to webhook (Slack, Discord, Zapier, etc.)
    /*
    if (process.env.WEBHOOK_URL) {
      await fetch(process.env.WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `New Trip Inquiry!\n*${firstName} ${lastName}* wants to visit *${destination}*\nEmail: ${email}\nBudget: ${budget || 'Not specified'}`
        })
      });
    }
    */

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        success: true,
        message: 'Inquiry received! We will be in touch within 48 hours.'
      })
    };

  } catch (error) {
    console.error('Error processing inquiry:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Failed to process inquiry' })
    };
  }
};
