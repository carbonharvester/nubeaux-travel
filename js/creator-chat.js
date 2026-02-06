/**
 * Creator Chat Agent
 * Text-based chat interface for creator pages
 * Used for "Ask a question" interactions
 */

(function() {
  'use strict';

  // Chat state
  let isOpen = false;
  let messages = [];

  // Create chat UI elements
  function createChatUI() {
    // Chat panel
    const panel = document.createElement('div');
    panel.className = 'creator-chat-panel';
    panel.id = 'creatorChatPanel';
    panel.innerHTML = `
      <div class="chat-header">
        <div class="chat-header-info">
          <div class="chat-avatar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
          <div>
            <span class="chat-title">JUNO Support</span>
            <span class="chat-status">We typically reply within a few hours</span>
          </div>
        </div>
        <button class="chat-close" id="chatClose" aria-label="Close chat">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="chat-messages" id="chatMessages">
        <div class="chat-welcome">
          <p class="chat-welcome-title">Hi there!</p>
          <p class="chat-welcome-text">Have a question about becoming a JUNO creator or need help with your account? We're here to help.</p>
        </div>
      </div>
      <div class="chat-input-area">
        <textarea
          class="chat-input"
          id="chatInput"
          placeholder="Type your message..."
          rows="1"
        ></textarea>
        <button class="chat-send" id="chatSend" aria-label="Send message" disabled>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>
    `;

    // Chat toggle button
    const toggle = document.createElement('button');
    toggle.className = 'creator-chat-toggle';
    toggle.id = 'creatorChatToggle';
    toggle.setAttribute('aria-label', 'Open chat');
    toggle.innerHTML = `
      <svg class="chat-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
      <svg class="close-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `;

    document.body.appendChild(panel);
    document.body.appendChild(toggle);

    return { panel, toggle };
  }

  // Add styles
  function addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .creator-chat-toggle {
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: var(--color-charcoal, #2C2C2C);
        color: white;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        transition: transform 0.2s ease, background 0.2s ease;
        z-index: 9998;
      }

      .creator-chat-toggle:hover {
        transform: scale(1.05);
        background: var(--color-slate, #3D3D3D);
      }

      .creator-chat-toggle .close-icon {
        display: none;
      }

      .creator-chat-toggle.is-open .chat-icon {
        display: none;
      }

      .creator-chat-toggle.is-open .close-icon {
        display: block;
      }

      .creator-chat-panel {
        position: fixed;
        bottom: 96px;
        right: 24px;
        width: 380px;
        max-width: calc(100vw - 48px);
        height: 520px;
        max-height: calc(100vh - 140px);
        background: white;
        border-radius: 16px;
        box-shadow: 0 8px 40px rgba(0, 0, 0, 0.15);
        display: flex;
        flex-direction: column;
        z-index: 9999;
        opacity: 0;
        visibility: hidden;
        transform: translateY(20px) scale(0.95);
        transition: opacity 0.25s ease, transform 0.25s ease, visibility 0.25s;
      }

      .creator-chat-panel.is-open {
        opacity: 1;
        visibility: visible;
        transform: translateY(0) scale(1);
      }

      .chat-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        background: var(--color-charcoal, #2C2C2C);
        color: white;
        border-radius: 16px 16px 0 0;
      }

      .chat-header-info {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .chat-avatar {
        width: 40px;
        height: 40px;
        background: rgba(255, 255, 255, 0.15);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .chat-title {
        display: block;
        font-weight: 500;
        font-size: 0.9375rem;
      }

      .chat-status {
        display: block;
        font-size: 0.75rem;
        opacity: 0.7;
        margin-top: 2px;
      }

      .chat-close {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        padding: 4px;
        opacity: 0.7;
        transition: opacity 0.2s;
      }

      .chat-close:hover {
        opacity: 1;
      }

      .chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .chat-welcome {
        text-align: center;
        padding: 20px;
      }

      .chat-welcome-title {
        font-family: var(--font-serif, 'Playfair Display', serif);
        font-size: 1.25rem;
        margin-bottom: 8px;
        color: var(--color-charcoal, #2C2C2C);
      }

      .chat-welcome-text {
        font-size: 0.875rem;
        color: var(--color-warm-grey, #6B6B6B);
        line-height: 1.6;
      }

      .chat-message {
        display: flex;
        flex-direction: column;
        max-width: 85%;
      }

      .chat-message.user {
        align-self: flex-end;
      }

      .chat-message.agent {
        align-self: flex-start;
      }

      .chat-message-bubble {
        padding: 12px 16px;
        border-radius: 16px;
        font-size: 0.875rem;
        line-height: 1.5;
      }

      .chat-message.user .chat-message-bubble {
        background: var(--color-charcoal, #2C2C2C);
        color: white;
        border-bottom-right-radius: 4px;
      }

      .chat-message.agent .chat-message-bubble {
        background: var(--color-ecru, #F5F3EF);
        color: var(--color-charcoal, #2C2C2C);
        border-bottom-left-radius: 4px;
      }

      .chat-message-time {
        font-size: 0.6875rem;
        color: var(--color-warm-grey, #6B6B6B);
        margin-top: 4px;
        padding: 0 4px;
      }

      .chat-message.user .chat-message-time {
        text-align: right;
      }

      .chat-typing {
        display: flex;
        gap: 4px;
        padding: 12px 16px;
        background: var(--color-ecru, #F5F3EF);
        border-radius: 16px;
        border-bottom-left-radius: 4px;
        width: fit-content;
      }

      .chat-typing span {
        width: 8px;
        height: 8px;
        background: var(--color-warm-grey, #6B6B6B);
        border-radius: 50%;
        animation: typing 1.4s infinite;
      }

      .chat-typing span:nth-child(2) {
        animation-delay: 0.2s;
      }

      .chat-typing span:nth-child(3) {
        animation-delay: 0.4s;
      }

      @keyframes typing {
        0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
        30% { transform: translateY(-4px); opacity: 1; }
      }

      .chat-input-area {
        display: flex;
        align-items: flex-end;
        gap: 8px;
        padding: 16px;
        border-top: 1px solid var(--color-ecru, #F5F3EF);
      }

      .chat-input {
        flex: 1;
        border: 1px solid var(--color-ecru, #E5E5E5);
        border-radius: 20px;
        padding: 10px 16px;
        font-size: 0.875rem;
        font-family: inherit;
        resize: none;
        max-height: 120px;
        line-height: 1.4;
        transition: border-color 0.2s;
      }

      .chat-input:focus {
        outline: none;
        border-color: var(--color-charcoal, #2C2C2C);
      }

      .chat-input::placeholder {
        color: var(--color-warm-grey, #999);
      }

      .chat-send {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: var(--color-charcoal, #2C2C2C);
        color: white;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: opacity 0.2s, transform 0.2s;
        flex-shrink: 0;
      }

      .chat-send:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      .chat-send:not(:disabled):hover {
        transform: scale(1.05);
      }

      @media (max-width: 480px) {
        .creator-chat-panel {
          bottom: 0;
          right: 0;
          width: 100%;
          max-width: 100%;
          height: 100%;
          max-height: 100%;
          border-radius: 0;
        }

        .chat-header {
          border-radius: 0;
        }

        .creator-chat-toggle.is-open {
          display: none;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Format time
  function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // Add message to chat
  function addMessage(text, isUser = false) {
    const messagesEl = document.getElementById('chatMessages');
    const message = {
      text,
      isUser,
      time: new Date()
    };
    messages.push(message);

    const messageEl = document.createElement('div');
    messageEl.className = `chat-message ${isUser ? 'user' : 'agent'}`;
    messageEl.innerHTML = `
      <div class="chat-message-bubble">${escapeHtml(text)}</div>
      <span class="chat-message-time">${formatTime(message.time)}</span>
    `;
    messagesEl.appendChild(messageEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // Show typing indicator
  function showTyping() {
    const messagesEl = document.getElementById('chatMessages');
    const typingEl = document.createElement('div');
    typingEl.className = 'chat-typing';
    typingEl.id = 'chatTyping';
    typingEl.innerHTML = '<span></span><span></span><span></span>';
    messagesEl.appendChild(typingEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // Hide typing indicator
  function hideTyping() {
    const typingEl = document.getElementById('chatTyping');
    if (typingEl) typingEl.remove();
  }

  // Escape HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Auto-resize textarea
  function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }

  // Simulate agent response (placeholder - would connect to real backend)
  function getAgentResponse(userMessage) {
    const responses = [
      "Thanks for reaching out! I'd be happy to help with that. Could you tell me a bit more about what you're looking for?",
      "Great question! Our team will get back to you shortly with more details. In the meantime, feel free to explore our creator resources.",
      "I appreciate you asking! Let me connect you with someone who can provide more specific information about that.",
      "Thanks for your interest in JUNO! Someone from our creator partnerships team will follow up with you soon.",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  // Send message
  function sendMessage() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();

    if (!text) return;

    // Add user message
    addMessage(text, true);
    input.value = '';
    autoResize(input);
    document.getElementById('chatSend').disabled = true;

    // Simulate agent response
    showTyping();
    setTimeout(() => {
      hideTyping();
      addMessage(getAgentResponse(text), false);
    }, 1500 + Math.random() * 1000);
  }

  // Toggle chat
  function toggleChat() {
    isOpen = !isOpen;
    const panel = document.getElementById('creatorChatPanel');
    const toggle = document.getElementById('creatorChatToggle');

    if (isOpen) {
      panel.classList.add('is-open');
      toggle.classList.add('is-open');
      document.getElementById('chatInput').focus();
    } else {
      panel.classList.remove('is-open');
      toggle.classList.remove('is-open');
    }
  }

  // Open chat (can be called externally)
  function openChat() {
    if (!isOpen) {
      toggleChat();
    }
  }

  // Initialize
  function init() {
    addStyles();
    createChatUI();

    // Event listeners
    document.getElementById('creatorChatToggle').addEventListener('click', toggleChat);
    document.getElementById('chatClose').addEventListener('click', toggleChat);

    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('chatSend');

    input.addEventListener('input', function() {
      autoResize(this);
      sendBtn.disabled = !this.value.trim();
    });

    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    sendBtn.addEventListener('click', sendMessage);

    // Close on escape
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && isOpen) {
        toggleChat();
      }
    });

    // Handle "Ask a question" buttons
    document.querySelectorAll('.open-chat, [data-action="open-chat"]').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        openChat();
      });
    });
  }

  // Expose openChat globally
  window.openCreatorChat = openChat;

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
