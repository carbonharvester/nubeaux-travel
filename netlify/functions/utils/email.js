// Email utility for SendGrid
// Set SENDGRID_API_KEY in Netlify environment variables

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = 'noreply@junotravel.com';
const FROM_NAME = 'JUNO Travel';
const TEAM_EMAIL = 'travel@junotravel.com';

// Check if SendGrid is configured
function isConfigured() {
  return !!SENDGRID_API_KEY;
}

// Send email via SendGrid API (no npm package needed)
async function sendEmail({ to, subject, html, text }) {
  if (!SENDGRID_API_KEY) {
    console.log('SendGrid not configured, skipping email to:', to);
    return { success: false, reason: 'not_configured' };
  }

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: FROM_EMAIL, name: FROM_NAME },
        subject,
        content: [
          ...(text ? [{ type: 'text/plain', value: text }] : []),
          ...(html ? [{ type: 'text/html', value: html }] : [])
        ]
      })
    });

    if (response.ok || response.status === 202) {
      console.log('Email sent successfully to:', to);
      return { success: true };
    } else {
      const errorText = await response.text();
      console.error('SendGrid error:', response.status, errorText);
      return { success: false, error: errorText };
    }
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, error: error.message };
  }
}

// Email templates
const templates = {
  // Quote request notification to JUNO team
  quoteRequestTeam: (data) => ({
    to: TEAM_EMAIL,
    subject: `New Quote Request: ${data.tripName || 'Custom Trip'} - ${data.firstName} ${data.lastName}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3D3530; margin-bottom: 24px;">New Quote Request</h2>
        <table style="border-collapse: collapse; width: 100%;">
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 12px 0; color: #666; width: 140px;">Trip</td>
            <td style="padding: 12px 0;"><strong>${data.tripName || 'Custom Trip'}</strong></td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 12px 0; color: #666;">Customer</td>
            <td style="padding: 12px 0;"><strong>${data.firstName} ${data.lastName}</strong></td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 12px 0; color: #666;">Email</td>
            <td style="padding: 12px 0;"><a href="mailto:${data.email}" style="color: #c2703e;">${data.email}</a></td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 12px 0; color: #666;">Phone</td>
            <td style="padding: 12px 0;"><a href="tel:${data.phone}" style="color: #c2703e;">${data.phone}</a></td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 12px 0; color: #666;">Travel Dates</td>
            <td style="padding: 12px 0;">${data.startDate} to ${data.endDate || 'Flexible'}</td>
          </tr>
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 12px 0; color: #666;">Party Size</td>
            <td style="padding: 12px 0;">${data.adults} adults${data.children > 0 ? `, ${data.children} children` : ''}</td>
          </tr>
          ${data.specialRequests ? `
          <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 12px 0; color: #666;">Special Requests</td>
            <td style="padding: 12px 0;">${data.specialRequests}</td>
          </tr>
          ` : ''}
        </table>
        <p style="margin-top: 24px; color: #888; font-size: 12px;">
          Submitted: ${data.timestamp || new Date().toISOString()}
        </p>
      </div>
    `
  }),

  // Quote request confirmation to customer
  quoteRequestCustomer: (data) => ({
    to: data.email,
    subject: `Your Quote Request - ${data.tripName || 'JUNO Travel'}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3D3530; margin-bottom: 16px;">Thank you, ${data.firstName}!</h2>
        <p style="color: #444; line-height: 1.6;">
          We've received your quote request for <strong>${data.tripName || 'your custom trip'}</strong>.
        </p>
        <p style="color: #444; line-height: 1.6;">
          Our travel team is preparing a personalized quote based on your preferences. You'll receive your detailed quote within 24 hours.
        </p>
        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 24px 0;">
          <p style="margin: 0 0 8px 0; color: #666;"><strong>Your Request:</strong></p>
          <p style="margin: 0; color: #444;">
            ${data.startDate} to ${data.endDate || 'Flexible'}<br>
            ${data.adults} adults${data.children > 0 ? `, ${data.children} children` : ''}
          </p>
        </div>
        <p style="color: #444; line-height: 1.6;">
          In the meantime, feel free to explore more of our <a href="https://junotravel.com/itineraries/" style="color: #c2703e;">curated itineraries</a>.
        </p>
        <p style="margin-top: 32px; color: #444;">
          Warm regards,<br>
          <strong>The JUNO Travel Team</strong>
        </p>
        <hr style="margin-top: 40px; border: none; border-top: 1px solid #eee;">
        <p style="font-size: 12px; color: #888;">
          JUNO Travel | <a href="mailto:travel@junotravel.com" style="color: #888;">travel@junotravel.com</a>
        </p>
      </div>
    `
  }),

  // Creator notification: someone saved their itinerary
  itinerarySaved: (data) => ({
    to: data.creatorEmail,
    subject: `Someone saved your itinerary: ${data.itineraryTitle}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3D3530; margin-bottom: 16px;">Your itinerary is getting attention!</h2>
        <p style="color: #444; line-height: 1.6;">
          Someone just saved <strong>"${data.itineraryTitle}"</strong> to their wishlist.
        </p>
        <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #22c55e;">
          <p style="margin: 0; color: #166534; font-size: 24px; font-weight: 600;">
            ${data.totalSaves} ${data.totalSaves === 1 ? 'save' : 'saves'} total
          </p>
        </div>
        <p style="color: #444; line-height: 1.6;">
          Keep creating great content - travelers are noticing!
        </p>
        <a href="https://junotravel.com/portal/analytics.html" style="display: inline-block; background: #c2703e; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">
          View Analytics
        </a>
        <hr style="margin-top: 40px; border: none; border-top: 1px solid #eee;">
        <p style="font-size: 12px; color: #888;">
          JUNO Creator Portal
        </p>
      </div>
    `
  }),

  // Weekly analytics summary for creators
  weeklyAnalytics: (data) => ({
    to: data.creatorEmail,
    subject: `Your Weekly Stats: ${data.totalViews} views, ${data.totalQuotes} quote requests`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3D3530; margin-bottom: 16px;">Your Weekly Performance</h2>
        <p style="color: #666; margin-bottom: 24px;">Here's how your itineraries performed this week:</p>

        <div style="display: flex; gap: 16px; margin-bottom: 24px;">
          <div style="flex: 1; background: #f9f9f9; padding: 20px; border-radius: 8px; text-align: center;">
            <p style="margin: 0; font-size: 32px; font-weight: 600; color: #3D3530;">${data.totalViews}</p>
            <p style="margin: 4px 0 0 0; color: #666; font-size: 14px;">Views</p>
            ${data.viewsChange !== 0 ? `<p style="margin: 4px 0 0 0; color: ${data.viewsChange > 0 ? '#22c55e' : '#ef4444'}; font-size: 12px;">${data.viewsChange > 0 ? '+' : ''}${data.viewsChange}%</p>` : ''}
          </div>
          <div style="flex: 1; background: #f9f9f9; padding: 20px; border-radius: 8px; text-align: center;">
            <p style="margin: 0; font-size: 32px; font-weight: 600; color: #3D3530;">${data.totalQuotes}</p>
            <p style="margin: 4px 0 0 0; color: #666; font-size: 14px;">Quote Requests</p>
          </div>
          <div style="flex: 1; background: #f9f9f9; padding: 20px; border-radius: 8px; text-align: center;">
            <p style="margin: 0; font-size: 32px; font-weight: 600; color: #3D3530;">${data.totalSaves}</p>
            <p style="margin: 4px 0 0 0; color: #666; font-size: 14px;">Saves</p>
          </div>
        </div>

        ${data.topItinerary ? `
        <div style="background: #fef3c7; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
          <p style="margin: 0; color: #92400e; font-size: 14px;">
            <strong>Top Performer:</strong> "${data.topItinerary.title}" with ${data.topItinerary.views} views
          </p>
        </div>
        ` : ''}

        <a href="https://junotravel.com/portal/analytics.html" style="display: inline-block; background: #c2703e; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none;">
          View Full Analytics
        </a>

        <hr style="margin-top: 40px; border: none; border-top: 1px solid #eee;">
        <p style="font-size: 12px; color: #888;">
          You're receiving this because you're a JUNO creator.<br>
          <a href="#" style="color: #888;">Unsubscribe from weekly emails</a>
        </p>
      </div>
    `
  })
};

module.exports = {
  isConfigured,
  sendEmail,
  templates,
  FROM_EMAIL,
  TEAM_EMAIL
};
