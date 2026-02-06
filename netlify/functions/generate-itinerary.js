// Netlify function to generate itinerary content using Claude AI

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
    const { content, posts, stories, num_days, context: tripContext, creator_id, stays } = JSON.parse(event.body);

    // Support both old format (content) and new format (posts + stories)
    let allContent = content || [];
    if (posts && posts.length > 0) {
      allContent = [...allContent, ...posts];
    }
    if (stories && stories.length > 0) {
      // Flatten story items from groups
      stories.forEach(group => {
        if (group.items) {
          group.items.forEach(item => {
            allContent.push({
              content_type: item.type === 'video' ? 'Video' : 'Image',
              caption: `Story from: ${group.title}`,
              cloudinary_url: item.url || item.thumbnail_url,
              cloudinary_video_url: item.type === 'video' ? item.url : null
            });
          });
        }
      });
    }

    if (!allContent || allContent.length === 0) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'No content provided' })
      };
    }

    // Use combined content going forward
    const content_combined = allContent;

    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    // Prepare content summary for AI
    const contentSummary = content_combined.map((item, index) => ({
      index: index + 1,
      type: item.content_type,
      caption: item.caption || 'No caption',
      hasVideo: !!item.cloudinary_video_url
    }));

    // Prepare stays summary for AI
    const staysSummary = (stays && stays.length > 0)
      ? stays.map((s, i) => `${i + 1}. ${s.name} (${s.location || 'location not specified'})`).join('\n')
      : '';

    const prompt = `You are a travel content expert helping a creator build an itinerary from their Instagram posts and stories.

The creator has ${content_combined.length} pieces of content from their trip. Here's a summary:

${JSON.stringify(contentSummary, null, 2)}

Number of days for the itinerary: ${num_days}
${tripContext ? `Trip context: ${tripContext}` : ''}
${staysSummary ? `\nAccommodations the creator stayed at:\n${staysSummary}` : ''}

Based on the captions and content, generate a complete travel itinerary. Analyze the captions to determine:
- The destination(s)
- Key locations mentioned
- Activities and experiences
- The overall vibe/style of the trip

Return a JSON object with this exact structure:
{
  "title": "A catchy, evocative title (3-6 words)",
  "destination": "Main destination (country or region)",
  "location": "Specific location(s) mentioned",
  "duration": "${num_days} days / ${num_days - 1} nights",
  "intro": "A 2-3 sentence personal introduction that captures the essence of this trip. Write in first person singular (I, not we).",
  "included": "List of what's typically included, one item per line (flights, accommodations, activities, meals, etc.)",
  "best_for": ["tag1", "tag2", "tag3"],
  "days": [
    {
      "title": "Day 1: [Theme/Location]",
      "description": "A detailed 3-5 sentence description of this day's activities, experiences, and highlights. Be specific about what happens, where, and why it's special.",
      "activities": ["Activity 1", "Activity 2", "Activity 3"]
    }
  ]${staysSummary ? `,
  "stays": [
    {
      "name": "Property Name",
      "location": "City, Country",
      "description": "A 2-3 sentence description of this property highlighting its unique features, style, location advantages, and what makes it special for travelers. Write in third person.",
      "price_per_night": 250,
      "price_notes": "Brief note on pricing tier (e.g., 'Luxury safari lodge', 'Mid-range boutique hotel', 'Budget-friendly guesthouse')"
    }
  ]` : ''}
}

CRITICAL VOICE GUIDELINES:
- Write ALL day descriptions in FIRST PERSON SINGULAR: "I" not "we"
- The creator is sharing THEIR personal experience - travelers are connecting with the creator directly
- The creator can mention traveling with friends (e.g., "I explored the market with my friends" or "my group headed to..."), but the narrative voice must always be "I"
- Examples of correct voice: "I woke up early to catch the sunrise", "I discovered this hidden gem", "I spent the afternoon wandering"
- Examples of WRONG voice: "We explored the city", "Our group visited", "We had lunch at..."
- The traveler reading this should feel like they're hearing the creator's personal story
- For STAYS descriptions, write in THIRD PERSON (describing the property objectively)

Additional requirements:
- The "days" array must have exactly ${num_days} entries
- Each day must have a detailed description (3-5 sentences) and list of activities
- Make the title evocative and destination-specific, not generic
- For "included", provide realistic inclusions for this type of trip
- For "best_for", suggest 3-5 tags like "First-time visitors", "Photography lovers", "Couples", "Adventure seekers", etc.
- Make each day's description rich with details about the experience
${staysSummary ? `- For each stay/property, generate an engaging description based on the property name and location. Research what you know about these properties or similar ones in the area.
- IMPORTANT: Estimate a realistic price_per_night in USD for each property based on:
  * Your knowledge of the specific property if it's well-known
  * Similar properties in that destination/category if you don't know the exact property
  * The destination's general price level (e.g., Namibia safari lodges are typically $300-800/night, European boutique hotels $150-400/night)
  * Be realistic - luxury properties should be priced as luxury, budget as budget
- Include a brief price_notes explaining the pricing tier` : ''}

Return ONLY the JSON object, no additional text.`;

    // Call Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API error: ${response.status} - ${errorText}`);
    }

    const aiResponse = await response.json();
    const generatedText = aiResponse.content[0].text;

    // Parse the JSON response
    let generated;
    try {
      // Find JSON in response (in case there's extra text)
      const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        generated = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Parse error:', parseError, 'Response:', generatedText);
      throw new Error('Failed to parse AI response');
    }

    console.log('Generated content from AI:', JSON.stringify(generated, null, 2));
    console.log('Generated days:', generated.days);

    // Format days (no media per day - media is handled separately as gallery)
    const formattedDays = generated.days.map((day) => ({
      title: day.title,
      description: day.description,
      activities: day.activities || []
    }));

    // Collect all media as gallery items
    const gallery = content_combined.map(item => ({
      url: item.cloudinary_url || item.thumbnail_url,
      video_url: item.cloudinary_video_url,
      caption: item.caption,
      type: item.content_type
    }));

    // Process stays with AI-generated descriptions, prices, and placeholder images
    let enhancedStays = [];
    if (stays && stays.length > 0) {
      const generatedStays = generated.stays || [];
      enhancedStays = stays.map((originalStay, index) => {
        const aiStay = generatedStays[index] || {};
        // Generate a consistent placeholder image using Lorem Picsum with seed based on hotel name
        const seed = originalStay.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 20);
        const imageUrl = `https://picsum.photos/seed/${seed}/800/600`;

        return {
          name: originalStay.name,
          location: originalStay.location || aiStay.location || '',
          description: aiStay.description || `A beautiful property located in ${originalStay.location || 'the destination'}.`,
          price_per_night: aiStay.price_per_night || null,
          price_notes: aiStay.price_notes || null,
          image_url: imageUrl
        };
      });
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        success: true,
        title: generated.title,
        destination: generated.destination,
        location: generated.location,
        duration: generated.duration,
        intro: generated.intro,
        included: generated.included,
        best_for: generated.best_for || [],
        days: formattedDays,
        gallery: gallery,
        stays: enhancedStays
      })
    };

  } catch (error) {
    console.error('Generate itinerary error:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: false,
        error: error.message || 'Failed to generate itinerary'
      })
    };
  }
};
