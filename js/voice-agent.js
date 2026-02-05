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

  // Load Retell SDK using dynamic ESM import
  async function loadRetellSDK() {
    if (window.RetellWebClient) {
      return;
    }

    try {
      // Use dynamic import for ESM module
      const module = await import(`https://cdn.jsdelivr.net/npm/retell-client-js-sdk@${SDK_VERSION}/+esm`);
      console.log('ESM module loaded:', module);
      console.log('Module keys:', Object.keys(module));

      // Find RetellWebClient in the module
      const client = module.RetellWebClient ||
                    module.default?.RetellWebClient ||
                    module.default;

      if (client) {
        window.RetellWebClient = client;
        console.log('Retell SDK loaded successfully via ESM');
      } else {
        throw new Error('RetellWebClient not found in ESM module');
      }
    } catch (error) {
      console.error('Failed to load Retell SDK:', error);
      throw error;
    }
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
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: #1a1a1a;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.25);
        transition: transform 0.2s, box-shadow 0.2s, background 0.2s;
      }

      .voice-widget-btn:hover {
        transform: scale(1.05);
        background: #2a2a2a;
        box-shadow: 0 6px 30px rgba(0, 0, 0, 0.3);
      }

      .voice-widget-btn:active {
        transform: scale(0.98);
      }

      .voice-widget-btn svg {
        width: 24px;
        height: 24px;
        color: #c2703e;
      }

      .voice-widget-btn.active {
        background: #c2703e;
        box-shadow: 0 4px 24px rgba(194, 112, 62, 0.4);
      }

      .voice-widget-btn.active svg {
        color: white;
        animation: pulse-icon 1.5s ease-in-out infinite;
      }

      @keyframes pulse-icon {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.6; }
      }

      .voice-widget-panel {
        position: absolute;
        bottom: 66px;
        right: 0;
        width: 280px;
        background: #1a1a1a;
        border-radius: 12px;
        box-shadow: 0 16px 48px rgba(0, 0, 0, 0.3);
        overflow: hidden;
        opacity: 0;
        transform: translateY(8px) scale(0.96);
        pointer-events: none;
        transition: opacity 0.25s ease, transform 0.25s ease;
      }

      .voice-widget-panel.visible {
        opacity: 1;
        transform: translateY(0) scale(1);
        pointer-events: auto;
      }

      .voice-panel-header {
        padding: 20px 20px 16px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
      }

      .voice-panel-header h3 {
        margin: 0;
        font-size: 0.6875rem;
        font-weight: 500;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #c2703e;
      }

      .voice-panel-header p {
        margin: 6px 0 0;
        font-family: 'Playfair Display', Georgia, serif;
        font-size: 1.125rem;
        font-weight: 400;
        color: #ffffff;
      }

      .voice-panel-body {
        padding: 20px;
      }

      .voice-status {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 20px;
      }

      .voice-status-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: rgba(255,255,255,0.3);
        flex-shrink: 0;
      }

      .voice-status-indicator.listening {
        background: #c2703e;
        box-shadow: 0 0 8px rgba(194, 112, 62, 0.6);
        animation: glow 1.5s ease-in-out infinite;
      }

      .voice-status-indicator.speaking {
        background: #ffffff;
        box-shadow: 0 0 8px rgba(255, 255, 255, 0.4);
        animation: glow 0.8s ease-in-out infinite;
      }

      @keyframes glow {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }

      .voice-status-text {
        font-size: 0.8125rem;
        color: rgba(255,255,255,0.7);
      }

      .voice-visualizer {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        height: 48px;
        margin-bottom: 20px;
        background: rgba(255,255,255,0.03);
        border-radius: 8px;
      }

      .voice-bar {
        width: 3px;
        height: 6px;
        background: rgba(194, 112, 62, 0.4);
        border-radius: 2px;
        transition: height 0.1s ease;
      }

      .voice-bar.active {
        background: #c2703e;
        animation: wave 0.6s ease-in-out infinite;
      }

      .voice-bar:nth-child(1) { animation-delay: 0s; }
      .voice-bar:nth-child(2) { animation-delay: 0.08s; }
      .voice-bar:nth-child(3) { animation-delay: 0.16s; }
      .voice-bar:nth-child(4) { animation-delay: 0.24s; }
      .voice-bar:nth-child(5) { animation-delay: 0.32s; }
      .voice-bar:nth-child(6) { animation-delay: 0.24s; }
      .voice-bar:nth-child(7) { animation-delay: 0.16s; }
      .voice-bar:nth-child(8) { animation-delay: 0.08s; }

      @keyframes wave {
        0%, 100% { height: 6px; }
        50% { height: 28px; }
      }

      .voice-action-btn {
        width: 100%;
        padding: 14px 20px;
        border: none;
        border-radius: 6px;
        font-size: 0.875rem;
        font-weight: 500;
        letter-spacing: 0.02em;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .voice-action-btn.start {
        background: #c2703e;
        color: white;
      }

      .voice-action-btn.start:hover {
        background: #d4804a;
      }

      .voice-action-btn.end {
        background: rgba(255,255,255,0.1);
        color: white;
        border: 1px solid rgba(255,255,255,0.2);
      }

      .voice-action-btn.end:hover {
        background: rgba(255,255,255,0.15);
        border-color: rgba(255,255,255,0.3);
      }

      .voice-action-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .voice-tooltip {
        position: absolute;
        bottom: 66px;
        right: 0;
        background: #1a1a1a;
        color: rgba(255,255,255,0.9);
        padding: 10px 14px;
        border-radius: 8px;
        font-size: 0.8125rem;
        white-space: nowrap;
        opacity: 0;
        transform: translateY(4px);
        transition: opacity 0.2s ease, transform 0.2s ease;
        pointer-events: none;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
      }

      .voice-tooltip::after {
        content: '';
        position: absolute;
        bottom: -5px;
        right: 18px;
        width: 0;
        height: 0;
        border-left: 5px solid transparent;
        border-right: 5px solid transparent;
        border-top: 5px solid #1a1a1a;
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
      <div class="voice-tooltip">Speak with our concierge</div>

      <div class="voice-widget-panel" id="voicePanel">
        <div class="voice-panel-header">
          <h3>Travel Concierge</h3>
          <p>How can I help you?</p>
        </div>
        <div class="voice-panel-body">
          <div class="voice-status">
            <div class="voice-status-indicator" id="statusIndicator"></div>
            <span class="voice-status-text" id="statusText">Ready to listen</span>
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
      </div>

      <button class="voice-widget-btn" id="widgetBtn" aria-label="Speak with concierge">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
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

    statusText.textContent = 'Ready to listen';
    statusIndicator.className = 'voice-status-indicator';
    actionBtn.textContent = 'Start Conversation';
    actionBtn.className = 'voice-action-btn start';
    actionBtn.disabled = false;
    widgetBtn.classList.remove('active');

    // Deactivate visualizer
    visualizer.querySelectorAll('.voice-bar').forEach(bar => bar.classList.remove('active'));
  }

  // Global API to open voice concierge from external buttons
  window.openVoiceConcierge = function(autoStart = false) {
    const panel = document.getElementById('voicePanel');
    const tooltip = document.querySelector('.voice-tooltip');

    if (panel) {
      panel.classList.add('visible');
      if (tooltip) tooltip.classList.add('hidden');

      // Optionally auto-start the call
      if (autoStart && !isCallActive) {
        setTimeout(() => startCall(), 300);
      }
    }
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createWidgetUI);
  } else {
    createWidgetUI();
  }

})();
