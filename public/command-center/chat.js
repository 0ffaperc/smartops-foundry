// ===== Chat with Hermes — connects to API Server :8642 =====
let chatHistory = [{role:'assistant',content:"Hey Sir Perc! I'm Hermes running in a separate web session. I have full access to your tools, memory, and skills. Ask me anything — research, code, agency ops, trading, clips — I'm fully operational here in parallel with Telegram."}];

function appendMsg(role, text) {
  const wrap = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'chat-msg ' + role;
  const avatar = role === 'user' ? '<div class="avatar">SP</div>' : '<div class="avatar">⚡</div>';
  div.innerHTML = avatar + '<div class="bubble">' + escapeHtml(text) + '</div>';
  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
  return div.querySelector('.bubble');
}

function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function renderMarkdown(text) {
  // Basic markdown: code blocks, inline code, bold, links
  let html = escapeHtml(text);
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (m,lang,code) =>
    `<pre>${code.trim()}</pre>`);
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color:var(--accent)">$1</a>');
  html = html.replace(/\n/g, '<br>');
  return html;
}

async function sendChat() {
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  sendBtn.disabled = true;
  appendMsg('user', text);
  chatHistory.push({role:'user', content:text});

  // Typing indicator
  const wrap = document.getElementById('chat-messages');
  const typing = document.createElement('div');
  typing.className = 'chat-msg assistant';
  typing.id = 'typing-indicator';
  typing.innerHTML = '<div class="avatar">⚡</div><div class="bubble"><div class="typing-indicator"><span></span><span></span><span></span></div></div>';
  wrap.appendChild(typing);
  wrap.scrollTop = wrap.scrollHeight;

  try {
    const resp = await fetch(API_BASE + '/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + API_KEY,
      },
      body: JSON.stringify({
        model: 'hermes-agent',
        messages: chatHistory.map(m => ({role: m.role, content: m.content})),
        stream: false,
      }),
    });

    document.getElementById('typing-indicator')?.remove();

    if (!resp.ok) {
      const errText = await resp.text();
      appendMsg('assistant', '⚠️ Error ' + resp.status + ': ' + errText.substring(0, 200));
      return;
    }

    const data = await resp.json();
    const reply = data.choices?.[0]?.message?.content || '(no response)';

    // Render with markdown
    const wrap2 = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-msg assistant';
    div.innerHTML = '<div class="avatar">⚡</div><div class="bubble">' + renderMarkdown(reply) + '</div>';
    wrap2.appendChild(div);
    wrap2.scrollTop = wrap2.scrollHeight;

    chatHistory.push({role:'assistant', content:reply});
  } catch (e) {
    document.getElementById('typing-indicator')?.remove();
    appendMsg('assistant', '⚠️ Connection error: ' + e.message + '\n\nMake sure the Hermes gateway is running (port 8642).');
  } finally {
    sendBtn.disabled = false;
    input.focus();
  }
}

// Focus input when chat page loads
document.addEventListener('DOMContentLoaded', () => {
  // Chat input auto-resize feel
  const input = document.getElementById('chat-input');
  if (input) input.focus();
});
