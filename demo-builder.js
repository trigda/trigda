/* ============================================================
   TRIGDA — Live Demo Agent Builder
   Lets a visitor type in their business, gets 2-3 AI-generated
   clarifying questions, then chats with a custom mini AI agent
   built from their answers. Uses the same Gemini key as the
   main chat widget (loaded earlier via chatbot-widget.js).
   ============================================================ */

let demoBizType = '';
let demoQAPairs = [];
let demoSystemPrompt = '';
let demoConversation = [];

function fallbackDemoQuestions(biz) {
  return [
    `What are 2-3 things customers usually ask about at your ${biz}?`,
    `What makes your ${biz} different from others nearby?`
  ];
}

async function startDemoBuilder() {
  const bizInput = document.getElementById('demoBizType');
  const biz = bizInput.value.trim();
  const errEl = document.getElementById('demoBuilderError');
  errEl.style.display = 'none';

  if (!biz) {
    errEl.textContent = '⚠️ Please tell us what your business is.';
    errEl.style.display = 'block';
    return;
  }
  demoBizType = biz;

  const btn = document.getElementById('demoStep1Btn');
  btn.textContent = 'Thinking...';
  btn.disabled = true;

  try {
    const prompt = `A user runs this business: "${biz}". Generate exactly 2 or 3 short, specific clarifying questions to gather the minimum info needed to build a simple FAQ demo chatbot for this exact business (for example, for a restaurant ask about signature dishes and hours; for a salon ask about services offered and pricing style; for a clinic ask about services and appointment hours). Return ONLY a raw JSON array of question strings, nothing else, no markdown formatting, no explanation. Example: ["Question 1?", "Question 2?"]`;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.6, maxOutputTokens: 200 }
      })
    });
    if (!res.ok) throw new Error('API error: ' + res.status);

    const data = await res.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    text = text.replace(/```json|```/g, '').trim();
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start !== -1 && end !== -1) text = text.slice(start, end + 1);

    let questions = JSON.parse(text);
    if (!Array.isArray(questions) || questions.length === 0) throw new Error('Bad format');
    renderDemoQuestions(questions.slice(0, 3));
  } catch (err) {
    console.error('Demo question generation error:', err);
    renderDemoQuestions(fallbackDemoQuestions(biz));
  }

  btn.textContent = 'Generate My Demo →';
  btn.disabled = false;
}

function renderDemoQuestions(questions) {
  demoQAPairs = questions.map(q => ({ q, a: '' }));
  const container = document.getElementById('demoQuestionsContainer');
  container.innerHTML = demoQAPairs.map((qa, i) => `
    <div class="form-group">
      <label class="form-label">${qa.q}</label>
      <input type="text" class="form-input demo-answer-input" data-idx="${i}" placeholder="Your answer...">
    </div>
  `).join('');
  document.getElementById('demoBuilderStep1').style.display = 'none';
  document.getElementById('demoBuilderStep2').style.display = 'block';
}

function buildDemoAgent() {
  const inputs = document.querySelectorAll('.demo-answer-input');
  inputs.forEach(inp => {
    const idx = parseInt(inp.getAttribute('data-idx'), 10);
    demoQAPairs[idx].a = inp.value.trim() || 'Not specified';
  });

  const qaText = demoQAPairs.map(qa => `Q: ${qa.q}\nA: ${qa.a}`).join('\n');
  demoSystemPrompt = `You are a friendly AI chatbot for this business: "${demoBizType}". Here is what the owner told us about their business:\n${qaText}\n\nAnswer visitor questions naturally and helpfully based on this info. If asked something you don't have info on, politely say you'll have someone follow up, and suggest they book an appointment. Keep answers short (2-4 sentences) and conversational.`;

  demoConversation = [];
  document.getElementById('demoBuilderStep2').style.display = 'none';
  document.getElementById('demoBuilderStep3').style.display = 'block';
  document.getElementById('demoChatMessages').innerHTML =
    `<div class="chat-msg"><div class="chat-avatar ai">AI</div><div class="chat-bubble ai-bubble">Hi! 👋 I'm the demo AI agent for your ${demoBizType}. Ask me anything a customer might ask!</div></div>`;
}

function appendDemoMessage(role, text) {
  const container = document.getElementById('demoChatMessages');
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

async function sendDemoMessage() {
  const input = document.getElementById('demoChatInput');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';

  appendDemoMessage('user', msg);
  demoConversation.push({ role: 'user', parts: [{ text: msg }] });

  document.getElementById('demoTypingIndicator').classList.add('show');
  document.getElementById('demoSendBtn').disabled = true;

  try {
    const messages = [
      { role: 'user', parts: [{ text: demoSystemPrompt + '\n\nVisitor says: ' + msg }] },
      ...demoConversation.slice(0, -1),
      { role: 'user', parts: [{ text: msg }] }
    ];
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: messages,
        generationConfig: { temperature: 0.8, maxOutputTokens: 300 }
      })
    });
    if (!res.ok) throw new Error('API error: ' + res.status);

    const data = await res.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't process that — try asking differently!";
    demoConversation.push({ role: 'model', parts: [{ text: reply }] });
    appendDemoMessage('ai', reply);
  } catch (err) {
    console.error('Demo chat error:', err);
    appendDemoMessage('ai', "I'm having trouble connecting right now — this is just a quick live preview. Your real deployed agent would be fully reliable!");
  }

  document.getElementById('demoTypingIndicator').classList.remove('show');
  document.getElementById('demoSendBtn').disabled = false;
}

function resetDemoBuilder() {
  document.getElementById('demoBuilderStep3').style.display = 'none';
  document.getElementById('demoBuilderStep2').style.display = 'none';
  document.getElementById('demoBuilderStep1').style.display = 'block';
  document.getElementById('demoBizType').value = '';
  document.getElementById('demoBuilderError').style.display = 'none';
  demoQAPairs = [];
  demoConversation = [];
}
