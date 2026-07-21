// SmartOps Foundry — Client Portal (sidebar layout, 6 panels)
const AUTH_API='***';
const AGENCY_API='/api/agency';
let userData=null, clientData=null, activeTab='dashboard';
const charts={};

// 30 automations grouped into 5 topic tabs
const GROUPS={
  leads:{label:'Lead Generation',icon:'📡',color:'var(--accent)',bg:'var(--accent-bg)',
    types:['missed_call','lead_welcome','quote_followup','estimate_followup','nurture_sequence','faq_responder'],
    system:'You are the Leads Assistant for SmartOps Foundry. Help the client understand lead capture automations: missed call text-back, lead welcome, quote follow-up, estimate follow-up, nurture sequences, FAQ auto-responder. Explain how each works, suggest improvements, answer questions about lead conversion. Be concise and practical.'},
  marketing:{label:'Marketing & Research',icon:'📣',color:'var(--violet)',bg:'var(--violet-bg)',
    types:['social_post','gbp_update','seasonal_campaign','newsletter','multi_channel','content_calendar','ad_copy','promo_offer'],
    system:'You are the Marketing Assistant for SmartOps Foundry. Help with marketing campaigns, social media posts, Google Business Profile updates, seasonal campaigns, newsletters, multi-channel marketing, content calendars, ad copy, and promotional offers. Suggest strategies, explain how automations work. Be practical and actionable.'},
  goals:{label:'Goals & Reputation',icon:'🎯',color:'var(--emerald)',bg:'var(--emerald-bg)',
    types:['review_request','review_response','referral_request','thank_you','re_engagement','winback','birthday','upsell'],
    system:'You are the Goals Assistant for SmartOps Foundry. Help set and track goals for online reviews, review responses, referral requests, customer thank-yous, re-engagement, win-back sequences, birthday messages, and upselling. Explain reputation automations and suggest strategies to improve ratings and retention. Be encouraging and specific.'},
  schedule:{label:'Scheduling & Calls',icon:'📅',color:'var(--cyan)',bg:'var(--cyan-bg)',
    types:['appt_reminder','no_show','call_script','voicemail_followup','call_reminder','call_summary'],
    system:'You are the Schedule Assistant for SmartOps Foundry. Help with appointment reminders, no-show recovery, call scripts, voicemail follow-up, call reminders, and call summaries. Suggest strategies to reduce no-shows and improve scheduling efficiency. Be practical and concise.'},
  reports:{label:'Reports & Revenue',icon:'📈',color:'var(--amber)',bg:'var(--amber-bg)',
    types:['weekly_report','missed_revenue'],
    system:'You are the Reports Assistant for SmartOps Foundry. Help understand weekly reports, missed revenue alerts, and overall analytics. Explain what metrics matter, how to read charts, and what actions to take based on data. Be clear and analytical.'},
};

const AUTO_ICONS={missed_call:'📞',lead_welcome:'👋',quote_followup:'💬',estimate_followup:'📋',nurture_sequence:'🔄',faq_responder:'❓',social_post:'📱',gbp_update:'📍',seasonal_campaign:'🎉',newsletter:'📰',multi_channel:'📡',content_calendar:'🗓',ad_copy:'✍',promo_offer:'🏷',review_request:'⭐',review_response:'💬',referral_request:'🤝',thank_you:'🙏',re_engagement:'🔄',winback:'↩',birthday:'🎂',upsell:'💡',appt_reminder:'📅',no_show:'❌',call_script:'📝',voicemail_followup:'📞',call_reminder:'⏰',call_summary:'📊',weekly_report:'📈',missed_revenue:'⚠'};

// ---- Init ----
async function init(){
  await loadUser();
  await loadClientData();
  renderBadges();
  switchTab('dashboard');
}

async function loadUser(){
  // Prevent redirect loops — only redirect to login once
  if(sessionStorage.getItem('sof_redirecting')) return;
  try{
    const r=await fetch(`${AUTH_API}/me`,{credentials:'include'});
    const d=await r.json();
    if(d.ok&&d.user){
      sessionStorage.removeItem('sof_redirecting');
      userData=d.user;
      document.getElementById('userName').textContent=d.user.name||d.user.email;
      document.getElementById('userPlan').textContent=(d.user.plan||'starter')+' plan';
      document.getElementById('userAvatar').textContent=(d.user.name||'?').charAt(0).toUpperCase();
    }else{
      sessionStorage.setItem('sof_redirecting','1');
      window.location.href='/login.html?redirect=/client.html';
    }
  }catch(e){
    sessionStorage.setItem('sof_redirecting','1');
    window.location.href='/login.html?redirect=/client.html';
  }
}

async function loadClientData(){
  try{
    const r=await fetch(`${AGENCY_API}/clients`,{credentials:'include'});
    const d=await r.json();
    const clients=d.clients||[];
    if(clients.length===0){document.getElementById('bizName').textContent='No business';return;}
    const cid=localStorage.getItem('sof_clientId')||clients[0].id;
    const client=clients.find(c=>c.id===cid)||clients[0];
    localStorage.setItem('sof_clientId',client.id);
    document.getElementById('bizName').textContent=client.name||'My Business';
    document.getElementById('bizIndustry').textContent=client.industry||'';
    const dr=await fetch(`${AGENCY_API}/clients/${client.id}`,{credentials:'include'});
    const dd=await dr.json();
    if(dd.ok) clientData=dd;
  }catch(e){console.error('loadClientData:',e);}
}

function logout(){
  fetch(`${AUTH_API}/logout`,{method:'POST',credentials:'include'}).catch(()=>{});
  window.location.href='/login.html';
}

// ---- Tab switching ----
function switchTab(tab){
  activeTab=tab;
  document.querySelectorAll('.sb-item').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  renderPanel(tab);
}

// ---- Helpers ----
function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function getAutos(group){return(clientData?.automations||[]).filter(a=>GROUPS[group].types.includes(a.type));}
function autoListHTML(group){
  const autos=getAutos(group);
  if(!autos.length) return '<div class="empty"><p>No automations active here yet.</p></div>';
  return `<div class="rows">`+autos.map(a=>`
    <div class="row">
      <div class="r-icon" style="background:${GROUPS[group].bg}">${AUTO_ICONS[a.type]||'⚙'}</div>
      <div class="r-body"><div class="r-title">${esc(a.name||a.type)}</div><div class="r-sub">${esc(a.channel||'sms')} · ${esc(a.type)}</div></div>
      <span class="r-tag ${a.status==='active'?'tag-on':a.status==='draft'?'tag-draft':'tag-pending'}">${a.status||'active'}</span>
    </div>`).join('')+`</div>`;
}
function chatHTML(tabId,icon,bg,color,title,subtitle,placeholder){
  return `<div class="chat-box">
    <div class="chat-h"><div class="ch-ic" style="background:${bg};color:${color}">${icon}</div><div><h4>${title}</h4><p>${subtitle}</p></div></div>
    <div class="chat-msgs" id="chat${tabId}"><div class="cm bot">${subtitle.replace('Ask about','Hi! I can help with')} What would you like to know?</div></div>
    <div class="chat-in"><input id="chat${tabId}Input" placeholder="${placeholder}" onkeydown="if(event.key==='Enter')sendTabChat('${tabId}')"><button onclick="sendTabChat('${tabId}')">Send</button></div>
  </div>`;
}
function statHTML(icon,bg,val,label,trend,trendDir){
  return `<div class="stat"><div class="s-icon" style="background:${bg}">${icon}</div><div class="s-val">${val}</div><div class="s-lbl">${label}</div>${trend?`<div class="s-trend ${trendDir||'up'}">${trend}</div>`:''}</div>`;
}

// ---- Render badges ----
function renderBadges(){
  for(const[k,g]of Object.entries(GROUPS)){
    const el=document.getElementById('badge'+k.charAt(0).toUpperCase()+k.slice(1));
    if(el) el.textContent=getAutos(k).length;
  }
}

// ---- Panel rendering ----
function renderPanel(tab){
  const main=document.getElementById('mainArea');
  if(tab==='dashboard') main.innerHTML=panelDashboard();
  else if(tab==='leads') main.innerHTML=panelLeads();
  else if(tab==='marketing') main.innerHTML=panelMarketing();
  else if(tab==='goals') main.innerHTML=panelGoals();
  else if(tab==='schedule') main.innerHTML=panelSchedule();
  else if(tab==='reports') main.innerHTML=panelReports();
  setTimeout(()=>{if(tab==='dashboard')renderDashCharts();else if(tab!=='dashboard')renderCharts(tab);},50);
}

// ---- Dashboard panel ----
function panelDashboard(){
  const c=clientData?.contacts||[]; const autos=clientData?.automations||[];
  return `
  <div class="panel active">
    <div class="panel-head"><h1>Dashboard</h1><p>Overview of your business at a glance</p></div>
    <div class="stats">
      ${statHTML('📡','var(--accent-bg)',c.length,'Total Contacts','+12%','up')}
      ${statHTML('⚙','var(--emerald-bg)',autos.filter(a=>a.status==='active').length,'Active Automations','','')}
      ${statHTML('💬','var(--violet-bg)',(clientData?.messages||[]).length,'Messages Sent','+8%','up')}
      ${statHTML('⭐','var(--amber-bg)','4.7','Avg Rating','+0.3','up')}
    </div>
    <div class="g2-uneven">
      <div class="card">
        <div class="card-h">📈 Weekly Activity</div>
        <div class="chart-box"><canvas id="chartDash"></canvas></div>
      </div>
      <div class="card">
        <div class="card-h">🔔 Recent Activity</div>
        <div class="rows">
          ${[
            {ic:'✓',bg:'var(--emerald-bg)',t:'Missed call text-back sent to '+(c[0]?.name||'John M.'),s:'2h ago'},
            {ic:'⭐',bg:'var(--amber-bg)',t:'Review request sent to '+(c[1]?.name||'Sarah C.'),s:'5h ago'},
            {ic:'📅',bg:'var(--cyan-bg)',t:'Appointment reminder → '+(c[2]?.name||'Mike T.'),s:'1d ago'},
            {ic:'💬',bg:'var(--accent-bg)',t:'Quote follow-up → '+(c[0]?.name||'David W.'),s:'2d ago'},
            {ic:'📊',bg:'var(--violet-bg)',t:'Weekly report generated',s:'3d ago'},
          ].map(a=>`<div class="row"><div class="r-icon" style="background:${a.bg}">${a.ic}</div><div class="r-body"><div class="r-title">${esc(a.t)}</div><div class="r-sub">${a.s}</div></div></div>`).join('')}
        </div>
      </div>
    </div>
    <div class="g2">
      <div class="card">
        <div class="card-h">🎯 Automation Groups</div>
        <div class="rows">
          ${Object.entries(GROUPS).map(([k,g])=>`<div class="row" style="cursor:pointer" onclick="switchTab('${k}')">
            <div class="r-icon" style="background:${g.bg};color:${g.color}">${g.icon}</div>
            <div class="r-body"><div class="r-title">${g.label}</div><div class="r-sub">${getAutos(k).length} automations active</div></div>
            <span style="font-size:16px;color:var(--text-4)">→</span>
          </div>`).join('')}
        </div>
      </div>
      <div class="card">
        <div class="card-h">🤖 Quick Help</div>
        ${chatHTML('Dashboard','💬','var(--accent-bg)','var(--accent-light)','SmartOps Assistant','Ask about any feature','Ask anything...')}
      </div>
    </div>
  </div>`;
}

// ---- Leads panel ----
function panelLeads(){
  const c=clientData?.contacts||[];
  const leads=c.filter(x=>(x.tags||[]).includes('lead'));
  const customers=c.filter(x=>(x.tags||[]).includes('customer'));
  return `
  <div class="panel active">
    <div class="panel-head">
      <h1>📡 Leads</h1>
      <p>Capture, track, and convert every lead automatically</p>
      <button class="btn-edit" style="margin-top:12px" onclick="openEditModal()">✏️ Request Changes</button>
    </div>
    <div class="stats">
      ${statHTML('📞','var(--accent-bg)',c.length,'Total Leads','+12%','up')}
      ${statHTML('✓','var(--emerald-bg)',customers.length,'Converted','+8%','up')}
      ${statHTML('⏱','var(--amber-bg)','42s','Avg Response','-23%','up')}
      ${statHTML('↗','var(--rose-bg)','$'+(c.length*340).toLocaleString(),'Revenue Recovered','+31%','up')}
    </div>
    <div class="g2-uneven">
      <div class="card">
        <div class="card-h">📈 Leads Captured (8 Weeks)</div>
        <div class="chart-box"><canvas id="chartLeadsBar"></canvas></div>
      </div>
      <div class="card">
        <div class="card-h">🥧 Lead Sources</div>
        <div class="chart-box"><canvas id="chartLeadsDonut"></canvas></div>
      </div>
    </div>
    <div class="g2-uneven">
      <div class="card">
        <div class="card-h">🔻 Conversion Funnel</div>
        <div style="margin-top:8px">
          ${[['Calls Received',100,'var(--accent)'],['Text-Back Sent',85,'var(--cyan)'],['Responded',52,'var(--violet)'],['Booked',31,'var(--emerald)'],['Completed',24,'var(--amber)']].map(([l,w,c])=>`
            <div class="funnel-step">
              <div class="funnel-label">${l}</div>
              <div class="funnel-bar" style="width:${w}%;background:${c}">${w}%</div>
            </div>`).join('')}
        </div>
      </div>
      <div class="card">
        <div class="card-h">🔔 Lead Automations</div>
        ${autoListHTML('leads')}
      </div>
    </div>
    <div class="g2">
      <div class="card">
        <div class="card-h">📋 Recent Leads</div>
        <div class="rows">
          ${c.slice(0,5).map((x,i)=>`<div class="row">
            <div class="r-icon" style="background:var(--accent-bg)">${(x.name||'?').charAt(0)}</div>
            <div class="r-body"><div class="r-title">${esc(x.name)}</div><div class="r-sub">${esc(x.phone||'')} · ${(x.tags||[]).join(', ')}</div></div>
            <span class="r-tag ${(x.tags||[]).includes('customer')?'tag-on':'tag-pending'}">${(x.tags||[]).includes('customer')?'Customer':'Lead'}</span>
          </div>`).join('')||'<div class="empty"><p>No contacts yet.</p></div>'}
        </div>
      </div>
      <div class="card">
        ${chatHTML('Leads','💬','var(--accent-bg)','var(--accent-light)','Leads Assistant','Ask about lead capture & follow-up','Ask about leads...')}
      </div>
    </div>
  </div>`;
}

// ---- Marketing panel ----
function panelMarketing(){
  const autos=getAutos('marketing');
  return `
  <div class="panel active">
    <div class="panel-head">
      <h1>📣 Marketing</h1>
      <p>Campaigns, social media, content, and promotions</p>
      <button class="btn-edit" style="margin-top:12px" onclick="openEditModal()">✏️ Request Changes</button>
    </div>
    <div class="stats">
      ${statHTML('📣','var(--violet-bg)',autos.filter(a=>a.status==='active').length,'Active Campaigns','','')}
      ${statHTML('👁','var(--cyan-bg)','12.4K','Total Reach','+18%','up')}
      ${statHTML('💬','var(--emerald-bg)','8.7%','Engagement Rate','+4.2%','up')}
      ${statHTML('📰','var(--amber-bg)',autos.length*3,'Posts Published','','')}
    </div>
    <div class="g2">
      <div class="card">
        <div class="card-h">📈 Campaign Performance</div>
        <div class="chart-box"><canvas id="chartMktLine"></canvas></div>
      </div>
      <div class="card">
        <div class="card-h">📊 Channel Breakdown</div>
        <div class="chart-box"><canvas id="chartMktBar"></canvas></div>
      </div>
    </div>
    <div class="card" style="margin-bottom:16px">
      <div class="card-h">🎨 Active Campaigns</div>
      <div class="camp-grid">
        ${[
          {title:'Spring Tune-Up Promo',channel:'Email + SMS',reach:'4.2K',engagement:'12%'},
          {title:'Google Business Updates',channel:'GBP',reach:'2.1K',engagement:'8%'},
          {title:'Social Media Posts',channel:'Social',reach:'3.8K',engagement:'15%'},
          {title:'Monthly Newsletter',channel:'Email',reach:'1.9K',engagement:'6%'},
        ].map(c=>`<div class="camp-card">
          <div class="cc-h"><div class="cc-title">${c.title}</div><span class="r-tag tag-on">Active</span></div>
          <div style="font-size:11px;color:var(--text-3)">${c.channel}</div>
          <div class="cc-stats">
            <div class="cc-stat"><strong>${c.reach}</strong>Reach</div>
            <div class="cc-stat"><strong>${c.engagement}</strong>Engagement</div>
          </div>
        </div>`).join('')}
      </div>
    </div>
    <div class="g2">
      <div class="card">
        <div class="card-h">⚙️ Marketing Automations</div>
        ${autoListHTML('marketing')}
      </div>
      <div class="card">
        ${chatHTML('Marketing','💬','var(--violet-bg)','var(--violet)','Marketing Assistant','Ask about campaigns & content','Ask about marketing...')}
      </div>
    </div>
  </div>`;
}

// ---- Goals panel ----
function panelGoals(){
  const goals=[
    {label:'Google Reviews',current:47,target:75,color:'var(--emerald)'},
    {label:'Referral Rate',current:18,target:25,color:'var(--accent)'},
    {label:'Revenue (Quarter)',current:48,target:80,color:'var(--amber)'},
    {label:'Customer Retention',current:92,target:95,color:'var(--cyan)'},
    {label:'Response Time',current:88,target:95,color:'var(--violet)'},
  ];
  return `
  <div class="panel active">
    <div class="panel-head">
      <h1>🎯 Goals</h1>
      <p>Track reviews, referrals, revenue, and retention targets</p>
      <button class="btn-edit" style="margin-top:12px" onclick="openEditModal()">✏️ Request Changes</button>
    </div>
    <div class="stats">
      ${statHTML('⭐','var(--emerald-bg)','47','Reviews (30d)','+7 new','up')}
      ${statHTML('🤝','var(--accent-bg)','12','Referrals Generated','','')}
      ${statHTML('💰','var(--amber-bg)','$48K','Revenue Target','60% done','up')}
      ${statHTML('🔄','var(--cyan-bg)','92%','Retention Rate','+5%','up')}
    </div>
    <div class="g2">
      <div class="card">
        <div class="card-h">🎯 Goal Progress</div>
        ${goals.map(g=>{const pct=Math.min(100,(g.current/g.target*100));return `
        <div class="prog-item">
          <div class="prog-head"><span class="prog-lbl">${g.label}</span><span class="prog-val">${g.current}/${g.target}</span></div>
          <div class="prog-track"><div class="prog-fill" style="width:${pct}%;background:${g.color}"></div></div>
        </div>`;}).join('')}
      </div>
      <div class="card">
        <div class="card-h">🛡 Reputation Radar</div>
        <div class="chart-box"><canvas id="chartGoalRadar"></canvas></div>
      </div>
    </div>
    <div class="g2">
      <div class="card">
        <div class="card-h">🏆 Goal Automations</div>
        ${autoListHTML('goals')}
      </div>
      <div class="card">
        ${chatHTML('Goals','💬','var(--emerald-bg)','var(--emerald)','Goals Assistant','Ask about reviews & referrals','Ask about goals...')}
      </div>
    </div>
  </div>`;
}

// ---- Schedule panel ----
function panelSchedule(){
  const c=clientData?.contacts||[];
  const days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  return `
  <div class="panel active">
    <div class="panel-head">
      <h1>📅 Schedule</h1>
      <p>Appointments, reminders, and no-show recovery</p>
      <button class="btn-edit" style="margin-top:12px" onclick="openEditModal()">✏️ Request Changes</button>
    </div>
    <div class="stats">
      ${statHTML('📅','var(--accent-bg)','8','Upcoming Appts','','')}
      ${statHTML('✓','var(--emerald-bg)','34','Completed (30d)','','')}
      ${statHTML('✗','var(--rose-bg)','3','No-Shows (30d)','','')}
      ${statHTML('📉','var(--amber-bg)','8.1%','No-Show Rate','-12%','up')}
    </div>
    <div class="g2">
      <div class="card">
        <div class="card-h">📅 This Week's Appointments</div>
        <div class="chart-box"><canvas id="chartSchedBar"></canvas></div>
      </div>
      <div class="card">
        <div class="card-h">🔔 Upcoming Reminders</div>
        <div class="rows">
          ${c.slice(0,5).map((x,i)=>`<div class="row">
            <div class="r-icon" style="background:var(--accent-bg)">📅</div>
            <div class="r-body"><div class="r-title">${esc(x.name)}</div><div class="r-sub">${['Tomorrow 9am','Tomorrow 2pm','Wed 10am','Thu 3pm','Fri 11am'][i]||'TBD'} · ${esc(x.phone||'')}</div></div>
            <span class="r-tag tag-on">Confirmed</span>
          </div>`).join('')||'<div class="empty"><p>No appointments.</p></div>'}
        </div>
      </div>
    </div>
    <div class="g2">
      <div class="card">
        <div class="card-h">⚙️ Scheduling Automations</div>
        ${autoListHTML('schedule')}
      </div>
      <div class="card">
        ${chatHTML('Schedule','💬','var(--cyan-bg)','var(--cyan)','Schedule Assistant','Ask about appointments & reminders','Ask about scheduling...')}
      </div>
    </div>
  </div>`;
}

// ---- Reports panel ----
function panelReports(){
  const c=clientData?.contacts||[];
  return `
  <div class="panel active">
    <div class="panel-head">
      <h1>📈 Reports</h1>
      <p>Revenue tracking, performance analytics, and activity logs</p>
      <button class="btn-edit" style="margin-top:12px" onclick="openEditModal()">✏️ Request Changes</button>
    </div>
    <div class="stats">
      ${statHTML('💰','var(--emerald-bg)','$48.2K','Revenue (30d)','+24%','up')}
      ${statHTML('📥','var(--accent-bg)','$31.4K','Revenue Captured','','')}
      ${statHTML('🔄','var(--amber-bg)','$16.8K','Revenue Recovered','+31%','up')}
      ${statHTML('⚡','var(--cyan-bg)','247','Automations Run','','')}
    </div>
    <div class="g2">
      <div class="card">
        <div class="card-h">📈 Revenue Trend (90 Days)</div>
        <div class="chart-box"><canvas id="chartRepLine"></canvas></div>
      </div>
      <div class="card">
        <div class="card-h">📊 Revenue by Service Type</div>
        <div class="chart-box"><canvas id="chartRepBar"></canvas></div>
      </div>
    </div>
    <div class="g2">
      <div class="card">
        <div class="card-h">📋 Recent Activity</div>
        <div class="rows">
          ${[
            {ic:'✓',bg:'var(--emerald-bg)',t:'Missed call text-back sent to '+(c[0]?.name||'John M.'),s:'2h ago'},
            {ic:'⭐',bg:'var(--amber-bg)',t:'Review request sent to '+(c[1]?.name||'Sarah C.'),s:'5h ago'},
            {ic:'📅',bg:'var(--cyan-bg)',t:'Appointment reminder → '+(c[2]?.name||'Mike T.'),s:'1d ago'},
            {ic:'💬',bg:'var(--accent-bg)',t:'Quote follow-up → '+(c[0]?.name||'David W.'),s:'2d ago'},
            {ic:'📊',bg:'var(--violet-bg)',t:'Weekly report generated',s:'3d ago'},
          ].map(a=>`<div class="row"><div class="r-icon" style="background:${a.bg}">${a.ic}</div><div class="r-body"><div class="r-title">${esc(a.t)}</div><div class="r-sub">${a.s}</div></div></div>`).join('')}
        </div>
      </div>
      <div class="card">
        ${chatHTML('Reports','💬','var(--amber-bg)','var(--amber)','Reports Assistant','Ask about revenue & analytics','Ask about reports...')}
      </div>
    </div>
  </div>`;
}
