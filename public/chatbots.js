// SmartOps Foundry — Chatbot frontend
// Two bots: Help (public, DeepSeek free) + Jarvis (private, OpenRouter)

function toggleChat(which) {
  const el = document.getElementById(which === 'help' ? 'helpChat' : 'jarvisChat');
  el.classList.toggle('show');
}

// ---- HELP BOT (public) ----
async function sendHelpMsg() {
  const input = document.getElementById('helpInput');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  const msgs = document.getElementById('helpMsgs');
  msgs.insertAdjacentHTML('beforeend', `<div class="chat-msg user">${escHtml(msg)}</div>`);
  msgs.scrollTop = msgs.scrollHeight;
  const typing = document.createElement('div');
  typing.className = 'chat-msg bot typing';
  typing.textContent = 'Thinking...';
  msgs.appendChild(typing);
  msgs.scrollTop = msgs.scrollHeight;
  try {
    const res = await fetch('/api/chat/help', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg })
    });
    const data = await res.json();
    typing.remove();
    msgs.insertAdjacentHTML('beforeend', `<div class="chat-msg bot">${escHtml(data.reply || 'Sorry, I could not process that.')}</div>`);
  } catch (e) {
    typing.remove();
    msgs.insertAdjacentHTML('beforeend', `<div class="chat-msg bot">Connection error. Please try again.</div>`);
  }
  msgs.scrollTop = msgs.scrollHeight;
}

// ---- JARVIS BOT (private, OpenRouter) ----
let jarvisHistory = [];
async function sendJarvisMsg() {
  const input = document.getElementById('jarvisInput');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  const msgs = document.getElementById('jarvisMsgs');
  msgs.insertAdjacentHTML('beforeend', `<div class="chat-msg user">${escHtml(msg)}</div>`);
  msgs.scrollTop = msgs.scrollHeight;
  const typing = document.createElement('div');
  typing.className = 'chat-msg bot typing';
  typing.textContent = 'Jarvis is thinking...';
  msgs.appendChild(typing);
  msgs.scrollTop = msgs.scrollHeight;
  jarvisHistory.push({ role: 'user', content: msg });
  try {
    const res = await fetch('/api/chat/jarvis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, history: jarvisHistory.slice(-10) })
    });
    const data = await res.json();
    typing.remove();
    const reply = data.reply || 'I could not process that, sir.';
    jarvisHistory.push({ role: 'assistant', content: reply });
    msgs.insertAdjacentHTML('beforeend', `<div class="chat-msg bot">${escHtml(reply)}</div>`);
  } catch (e) {
    typing.remove();
    msgs.insertAdjacentHTML('beforeend', `<div class="chat-msg bot">Connection error, sir. Please try again.</div>`);
  }
  msgs.scrollTop = msgs.scrollHeight;
}

function escHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
