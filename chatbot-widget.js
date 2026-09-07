/* ============================================================
   TRIGDA — Floating AI Chat Widget (site-wide)
   Uses Google Gemini directly from the browser.
   NOTE: The API key below is client-side and visible in page
   source. Restrict it to your domain in Google Cloud Console
   (Credentials -> API key -> Application restrictions ->
   HTTP referrers) so it can't be scraped and reused elsewhere.
   ============================================================ */

const GEMINI_KEY = 'AIzaSyAIuj5fod_xs25szgWxho2UzAG3elLBhKY';
const MSG_LIMIT = 10;
const COOLDOWN_HOURS = 12;

function getMsgCount() {
  const saved = JSON.parse(localStorage.getItem('trigda_chat') || '{}');
  const now = Date.now();
  const elapsed = (now - (saved.timestamp || 0)) / (1000 * 60 * 60);
  if (elapsed >= COOLDOWN_HOURS) {
    localStorage.setItem('trigda_chat', JSON.stringify({ count: 0, timestamp: now }));
    return 0;
  }
  return saved.count || 0;
}

function saveMsgCount(count) {
  const saved = JSON.parse(localStorage.getItem('trigda_chat') || '{}');
  const timestamp = saved.timestamp || Date.now();
  localStorage.setItem('trigda_chat', JSON.stringify({ count, timestamp }));
}

function getTimeLeft() {
  const saved = JSON.parse(localStorage.getItem('trigda_chat') || '{}');
  const now = Date.now();
  const elapsed = (now - (saved.timestamp || 0)) / (1000 * 60 * 60);
  const left = COOLDOWN_HOURS - elapsed;
  const hrs = Math.floor(left);
  const mins = Math.floor((left - hrs) * 60);
  return hrs + 'h ' + mins + 'm';
}

let msgCount = 0;

const SYSTEM_PROMPT = `You are TRIGDA's intelligent AI assistant — like ChatGPT but specialized for TRIGDA. You have two roles: 1) Answer ANY general question (science, tech, business, life advice, coding, etc.) like a smart AI assistant would. 2) Have deep knowledge about TRIGDA to help potential customers. Always be helpful, friendly, and give complete answers. Here is all information about TRIGDA:

COMPANY: TRIGDA - a technology partner that builds websites, AI chatbot agents, lead generation, and automation systems for growing businesses.
WEBSITE: trigda.online

PRICING: Not published publicly. Every project is scoped individually — direct people to book a free appointment for an exact quote.

SERVICES:
- Web Development
- AI Chatbot Agent (24/7 FAQs, qualification, booking)
- Lead Generation (targeted B2B/B2C prospecting)
- AI Automation (workflow, follow-ups, reporting)
- 200+ integrations (HubSpot, Salesforce, Slack, Zapier etc)

HOW IT WORKS:
1. Understand your goals and requirements
2. Plan a scoped approach, agreed before building
3. Build, test, then launch and support

FREE APPOINTMENT: 30-minute call, no obligation, no cost - book at the free-demo page

CONTACT: hello@trigda.com

Rules:
- Answer every question directly with real information
- Never give specific dollar prices or numbers — pricing is scoped per project. If asked about cost, explain that pricing depends on scope and invite them to book a free appointment for an exact quote
- Be friendly and conversational
- If asked company name: TRIGDA`;

let conversationHistory = [];

function appendMessage(role, text) {
  const container = document.getElementById('chatMessages');
  if (!container) return;
  const div = document.createElement('div');
  div.className = 'chat-msg';
  if (role === 'user') {
    div.style.flexDirection = 'row-reverse';
    div.innerHTML = `<div class="chat-avatar user">U</div><div class="chat-bubble" style="border-radius:var(--r-md) 0 var(--r-md) var(--r-md);background:rgba(109,40,217,0.2);color:var(--text-primary);max-width:80%;">${text}</div>`;
  } else {
    div.innerHTML = `<div class="chat-avatar ai">AI</div><div class="chat-bubble ai-bubble" style="max-width:85%;">${text}</div>`;
  }
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

async function sendMessage() {
  msgCount = getMsgCount();
  if (msgCount >= MSG_LIMIT) {
    document.getElementById('timeLeftDisplay').textContent = getTimeLeft();
    document.getElementById('chatLimitOverlay').classList.add('show');
    return;
  }

  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';

  msgCount++;
  saveMsgCount(msgCount);
  document.getElementById('msgCount').textContent = msgCount;
  if (msgCount >= MSG_LIMIT) {
    document.getElementById('chatInput').placeholder = 'Limit reached! Come back in 12 hours.';
    document.getElementById('chatInput').disabled = true;
    document.getElementById('sendBtn').textContent = 'Book Appointment';
    document.getElementById('sendBtn').onclick = () => window.location.href = 'free-demo.html';
  }

  appendMessage('user', msg);
  conversationHistory.push({ role: 'user', parts: [{ text: msg }] });

  document.getElementById('typingIndicator').classList.add('show');
  document.getElementById('sendBtn').disabled = true;

  try {
    const messages = [
      { role: 'user', parts: [{ text: SYSTEM_PROMPT + '\n\nUser says: ' + msg }] },
      ...conversationHistory.slice(0, -1),
      { role: 'user', parts: [{ text: msg }] }
    ];

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: messages,
        generationConfig: { temperature: 0.8, maxOutputTokens: 400, topP: 0.95 },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
        ]
      })
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error?.message || 'API Error');
    }

    const data = await res.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!reply) throw new Error('No response');

    conversationHistory.push({ role: 'model', parts: [{ text: reply }] });
    if (conversationHistory.length > 20) conversationHistory = conversationHistory.slice(-16);

    document.getElementById('typingIndicator').classList.remove('show');
    appendMessage('ai', reply);

    if (msgCount >= MSG_LIMIT) {
      setTimeout(() => {
        document.getElementById('timeLeftDisplay').textContent = getTimeLeft();
        document.getElementById('chatLimitOverlay').classList.add('show');
      }, 1500);
    }
  } catch (err) {
    console.error('Gemini error:', err.message);
    document.getElementById('typingIndicator').classList.remove('show');
    const q = msg.toLowerCase();
    let reply = 'TRIGDA builds websites, AI chatbot agents, lead generation, and automation for growing businesses. Ask me anything, or book a free appointment!';
    if (q.includes('price') || q.includes('cost') || q.includes('much') || q.includes('plan'))
      reply = "Pricing depends on project scope, so it isn't published here. Book a free appointment and you'll get a clear quote before anything is agreed.";
    else if (q.includes('company') || q.includes('name') || q.includes('who') || q.includes('what is'))
      reply = 'TRIGDA is a technology partner that builds websites, AI chatbot agents, lead generation, and automation systems for growing businesses.';
    else if (q.includes('feature') || q.includes('what do') || q.includes('service'))
      reply = 'TRIGDA services:\n• Web Development\n• AI Chatbot Agent (24/7 FAQs & booking)\n• Lead Generation\n• AI Automation\n• 200+ tool integrations';
    else if (q.includes('demo') || q.includes('trial') || q.includes('free') || q.includes('appointment') || q.includes('book'))
      reply = 'You can book a free 30-minute appointment with our team — no obligation, no cost.';
    else if (q.includes('email') || q.includes('contact'))
      reply = 'Contact us at hello@trigda.com or book a free appointment on our website. We reply within 4 hours!';
    else if (q.includes('hi') || q.includes('hello') || q.includes('hey'))
      reply = 'Hey! 👋 Welcome to TRIGDA! Ask me anything about our services, process, or booking an appointment.';
    appendMessage('ai', reply);

    if (msgCount >= MSG_LIMIT) {
      setTimeout(() => {
        document.getElementById('timeLeftDisplay').textContent = getTimeLeft();
        document.getElementById('chatLimitOverlay').classList.add('show');
      }, 1500);
    }
  }

  document.getElementById('sendBtn').disabled = false;
}

/* ---- Floating launcher open/close ---- */
function toggleChatWidget() {
  const panel = document.getElementById('chatWidgetPanel');
  const launcher = document.getElementById('chatWidgetLauncher');
  const isOpen = panel.classList.toggle('open');
  launcher.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  launcher.classList.toggle('is-active', isOpen);
}

document.addEventListener('DOMContentLoaded', () => {
  const count = getMsgCount();
  msgCount = count;
  const countEl = document.getElementById('msgCount');
  if (countEl) countEl.textContent = count;
  if (count >= MSG_LIMIT) {
    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    if (input) { input.placeholder = 'Limit reached! Come back in 12 hours.'; input.disabled = true; }
    if (sendBtn) { sendBtn.textContent = 'Book Appointment'; sendBtn.onclick = () => window.location.href = 'free-demo.html'; }
  }

  const launcher = document.getElementById('chatWidgetLauncher');
  if (launcher) launcher.addEventListener('click', toggleChatWidget);
  const closeBtn = document.getElementById('chatWidgetClose');
  if (closeBtn) closeBtn.addEventListener('click', toggleChatWidget);
});
