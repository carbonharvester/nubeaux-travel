// Netlify function to handle quote request submissions
// View logs in Netlify dashboard: Functions > quote-request > Logs

const { sendEmail, templates, isConfigured } = require('./utils/email');

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
      tripName,
      tripPrice,
      startDate,
      endDate,
      flexibility,
      adults,
      children,
      roomConfig,
      specialRequests,
      timestamp,
      referrer
    } = data;

    // Calculate trip duration if both dates provided
    let duration = '';
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const nights = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      duration = `${nights} nights`;
    }

    // Log to Netlify function logs (viewable in dashboard)
    console.log('=== NEW QUOTE REQUEST ===');
    console.log(`Trip: ${tripName || 'Custom Trip'}`);
    console.log(`Base Price: ${tripPrice || 'Custom'}`);
    console.log(`Name: ${firstName} ${lastName}`);
    console.log(`Email: ${email}`);
    console.log(`Phone: ${phone}`);
    console.log(`Dates: ${startDate} to ${endDate || 'Open'} ${duration ? `(${duration})` : ''}`);
    console.log(`Flexibility: ${flexibility}`);
    console.log(`Party: ${adults} adults, ${children} children`);
    console.log(`Rooms: ${roomConfig}`);
    console.log(`Special Requests: ${specialRequests || 'None'}`);
    console.log(`Referrer: ${referrer || 'Direct'}`);
    console.log(`Submitted: ${timestamp}`);
    console.log(`IP: ${event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown'}`);
    console.log('=========================');

    // Send email notifications via SendGrid (if configured)
    if (isConfigured()) {
      const emailData = {
        firstName,
        lastName,
        email,
        phone,
        tripName,
        startDate,
        endDate,
        adults,
        children,
        specialRequests,
        timestamp
      };

      // Send notification to JUNO team
      const teamEmail = templates.quoteRequestTeam(emailData);
      await sendEmail(teamEmail);

      // Send confirmation to customer
      const customerEmail = templates.quoteRequestCustomer(emailData);
      await sendEmail(customerEmail);

      console.log('Quote request emails sent');
    }

    // Optional: Send to webhook (Slack, Notion, Airtable, etc.)
    /*
    if (process.env.SLACK_WEBHOOK_URL) {
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `📋 *New Quote Request*`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*${tripName || 'Custom Trip'}*\n${firstName} ${lastName} (${email})`
              }
            },
            {
              type: 'section',
              fields: [
                { type: 'mrkdwn', text: `*Dates:*\n${startDate} - ${endDate || 'Open'}` },
                { type: 'mrkdwn', text: `*Party:*\n${adults} adults, ${children} kids` },
                { type: 'mrkdwn', text: `*Phone:*\n${phone}` },
                { type: 'mrkdwn', text: `*Rooms:*\n${roomConfig}` }
              ]
            }
          ]
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
        message: 'Quote request received! We will send your personalized quote within 24 hours.'
      })
    };

  } catch (error) {
    console.error('Error processing quote request:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Failed to process quote request' })
    };
  }
};
