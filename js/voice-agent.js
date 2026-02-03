/**
 * NUBEAUX Travel - Voice Agent Widget
 * Floating voice AI concierge powered by Retell AI
 */

// IMMEDIATELY set up polyfills before anything else runs
(function setupPolyfills() {
  // Create EventEmitter polyfill for browser (required by Retell SDK)
  if (typeof window !== 'undefined' && !window._retellPolyfillsReady) {
    class EventEmitter {
      constructor() {
        this._events = {};
        this._maxListeners = 10;
      }
      on(event, listener) {
        if (!this._events[event]) this._events[event] = [];
        this._events[event].push(listener);
        return this;
      }
      once(event, listener) {
        const onceWrapper = (...args) => {
          this.off(event, onceWrapper);
          listener.apply(this, args);
        };
        return this.on(event, onceWrapper);
      }
      off(event, listener) {
        if (!this._events[event]) return this;
        if (listener) {
          this._events[event] = this._events[event].filter(l => l !== listener);
        } else {
          delete this._events[event];
        }
        return this;
      }
      emit(event, ...args) {
        if (!this._events[event]) return false;
        this._events[event].slice().forEach(listener => listener.apply(this, args));
        return true;
      }
      removeListener(event, listener) { return this.off(event, listener); }
      addListener(event, listener) { return this.on(event, listener); }
      removeAllListeners(event) {
        if (event) delete this._events[event];
        else this._events = {};
        return this;
      }
      setMaxListeners(n) { this._maxListeners = n; return this; }
      listeners(event) { return this._events[event] ? [...this._events[event]] : []; }
      listenerCount(event) { return this._events[event] ? this._events[event].length : 0; }
    }

    // Provide events module for UMD/CommonJS require
    window.events = { EventEmitter, default: EventEmitter };
    window.EventEmitter = EventEmitter;

    // Create a mock require for CommonJS modules
    const originalRequire = window.require;
    window.require = function(module) {
      if (module === 'events') return window.events;
      if (originalRequire) return originalRequire(module);
      return undefined;
    };

    // Also mock module.exports for CommonJS detection
    if (typeof module === 'undefined') {
      window.module = { exports: {} };
    }

    window._retellPolyfillsReady = true;
    console.log('Retell polyfills initialized');
  }
})();

(function() {
  'use strict';

  // Configuration
  const CREATE_CALL_ENDPOINT = '/.netlify/functions/create-call';
  const SDK_VERSION = '2.0.7';

  // State
  let retellClient = null;
  let isCallActive = false;
  let callId = null;

  // Load Retell SDK from CDN
  function loadRetellSDK() {
    return new Promise((resolve, reject) => {
      if (window.RetellWebClient) {
        resolve();
        return;
      }

      // Load the Retell SDK with cache busting
      const retellScript = document.createElement('script');
      const cacheBust = Date.now();
      retellScript.src = `https://cdn.jsdelivr.net/npm/retell-client-js-sdk@${SDK_VERSION}/dist/index.umd.js?_=${cacheBust}`;

      retellScript.onload = () => {
        setTimeout(() => {
          // Debug: log the SDK structure
          if (window.retellClientJsSdk) {
            console.log('retellClientJsSdk keys:', Object.keys(window.retellClientJsSdk));
            console.log('retellClientJsSdk:', window.retellClientJsSdk);
          }

          // Check various possible export locations
          const sdk = window.retellClientJsSdk;
          const client = window.RetellWebClient ||
                        window.retellWebClient ||
                        (sdk && sdk.RetellWebClient) ||
                        (sdk && sdk.default && sdk.default.RetellWebClient) ||
                        (sdk && sdk.default) ||
                        (sdk && typeof sdk === 'function' ? sdk : null) ||
                        (window.module && window.module.exports && window.module.exports.RetellWebClient) ||
                        (window.module && window.module.exports && window.module.exports.default);

          if (client) {
            window.RetellWebClient = client;
            console.log('Retell SDK loaded successfully, client:', client);
            resolve();
          } else {
            console.error('SDK loaded but RetellWebClient not found');
            console.error('Available retell-related globals:', Object.keys(window).filter(k => k.toLowerCase().includes('retell')));
            console.error('module.exports:', window.module ? window.module.exports : 'undefined');
            reject(new Error('RetellWebClient not found after loading SDK'));
          }
        }, 300);
      };

      retellScript.onerror = (e) => {
        console.error('Failed to load Retell SDK script:', e);
        reject(new Error('Failed to load Retell SDK'));
      };

      document.head.appendChild(retellScript);
    });
  }

  // Create the widget UI
  function createWidgetUI() {
    // Check if already exists
    if (document.getElementById('nubeaux-voice-widget')) return;

    // Inject CSS
    const style = document.createElement('style');
    style.textContent = `
      #nubeaux-voice-widget {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 9999;
        font-family: 'Inter', -apple-system, sans-serif;
      }

      .voice-widget-btn {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: linear-gradient(135deg, #c2703e 0%, #a85d32 100%);
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 20px rgba(194, 112, 62, 0.4);
        transition: transform 0.2s, box-shadow 0.2s;
      }

      .voice-widget-btn:hover {
        transform: scale(1.05);
        box-shadow: 0 6px 25px rgba(194, 112, 62, 0.5);
      }

      .voice-widget-btn:active {
        transform: scale(0.98);
      }

      .voice-widget-btn svg {
        width: 28px;
        height: 28px;
        color: white;
      }

      .voice-widget-btn.active {
        background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
        box-shadow: 0 4px 20px rgba(34, 197, 94, 0.4);
        animation: pulse 2s infinite;
      }

      @keyframes pulse {
        0%, 100% { box-shadow: 0 4px 20px rgba(34, 197, 94, 0.4); }
        50% { box-shadow: 0 4px 30px rgba(34, 197, 94, 0.6); }
      }

      .voice-widget-panel {
        position: absolute;
        bottom: 70px;
        right: 0;
        width: 300px;
        background: white;
        border-radius: 16px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
        overflow: hidden;
        opacity: 0;
        transform: translateY(10px) scale(0.95);
        pointer-events: none;
        transition: opacity 0.2s, transform 0.2s;
      }

      .voice-widget-panel.visible {
        opacity: 1;
        transform: translateY(0) scale(1);
        pointer-events: auto;
      }

      .voice-panel-header {
        background: linear-gradient(135deg, #c2703e 0%, #a85d32 100%);
        color: white;
        padding: 20px;
        text-align: center;
      }

      .voice-panel-header h3 {
        margin: 0 0 4px 0;
        font-size: 1.125rem;
        font-weight: 500;
      }

      .voice-panel-header p {
        margin: 0;
        font-size: 0.8125rem;
        opacity: 0.9;
      }

      .voice-panel-body {
        padding: 20px;
      }

      .voice-status {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        margin-bottom: 16px;
      }

      .voice-status-indicator {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #d1d5db;
      }

      .voice-status-indicator.listening {
        background: #22c55e;
        animation: blink 1s infinite;
      }

      .voice-status-indicator.speaking {
        background: #3b82f6;
        animation: blink 0.5s infinite;
      }

      @keyframes blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }

      .voice-status-text {
        font-size: 0.9375rem;
        color: #374151;
      }

      .voice-visualizer {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 3px;
        height: 40px;
        margin-bottom: 16px;
      }

      .voice-bar {
        width: 4px;
        height: 8px;
        background: #c2703e;
        border-radius: 2px;
        transition: height 0.1s;
      }

      .voice-bar.active {
        animation: wave 0.5s ease-in-out infinite;
      }

      .voice-bar:nth-child(1) { animation-delay: 0s; }
      .voice-bar:nth-child(2) { animation-delay: 0.1s; }
      .voice-bar:nth-child(3) { animation-delay: 0.2s; }
      .voice-bar:nth-child(4) { animation-delay: 0.3s; }
      .voice-bar:nth-child(5) { animation-delay: 0.4s; }
      .voice-bar:nth-child(6) { animation-delay: 0.3s; }
      .voice-bar:nth-child(7) { animation-delay: 0.2s; }
      .voice-bar:nth-child(8) { animation-delay: 0.1s; }

      @keyframes wave {
        0%, 100% { height: 8px; }
        50% { height: 32px; }
      }

      .voice-action-btn {
        width: 100%;
        padding: 14px 24px;
        border: none;
        border-radius: 8px;
        font-size: 1rem;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.2s;
      }

      .voice-action-btn.start {
        background: #c2703e;
        color: white;
      }

      .voice-action-btn.start:hover {
        background: #a85d32;
      }

      .voice-action-btn.end {
        background: #ef4444;
        color: white;
      }

      .voice-action-btn.end:hover {
        background: #dc2626;
      }

      .voice-action-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .voice-panel-footer {
        padding: 12px 20px;
        background: #f9fafb;
        text-align: center;
        font-size: 0.75rem;
        color: #6b7280;
      }

      .voice-tooltip {
        position: absolute;
        bottom: 70px;
        right: 0;
        background: #1f2937;
        color: white;
        padding: 8px 12px;
        border-radius: 8px;
        font-size: 0.8125rem;
        white-space: nowrap;
        opacity: 0;
        transform: translateY(5px);
        transition: opacity 0.2s, transform 0.2s;
        pointer-events: none;
      }

      .voice-tooltip::after {
        content: '';
        position: absolute;
        bottom: -6px;
        right: 20px;
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-top: 6px solid #1f2937;
      }

      #nubeaux-voice-widget:hover .voice-tooltip:not(.hidden) {
        opacity: 1;
        transform: translateY(0);
      }

      @media (max-width: 480px) {
        #nubeaux-voice-widget {
          bottom: 16px;
          right: 16px;
        }

        .voice-widget-panel {
          width: calc(100vw - 32px);
          right: -8px;
        }
      }
    `;
    document.head.appendChild(style);

    // Create widget HTML
    const widget = document.createElement('div');
    widget.id = 'nubeaux-voice-widget';
    widget.innerHTML = `
      <div class="voice-tooltip">Talk to our AI Travel Concierge</div>

      <div class="voice-widget-panel" id="voicePanel">
        <div class="voice-panel-header">
          <h3>NUBEAUX Travel Concierge</h3>
          <p>Ask me about your dream trip</p>
        </div>
        <div class="voice-panel-body">
          <div class="voice-status">
            <div class="voice-status-indicator" id="statusIndicator"></div>
            <span class="voice-status-text" id="statusText">Click to start</span>
          </div>
          <div class="voice-visualizer" id="visualizer">
            <div class="voice-bar"></div>
            <div class="voice-bar"></div>
            <div class="voice-bar"></div>
            <div class="voice-bar"></div>
            <div class="voice-bar"></div>
            <div class="voice-bar"></div>
            <div class="voice-bar"></div>
            <div class="voice-bar"></div>
          </div>
          <button class="voice-action-btn start" id="actionBtn">Start Conversation</button>
        </div>
        <div class="voice-panel-footer">
          Powered by AI for your convenience
        </div>
      </div>

      <button class="voice-widget-btn" id="widgetBtn" aria-label="Talk to AI Concierge">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
      </button>
    `;

    document.body.appendChild(widget);

    // Set up event listeners
    setupEventListeners();
  }

  // Event listeners
  function setupEventListeners() {
    const widgetBtn = document.getElementById('widgetBtn');
    const panel = document.getElementById('voicePanel');
    const actionBtn = document.getElementById('actionBtn');
    const tooltip = document.querySelector('.voice-tooltip');

    // Toggle panel
    widgetBtn.addEventListener('click', () => {
      const isVisible = panel.classList.contains('visible');

      if (isVisible) {
        panel.classList.remove('visible');
        tooltip.classList.remove('hidden');
      } else {
        panel.classList.add('visible');
        tooltip.classList.add('hidden');
      }
    });

    // Close panel when clicking outside
    document.addEventListener('click', (e) => {
      const widget = document.getElementById('nubeaux-voice-widget');
      if (!widget.contains(e.target) && panel.classList.contains('visible') && !isCallActive) {
        panel.classList.remove('visible');
        tooltip.classList.remove('hidden');
      }
    });

    // Action button
    actionBtn.addEventListener('click', () => {
      if (isCallActive) {
        endCall();
      } else {
        startCall();
      }
    });
  }

  // Start a call
  async function startCall() {
    const actionBtn = document.getElementById('actionBtn');
    const statusText = document.getElementById('statusText');
    const statusIndicator = document.getElementById('statusIndicator');
    const widgetBtn = document.getElementById('widgetBtn');
    const visualizer = document.getElementById('visualizer');

    try {
      // Update UI
      actionBtn.disabled = true;
      actionBtn.textContent = 'Connecting...';
      statusText.textContent = 'Connecting...';

      // Load SDK if needed
      await loadRetellSDK();

      // Get access token from our backend
      const response = await fetch(CREATE_CALL_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metadata: {
            page_url: window.location.href,
            user_agent: navigator.userAgent
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create call');
      }

      const { access_token, call_id } = await response.json();
      callId = call_id;

      // Initialize Retell client
      retellClient = new window.RetellWebClient();

      // Set up event listeners
      retellClient.on('call_started', () => {
        console.log('Call started');
        isCallActive = true;
        statusText.textContent = 'Connected - speak now';
        statusIndicator.className = 'voice-status-indicator listening';
        actionBtn.textContent = 'End Conversation';
        actionBtn.className = 'voice-action-btn end';
        actionBtn.disabled = false;
        widgetBtn.classList.add('active');

        // Activate visualizer
        visualizer.querySelectorAll('.voice-bar').forEach(bar => bar.classList.add('active'));
      });

      retellClient.on('call_ended', () => {
        console.log('Call ended');
        resetUI();
      });

      retellClient.on('error', (error) => {
        console.error('Retell error:', error);
        statusText.textContent = 'Error occurred';
        setTimeout(resetUI, 2000);
      });

      retellClient.on('update', (update) => {
        // Update status based on who's speaking
        if (update.turntaking === 'agent_turn') {
          statusText.textContent = 'Agent speaking...';
          statusIndicator.className = 'voice-status-indicator speaking';
        } else {
          statusText.textContent = 'Listening...';
          statusIndicator.className = 'voice-status-indicator listening';
        }
      });

      // Start the call
      await retellClient.startCall({
        accessToken: access_token,
        sampleRate: 24000,
        emitRawAudioSamples: false
      });

    } catch (error) {
      console.error('Error starting call:', error);
      statusText.textContent = 'Failed to connect';
      actionBtn.textContent = 'Try Again';
      actionBtn.disabled = false;
      setTimeout(resetUI, 3000);
    }
  }

  // End the call
  function endCall() {
    if (retellClient) {
      retellClient.stopCall();
    }
    resetUI();
  }

  // Reset UI to initial state
  function resetUI() {
    isCallActive = false;
    callId = null;

    const actionBtn = document.getElementById('actionBtn');
    const statusText = document.getElementById('statusText');
    const statusIndicator = document.getElementById('statusIndicator');
    const widgetBtn = document.getElementById('widgetBtn');
    const visualizer = document.getElementById('visualizer');

    statusText.textContent = 'Click to start';
    statusIndicator.className = 'voice-status-indicator';
    actionBtn.textContent = 'Start Conversation';
    actionBtn.className = 'voice-action-btn start';
    actionBtn.disabled = false;
    widgetBtn.classList.remove('active');

    // Deactivate visualizer
    visualizer.querySelectorAll('.voice-bar').forEach(bar => bar.classList.remove('active'));
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createWidgetUI);
  } else {
    createWidgetUI();
  }

})();
