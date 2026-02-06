// Netlify function to handle quote request submissions
// View logs in Netlify dashboard: Functions > quote-request > Logs

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

    // Optional: Send email notification via SendGrid
    /*
    if (process.env.SENDGRID_API_KEY) {
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);

      // Email to you (the travel advisor)
      await sgMail.send({
        to: 'travel@junotravel.com',
        from: 'noreply@junotravel.com',
        subject: `Quote Request: ${tripName || 'Custom Trip'} - ${firstName} ${lastName}`,
        html: `
          <h2>New Quote Request</h2>
          <table style="border-collapse: collapse; width: 100%; max-width: 600px;">
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 10px; color: #666;">Trip</td>
              <td style="padding: 10px;"><strong>${tripName || 'Custom Trip'}</strong></td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 10px; color: #666;">Base Price</td>
              <td style="padding: 10px;">${tripPrice || 'Custom pricing'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 10px; color: #666;">Customer</td>
              <td style="padding: 10px;"><strong>${firstName} ${lastName}</strong></td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 10px; color: #666;">Email</td>
              <td style="padding: 10px;"><a href="mailto:${email}">${email}</a></td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 10px; color: #666;">Phone</td>
              <td style="padding: 10px;"><a href="tel:${phone}">${phone}</a></td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 10px; color: #666;">Travel Dates</td>
              <td style="padding: 10px;">${startDate} to ${endDate || 'Open-ended'} ${duration ? `(${duration})` : ''}</td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 10px; color: #666;">Flexibility</td>
              <td style="padding: 10px;">${flexibility}</td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 10px; color: #666;">Party Size</td>
              <td style="padding: 10px;">${adults} adults${children > 0 ? `, ${children} children` : ''}</td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 10px; color: #666;">Rooms</td>
              <td style="padding: 10px;">${roomConfig}</td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 10px; color: #666;">Special Requests</td>
              <td style="padding: 10px;">${specialRequests || 'None'}</td>
            </tr>
          </table>
          <p style="margin-top: 20px; color: #666; font-size: 12px;">
            Submitted: ${timestamp}<br>
            Referrer: ${referrer || 'Direct'}
          </p>
        `
      });

      // Confirmation email to customer
      await sgMail.send({
        to: email,
        from: 'travel@junotravel.com',
        subject: 'Your Quote Request - JUNO Travel',
        html: `
          <h2 style="color: #3D3530;">Thank you, ${firstName}!</h2>
          <p>We've received your quote request for <strong>${tripName || 'your custom trip'}</strong>.</p>
          <p>Our travel team is preparing a personalized quote based on your preferences:</p>
          <ul>
            <li><strong>Dates:</strong> ${startDate} to ${endDate || 'Flexible'}</li>
            <li><strong>Travelers:</strong> ${adults} adults${children > 0 ? `, ${children} children` : ''}</li>
          </ul>
          <p>You'll receive your detailed quote within 24 hours.</p>
          <p>In the meantime, feel free to explore more of our <a href="https://junotravel.com/itineraries/">curated itineraries</a>.</p>
          <p style="margin-top: 30px;">
            Warm regards,<br>
            <strong>The JUNO Travel Team</strong>
          </p>
          <hr style="margin-top: 40px; border: none; border-top: 1px solid #eee;">
          <p style="font-size: 12px; color: #888;">
            JUNO Travel | travel@junotravel.com<br>
            A JUNO Collective Company
          </p>
        `
      });
    }
    */

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
