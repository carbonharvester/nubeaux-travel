/**
 * Netlify Function: retell-webhook
 * Receives webhooks from Retell AI when calls end
 * Saves call data to Supabase
 */

const SUPABASE_URL = 'https://qnhqtlpkwscbguossfmn.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFuaHF0bHBrd3NjYmd1b3NzZm1uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDA5NzAyMSwiZXhwIjoyMDg1NjczMDIxfQ.7h9SrfrLjeVV-HpKsRcTfp99Z4p2x5wFC-erxxw0VWY';

// Helper to make Supabase requests
async function supabaseRequest(endpoint, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...options.headers
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Supabase error: ${error}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

// Extract structured data from transcript/analysis
function extractCallerInfo(callData) {
  const info = {
    caller_name: null,
    caller_email: null,
    caller_phone: null,
    destination_interest: null,
    travel_dates: null,
    travelers: null,
    budget: null
  };

  // Try to get from call analysis custom data
  if (callData.call_analysis?.custom_analysis_data) {
    const custom = callData.call_analysis.custom_analysis_data;
    info.caller_name = custom.caller_name || custom.name || null;
    info.caller_email = custom.caller_email || custom.email || null;
    info.caller_phone = custom.caller_phone || custom.phone || null;
    info.destination_interest = custom.destination || custom.destination_interest || null;
    info.travel_dates = custom.travel_dates || custom.dates || null;
    info.travelers = custom.travelers || custom.party_size || null;
    info.budget = custom.budget || null;
  }

  return info;
}

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const payload = JSON.parse(event.body);
    console.log('Webhook received:', JSON.stringify(payload, null, 2));

    const { event: eventType, call } = payload;

    // We care about call_ended and call_analyzed events
    if (!['call_ended', 'call_analyzed'].includes(eventType)) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Event ignored', event: eventType })
      };
    }

    if (!call || !call.call_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing call data' })
      };
    }

    // Build transcript text from transcript array
    let transcriptText = '';
    if (call.transcript_object && Array.isArray(call.transcript_object)) {
      transcriptText = call.transcript_object
        .map(t => `${t.role === 'agent' ? 'Agent' : 'User'}: ${t.content}`)
        .join('\n');
    } else if (call.transcript) {
      transcriptText = call.transcript;
    }

    // Extract caller info
    const callerInfo = extractCallerInfo(call);

    // Calculate duration
    const durationSeconds = call.end_timestamp && call.start_timestamp
      ? Math.round((call.end_timestamp - call.start_timestamp) / 1000)
      : null;

    // Prepare voice_calls record
    const voiceCallData = {
      retell_call_id: call.call_id,
      agent_id: call.agent_id,
      transcript: transcriptText,
      transcript_json: call.transcript_object || null,
      call_summary: call.call_analysis?.call_summary || null,
      caller_name: callerInfo.caller_name,
      caller_email: callerInfo.caller_email,
      caller_phone: callerInfo.caller_phone,
      destination_interest: callerInfo.destination_interest,
      travel_dates: callerInfo.travel_dates,
      travelers: callerInfo.travelers,
      budget: callerInfo.budget,
      call_duration_seconds: durationSeconds,
      call_status: call.call_status || eventType,
      page_url: call.metadata?.page_url || null,
      user_agent: call.metadata?.user_agent || null
    };

    // Upsert to voice_calls (in case we get both call_ended and call_analyzed)
    await supabaseRequest('/rest/v1/voice_calls', {
      method: 'POST',
      headers: {
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(voiceCallData)
    });

    console.log('Voice call saved:', call.call_id);

    // If we have caller info, also create a trip_inquiry
    if (callerInfo.caller_name || callerInfo.caller_email || callerInfo.destination_interest) {
      const inquiryData = {
        first_name: callerInfo.caller_name?.split(' ')[0] || 'Voice',
        last_name: callerInfo.caller_name?.split(' ').slice(1).join(' ') || 'Caller',
        email: callerInfo.caller_email || `voice-${call.call_id.slice(0, 8)}@placeholder.local`,
        phone: callerInfo.caller_phone,
        destination: callerInfo.destination_interest,
        travel_dates: callerInfo.travel_dates,
        travelers: callerInfo.travelers,
        budget: callerInfo.budget,
        message: `[Voice Call] ${call.call_analysis?.call_summary || 'See voice_calls table for transcript'}`,
        status: 'new'
      };

      await supabaseRequest('/rest/v1/trip_inquiries', {
        method: 'POST',
        body: JSON.stringify(inquiryData)
      });

      console.log('Trip inquiry created from voice call');
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, call_id: call.call_id })
    };

  } catch (error) {
    console.error('Webhook error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error', message: error.message })
    };
  }
};
