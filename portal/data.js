// Creator Portal Data - Would be stored in Airtable
const CREATORS = {
  "nia-the-light": {
    id: "nia-the-light",
    name: "Nia The Light",
    handle: "niathelight",
    email: "nia@nubeauxcollective.com",
    avatar: "https://res.cloudinary.com/dng12bd0a/image/upload/c_fill,w_200,h_200,q_auto,f_auto/v1769949588/RNI-Films-IMG-3CFAE959-6D3F-4C6A-96D4-F3158BB2F3E8_shblk6.jpg",
    bio: "Content creator and storyteller with a passion for African luxury, wellness, and solo travel. Every itinerary I curate reflects my philosophy: travel should nourish the soul.",
    instagram: "https://instagram.com/niathelight",
    specialties: ["Safari", "Wellness", "Solo Travel", "Luxury"],
    regions: ["Southern Africa", "East Africa"],
    status: "active",
    joinedDate: "2024-06-01",
    itineraries: ["namibia-safari", "mozambique-island-escape"]
  }
};

const ITINERARIES = {
  "mozambique-island-escape": {
    id: "mozambique-island-escape",
    creatorId: "nia-the-light",
    title: "Island Escape",
    destination: "Mozambique",
    region: "Southern Africa",
    location: "Bazaruto Archipelago",
    duration: "5 days / 4 nights",
    priceFrom: 6500,
    bestFor: ["Beach lovers", "Diving", "Romance"],
    bestTimeToVisit: {
      peakWildlife: "May - November",
      bestWeather: "April - September"
    },
    heroImage: "https://res.cloudinary.com/dng12bd0a/image/upload/c_fill,g_auto,w_1920,h_1080,q_auto,f_auto/v1770004990/Mozambique_Klein-191_opghyh.jpg",
    intro: "The Bazaruto Archipelago is Africa's answer to the Maldives, but with soul. Crystal waters, pristine beaches, and marine life that will take your breath away. This is where I come to truly disconnect.",
    days: [
      {
        dayNumber: 1,
        title: "Arrival in Paradise",
        description: "The helicopter transfer from Vilanculos gave me my first glimpse of the archipelago—turquoise waters stretching to the horizon, sandbars emerging like secrets. Arriving at the lodge, I was greeted with fresh coconut water and shown to my villa perched above the dunes.",
        activities: ["Helicopter Transfer", "Villa Check-in", "Sunset Dhow Cruise"],
        media: []
      },
      {
        dayNumber: 2,
        title: "Ocean Adventures",
        description: "I spent the morning snorkeling over coral gardens, swimming alongside sea turtles and colorful reef fish. The afternoon was for lazing in a hammock, reading, and watching dhows drift past.",
        activities: ["Snorkeling Safari", "Beach Lunch", "Spa Treatment"],
        media: []
      },
      {
        dayNumber: 3,
        title: "Island Hopping",
        description: "Today we explored Benguerra Island by boat, stopping at a sandbank for a champagne picnic. The isolation is intoxicating—just us, the sand, and the endless Indian Ocean.",
        activities: ["Boat Excursion", "Sandbank Picnic", "Fishing"],
        media: []
      },
      {
        dayNumber: 4,
        title: "Diving Day",
        description: "The Two Mile Reef is legendary, and for good reason. Manta rays, whale sharks in season, and visibility that seems to go on forever. Even if you don't dive, snorkeling here is world-class.",
        activities: ["Scuba Diving", "Marine Safari", "Private Dinner"],
        media: []
      },
      {
        dayNumber: 5,
        title: "Farewell",
        description: "One last sunrise swim before the journey home. Mozambique has a way of staying with you—the rhythm of the tides, the warmth of the people, the taste of peri-peri prawns.",
        activities: ["Sunrise Swim", "Farewell Brunch", "Departure"],
        media: []
      }
    ],
    stays: [
      { name: "Anantara Bazaruto", link: "../stays/anantara-bazaruto.html" },
      { name: "Azura Benguerra", link: "../stays/azura-benguerra.html" }
    ],
    included: [
      "4 nights luxury island accommodation (full board)",
      "Return helicopter transfers from Vilanculos",
      "All water sports and snorkeling equipment",
      "One scuba diving excursion (certified divers)",
      "Island hopping boat trip",
      "One 60-minute spa treatment"
    ],
    status: "published",
    publishedDate: "2024-09-20",
    views: 892,
    quoteRequests: 21
  },
  "namibia-safari": {
    id: "namibia-safari",
    creatorId: "nia-the-light",
    title: "Wilderness & Wonder",
    destination: "Namibia",
    region: "Southern Africa",
    location: "Onguma, Etosha",
    duration: "4 days / 3 nights",
    priceFrom: 4500,
    bestFor: ["First safari", "Photography", "Couples"],
    bestTimeToVisit: {
      peakWildlife: "May - October",
      bestWeather: "June - September"
    },
    heroImage: "https://res.cloudinary.com/dng12bd0a/image/upload/c_fill,g_auto,w_1920,h_1080,q_auto,f_auto/v1770005193/Namibia_onguma_Klein-268_gjsdoh.jpg",
    intro: "This is my favorite introduction to safari in Southern Africa. Onguma Game Reserve borders Etosha National Park, giving you the best of both worlds—world-class game viewing and design-forward lodges that feel like home.",
    days: [
      {
        dayNumber: 1,
        title: "Arrival at Onguma",
        description: "I landed at Onguma's private airstrip and immediately felt the magic of Namibia. After checking into Camp Kala, I had just enough time to settle into my suite before our afternoon game drive into Etosha. We ended the day with sundowners overlooking the pan—watching the sky turn pink while elephants gathered at the waterhole. Dinner under the stars was the perfect first night.",
        activities: ["Lodge Check-in", "Game Drive", "Sundowners"],
        media: [
          { type: "image", url: "https://res.cloudinary.com/dng12bd0a/image/upload/c_fill,g_auto,w_600,h_600,q_auto,f_auto/v1769733714/Namibia_onguma_Klein-100_u80mk0.jpg" },
          { type: "video", url: "https://res.cloudinary.com/dng12bd0a/video/upload/c_fill,w_600,h_600,q_auto/v1770034281/WhatsApp_Video_2026-02-02_at_15.44.05_cjzpgc.mp4" },
          { type: "image", url: "https://res.cloudinary.com/dng12bd0a/image/upload/c_fill,g_auto,w_600,h_600,q_auto,f_auto/v1769733714/Namibia_onguma_Klein-45_gajcov.jpg" },
          { type: "video", url: "https://res.cloudinary.com/dng12bd0a/video/upload/c_fill,w_600,h_600,q_auto/v1770034268/WhatsApp_Video_2026-02-02_at_15.43.49_ajy76r.mp4" }
        ]
      },
      {
        dayNumber: 2,
        title: "Full Safari Day",
        description: "Up before sunrise for my morning game drive—this is when the animals are most active and the light is everything. We spotted lions, giraffes, and a parade of elephants heading to the waterhole. I spent the midday heat by the pool before heading back out for an afternoon drive. The night drive on Onguma's private reserve was surreal—seeing nocturnal wildlife under the stars felt like being on another planet.",
        activities: ["Morning Game Drive", "Pool & Brunch", "Afternoon Safari", "Night Drive"],
        media: [
          { type: "image", url: "https://res.cloudinary.com/dng12bd0a/image/upload/c_fill,g_auto,w_600,h_600,q_auto,f_auto/v1769733714/Namibia_onguma_Klein-68_qx6dih.jpg" },
          { type: "image", url: "https://res.cloudinary.com/dng12bd0a/image/upload/c_fill,g_auto,w_600,h_600,q_auto,f_auto/v1769733714/Namibia_onguma_Klein-72_hkojzt.jpg" }
        ]
      },
      {
        dayNumber: 3,
        title: "Departure",
        description: "My final morning started with a walking safari on Onguma's private reserve—there's something profound about being on foot in the bush, feeling the earth beneath you. I savored one last brunch at the lodge, already planning my return. From here you can continue to Sossusvlei, the Skeleton Coast, or fly back through Johannesburg. I left a piece of my heart in Namibia.",
        activities: ["Walking Safari", "Farewell Brunch", "Onward Journey"],
        media: [
          { type: "image", url: "https://res.cloudinary.com/dng12bd0a/image/upload/c_fill,g_auto,w_600,h_600,q_auto,f_auto/v1769733714/Namibia_onguma_Klein-90_fk3jqt.jpg" }
        ]
      }
    ],
    stays: [
      { name: "Onguma The Fort", link: "../stays/onguma-the-fort.html" },
      { name: "Onguma Camp Kala", link: "../stays/onguma-camp-kala.html" }
    ],
    included: [
      "3 nights at Onguma The Fort or Camp Kala (full board + activities)",
      "All game drives in Etosha National Park",
      "Night drives on Onguma Reserve",
      "Park fees and conservation levies",
      "Transfers as per itinerary"
    ],
    status: "published",
    publishedDate: "2024-08-15",
    views: 1247,
    quoteRequests: 34
  }
};

const STAYS = {
  "onguma-the-fort": {
    id: "onguma-the-fort",
    name: "Onguma The Fort",
    location: "Etosha, Namibia",
    style: "Moorish-inspired waterhole lodge",
    priceRange: "$$$",
    image: "https://res.cloudinary.com/dng12bd0a/image/upload/c_fill,w_600,h_400,q_auto,f_auto/v1769733714/Namibia_onguma_Klein-20_yzncpj.jpg"
  },
  "onguma-camp-kala": {
    id: "onguma-camp-kala",
    name: "Onguma Camp Kala",
    location: "Etosha, Namibia",
    style: "Ultra-exclusive tented camp",
    priceRange: "$$$$",
    image: "https://res.cloudinary.com/dng12bd0a/image/upload/c_fill,w_600,h_400,q_auto,f_auto/v1769942667/Namibia_camp_kala_Klein-168_atshty.jpg"
  }
};

// Export for use
if (typeof module !== 'undefined') {
  module.exports = { CREATORS, ITINERARIES, STAYS };
}
