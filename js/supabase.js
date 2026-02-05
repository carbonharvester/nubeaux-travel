/**
 * NUBEAUX Travel - Supabase Client Library
 *
 * SETUP INSTRUCTIONS:
 * 1. Create a Supabase project at https://supabase.com
 * 2. Run the SQL schema from /supabase/schema.sql in the SQL Editor
 * 3. Replace SUPABASE_URL and SUPABASE_ANON_KEY below with your values
 *    (found in Settings > API)
 */

// ============================================
// CONFIGURATION - Replace with your values
// ============================================
const SUPABASE_URL = 'https://qnhqtlpkwscbguossfmn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFuaHF0bHBrd3NjYmd1b3NzZm1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwOTcwMjEsImV4cCI6MjA4NTY3MzAyMX0.yxFPvTLJnmCD0zxl_ub_ms7xXafcmR5rC6JuSm3Vzik';

// ============================================
// Supabase Client (using fetch, no SDK needed)
// ============================================
const supabase = {
  url: SUPABASE_URL,
  key: SUPABASE_ANON_KEY,

  // Store auth token
  accessToken: null,

  // Helper to make authenticated requests
  async request(endpoint, options = {}) {
    const headers = {
      'apikey': this.key,
      'Content-Type': 'application/json',
      'Prefer': options.prefer || 'return=representation',
      ...options.headers
    };

    // Add auth token if logged in
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    } else {
      headers['Authorization'] = `Bearer ${this.key}`;
    }

    const response = await fetch(`${this.url}${endpoint}`, {
      ...options,
      headers
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || error.error_description || 'Request failed');
    }

    // Handle empty responses
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  },

  // ============================================
  // AUTH METHODS
  // ============================================
  auth: {
    async signIn(email, password) {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error_description || error.msg || 'Login failed');
      }

      const data = await response.json();

      // Store tokens
      supabase.accessToken = data.access_token;
      localStorage.setItem('nubeaux_auth', JSON.stringify({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        user: data.user,
        expiresAt: Date.now() + (data.expires_in * 1000)
      }));

      return data;
    },

    async signOut() {
      supabase.accessToken = null;
      localStorage.removeItem('nubeaux_auth');
    },

    getSession() {
      const stored = localStorage.getItem('nubeaux_auth');
      if (!stored) return null;

      const session = JSON.parse(stored);

      // Check if expired
      if (session.expiresAt < Date.now()) {
        this.signOut();
        return null;
      }

      // Restore token
      supabase.accessToken = session.accessToken;
      return session;
    },

    getUser() {
      const session = this.getSession();
      return session?.user || null;
    }
  },

  // ============================================
  // DATABASE METHODS
  // ============================================

  // Generic query builder
  from(table) {
    return {
      table,
      _filters: [],
      _select: '*',
      _order: null,
      _limit: null,

      select(columns = '*') {
        this._select = columns;
        return this;
      },

      eq(column, value) {
        this._filters.push(`${column}=eq.${encodeURIComponent(value)}`);
        return this;
      },

      in(column, values) {
        this._filters.push(`${column}=in.(${values.map(v => encodeURIComponent(v)).join(',')})`);
        return this;
      },

      order(column, { ascending = true } = {}) {
        this._order = `${column}.${ascending ? 'asc' : 'desc'}`;
        return this;
      },

      limit(count) {
        this._limit = count;
        return this;
      },

      async execute() {
        let endpoint = `/rest/v1/${this.table}?select=${this._select}`;

        if (this._filters.length) {
          endpoint += '&' + this._filters.join('&');
        }
        if (this._order) {
          endpoint += `&order=${this._order}`;
        }
        if (this._limit) {
          endpoint += `&limit=${this._limit}`;
        }

        return supabase.request(endpoint);
      },

      async insert(data) {
        return supabase.request(`/rest/v1/${this.table}`, {
          method: 'POST',
          body: JSON.stringify(data)
        });
      },

      async update(data) {
        let endpoint = `/rest/v1/${this.table}`;
        if (this._filters.length) {
          endpoint += '?' + this._filters.join('&');
        }
        return supabase.request(endpoint, {
          method: 'PATCH',
          body: JSON.stringify(data)
        });
      },

      async delete() {
        let endpoint = `/rest/v1/${this.table}`;
        if (this._filters.length) {
          endpoint += '?' + this._filters.join('&');
        }
        return supabase.request(endpoint, {
          method: 'DELETE'
        });
      }
    };
  },

  // ============================================
  // RPC METHODS (for calling Postgres functions)
  // ============================================
  async rpc(functionName, params = {}) {
    return this.request(`/rest/v1/rpc/${functionName}`, {
      method: 'POST',
      body: JSON.stringify(params)
    });
  }
};

// ============================================
// NUBEAUX-SPECIFIC HELPER FUNCTIONS
// ============================================

const NubeauxDB = {
  // Submit a quote request
  async submitQuoteRequest(data) {
    const payload = {
      itinerary_id: data.itineraryId || null,
      first_name: data.firstName,
      last_name: data.lastName,
      email: data.email,
      phone: data.phone || null,
      start_date: data.startDate || null,
      end_date: data.endDate || null,
      adults: parseInt(data.adults) || 2,
      children: parseInt(data.children) || 0,
      special_requests: data.specialRequests || null
    };

    return supabase.from('quote_requests').insert(payload);
  },

  // Submit a trip inquiry
  async submitTripInquiry(data) {
    const payload = {
      first_name: data.firstName,
      last_name: data.lastName,
      email: data.email,
      phone: data.phone || null,
      destination: data.destination || null,
      travel_dates: data.travelDates || null,
      travelers: data.travelers || null,
      budget: data.budget || null,
      message: data.message || null
    };

    return supabase.from('trip_inquiries').insert(payload);
  },

  // Track a page view
  async trackPageView(itineraryId) {
    // Get or create session ID
    let sessionId = sessionStorage.getItem('nubeaux_session');
    if (!sessionId) {
      sessionId = 'sess_' + Math.random().toString(36).substring(2, 15);
      sessionStorage.setItem('nubeaux_session', sessionId);
    }

    // Check if already tracked this itinerary this session
    const viewedKey = `viewed_${itineraryId}`;
    if (sessionStorage.getItem(viewedKey)) {
      return null; // Already tracked
    }

    // Track the view
    const result = await supabase.from('page_views').insert({
      itinerary_id: itineraryId,
      session_id: sessionId,
      referrer: document.referrer || null,
      user_agent: navigator.userAgent
    });

    // Mark as viewed for this session
    sessionStorage.setItem(viewedKey, 'true');

    return result;
  },

  // Get creator stats
  async getCreatorStats(creatorId) {
    // Get creator's itineraries
    const itineraries = await supabase.from('itineraries')
      .select('id,title,destination,duration,price_from,hero_image,status')
      .eq('creator_id', creatorId)
      .execute();

    if (!itineraries || itineraries.length === 0) {
      return {
        totalViews: 0,
        totalQuotes: 0,
        publishedCount: 0,
        draftCount: 0,
        itineraries: []
      };
    }

    const itineraryIds = itineraries.map(i => i.id);

    // Get view counts
    const viewCounts = await supabase.rpc('get_view_counts', {
      itinerary_ids: itineraryIds
    });

    // Get quote counts
    const quoteCounts = await supabase.rpc('get_quote_counts', {
      itinerary_ids: itineraryIds
    });

    // Build stats
    let totalViews = 0;
    let totalQuotes = 0;
    let publishedCount = 0;
    let draftCount = 0;

    const itineraryStats = itineraries.map(itin => {
      const views = viewCounts?.find(v => v.itinerary_id === itin.id)?.count || 0;
      const quotes = quoteCounts?.find(q => q.itinerary_id === itin.id)?.count || 0;

      totalViews += views;
      totalQuotes += quotes;

      if (itin.status === 'published') publishedCount++;
      else draftCount++;

      return {
        ...itin,
        views,
        quoteRequests: quotes
      };
    });

    return {
      totalViews,
      totalQuotes,
      publishedCount,
      draftCount,
      itineraries: itineraryStats
    };
  },

  // Get creator by email (for login)
  async getCreatorByEmail(email) {
    const results = await supabase.from('creators')
      .select('*')
      .eq('email', email)
      .limit(1)
      .execute();

    return results?.[0] || null;
  },

  // Get creator by ID
  async getCreatorById(creatorId) {
    const results = await supabase.from('creators')
      .select('*')
      .eq('id', creatorId)
      .limit(1)
      .execute();

    return results?.[0] || null;
  },

  // Get creator sync status
  async getCreatorSyncStatus(creatorId) {
    const creator = await this.getCreatorById(creatorId);
    if (!creator) return null;

    return {
      sync_status: creator.sync_status || 'pending',
      last_synced_at: creator.last_synced_at,
      posts_run_id: creator.posts_run_id,
      highlights_run_id: creator.highlights_run_id,
      instagram: creator.instagram
    };
  },

  // Trigger background sync for a creator
  async triggerBackgroundSync(creatorId, instagramUsername) {
    try {
      const response = await fetch('/.netlify/functions/trigger-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creator_id: creatorId,
          instagram_username: instagramUsername
        })
      });

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error triggering background sync:', error);
      return { success: false, error: error.message };
    }
  }
};

// ============================================
// INITIALIZATION
// ============================================

// Check for config
const isConfigured = SUPABASE_URL !== 'YOUR_SUPABASE_URL' && SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY';

if (!isConfigured) {
  console.warn(
    '%c⚠️ NUBEAUX Supabase not configured',
    'color: #c2703e; font-weight: bold;',
    '\n\nTo enable tracking, update SUPABASE_URL and SUPABASE_ANON_KEY in /js/supabase.js',
    '\nSee /supabase/schema.sql for database setup.'
  );
}

// Restore auth session on load
supabase.auth.getSession();

// Export
window.supabase = supabase;
window.NubeauxDB = NubeauxDB;
window.SUPABASE_CONFIGURED = isConfigured;
