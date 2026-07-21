// client-app-part2.js — Charts, chatbots, edit modal for the sidebar-based client portal

const CC=['#6366f1','#10b981','#f59e0b','#f43f5e','#06b6d4','#a78bfa','#ec4899','#84cc16'];
const CG='rgba(255,255,255,.04)';
const CT='#6b6f76';
function destroyChart(id){if(charts[id]){charts[id].destroy();delete charts[id];}}

function renderCharts(tab){
  if(tab==='leads'){renderLeadsCharts();}
  else if(tab==='marketing'){renderMktCharts();}
  else if(tab==='goals'){renderGoalsChart();}
  else if(tab==='schedule'){renderSchedChart();}
  else if(tab==='reports'){renderRepCharts();}
}
function renderDashCharts(){
  destroyChart('chartDash');
  charts.chartDash=new Chart(document.getElementById('chartDash'),{
    type:'line',
    data:{labels:['W1','W2','W3','W4','W5','W6','W7','W8'],datasets:[
      {label:'Leads',data:[12,18,15,22,28,24,31,35],borderColor:'#6366f1',backgroundColor:'rgba(99,102,241,.1)',fill:true,tension:.4},
      {label:'Conversions',data:[3,5,4,7,8,7,10,12],borderColor:'#10b981',backgroundColor:'rgba(16,185,129,.1)',fill:true,tension:.4}
    ]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:CT,font:{size:10}}}},scales:{x:{grid:{color:CG},ticks:{color:CT,font:{size:9}}},y:{grid:{color:CG},ticks:{color:CT,font:{size:9}}}}}
  });
}
function renderLeadsCharts(){
  destroyChart('chartLeadsBar');destroyChart('chartLeadsDonut');
  charts.chartLeadsBar=new Chart(document.getElementById('chartLeadsBar'),{
    type:'bar',
    data:{labels:['W1','W2','W3','W4','W5','W6','W7','W8'],datasets:[{label:'Leads',data:[12,18,15,22,28,24,31,35],backgroundColor:'rgba(99,102,241,.5)',borderColor:'#6366f1',borderWidth:1,borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{color:CG},ticks:{color:CT,font:{size:9}}},y:{grid:{color:CG},ticks:{color:CT,font:{size:9}}}}}
  });
  charts.chartLeadsDonut=new Chart(document.getElementById('chartLeadsDonut'),{
    type:'doughnut',
    data:{labels:['Missed Calls','Web Forms','Referrals','Walk-ins'],datasets:[{data:[42,28,18,12],backgroundColor:CC,borderWidth:0}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:'65%',plugins:{legend:{position:'bottom',labels:{color:CT,font:{size:10},padding:8}}}}
  });
}
function renderMktCharts(){
  destroyChart('chartMktLine');destroyChart('chartMktBar');
  charts.chartMktLine=new Chart(document.getElementById('chartMktLine'),{
    type:'line',
    data:{labels:['Jan','Feb','Mar','Apr','May','Jun','Jul'],datasets:[
      {label:'Reach',data:[3200,4100,3800,5200,6100,5800,7200],borderColor:'#a78bfa',backgroundColor:'rgba(167,139,250,.1)',fill:true,tension:.4},
      {label:'Engagement',data:[180,240,210,320,380,350,440],borderColor:'#06b6d4',backgroundColor:'rgba(6,182,212,.1)',fill:true,tension:.4}
    ]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:CT,font:{size:10}}}},scales:{x:{grid:{color:CG},ticks:{color:CT,font:{size:9}}},y:{grid:{color:CG},ticks:{color:CT,font:{size:9}}}}}
  });
  charts.chartMktBar=new Chart(document.getElementById('chartMktBar'),{
    type:'bar',
    data:{labels:['Social','Email','GBP','Newsletter','Ads'],datasets:[{data:[14,8,5,4,3],backgroundColor:['rgba(167,139,250,.5)','rgba(99,102,241,.5)','rgba(6,182,212,.5)','rgba(16,185,129,.5)','rgba(245,158,11,.5)'],borderColor:['#a78bfa','#6366f1','#06b6d4','#10b981','#f59e0b'],borderWidth:1,borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{color:CG},ticks:{color:CT,font:{size:9}}},y:{grid:{color:CG},ticks:{color:CT,font:{size:9}}}}}
  });
}
function renderGoalsChart(){
  destroyChart('chartGoalRadar');
  charts.chartGoalRadar=new Chart(document.getElementById('chartGoalRadar'),{
    type:'radar',
    data:{labels:['Reviews','Response Rate','Referral Rate','Rating','Engagement','Retention'],datasets:[
      {label:'Current',data:[62,88,72,85,68,92],borderColor:'#10b981',backgroundColor:'rgba(16,185,129,.15)',borderWidth:2,pointRadius:3},
      {label:'Target',data:[80,95,90,90,80,95],borderColor:'#6366f1',backgroundColor:'rgba(99,102,241,.08)',borderWidth:1,borderDash:[4,4],pointRadius:2}
    ]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:CT,font:{size:10}}}},scales:{r:{grid:{color:CG},angleLines:{color:CG},pointLabels:{color:CT,font:{size:9}},ticks:{display:false,beginAtZero:true,max:100}}}}
  });
}
function renderSchedChart(){
  destroyChart('chartSchedBar');
  charts.chartSchedBar=new Chart(document.getElementById('chartSchedBar'),{
    type:'bar',
    data:{labels:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],datasets:[
      {label:'Booked',data:[5,8,6,7,9,3,0],backgroundColor:'rgba(99,102,241,.5)',borderColor:'#6366f1',borderRadius:4,stack:'a'},
      {label:'Completed',data:[4,7,6,6,8,3,0],backgroundColor:'rgba(16,185,129,.5)',borderColor:'#10b981',borderRadius:4,stack:'a'},
      {label:'No-show',data:[0,1,0,1,1,0,0],backgroundColor:'rgba(244,63,94,.5)',borderColor:'#f43f5e',borderRadius:4,stack:'a'}
    ]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:CT,font:{size:10}}}},scales:{x:{stacked:true,grid:{color:CG},ticks:{color:CT,font:{size:9}}},y:{stacked:true,grid:{color:CG},ticks:{color:CT,font:{size:9}}}}}
  });
}
function renderRepCharts(){
  destroyChart('chartRepLine');destroyChart('chartRepBar');
  charts.chartRepLine=new Chart(document.getElementById('chartRepLine'),{
    type:'line',
    data:{labels:Array.from({length:12},(_,i)=>'W'+(i+1)),datasets:[
      {label:'Revenue',data:[28,32,30,35,38,42,40,45,48,52,49,55].map(v=>v*1000),borderColor:'#10b981',backgroundColor:'rgba(16,185,129,.1)',fill:true,tension:.4},
      {label:'Recovered',data:[8,10,9,12,14,13,16,18,17,20,19,22].map(v=>v*1000),borderColor:'#f59e0b',backgroundColor:'rgba(245,158,11,.08)',fill:true,tension:.4}
    ]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:CT,font:{size:10}}}},scales:{x:{grid:{color:CG},ticks:{color:CT,font:{size:8}}},y:{grid:{color:CG},ticks:{color:CT,font:{size:9},callback:v=>'$'+(v/1000)+'K'}}}}
  });
  charts.chartRepBar=new Chart(document.getElementById('chartRepBar'),{
    type:'bar',
    data:{labels:['Repair','Install','Maint.','Inspection','Emergency','Consult'],datasets:[{data:[18,12,8,5,9,4].map(v=>v*1000),backgroundColor:CC.map(c=>c+'80'),borderColor:CC,borderWidth:1,borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{color:CG},ticks:{color:CT,font:{size:9}}},y:{grid:{color:CG},ticks:{color:CT,font:{size:9},callback:v=>'$'+(v/1000)+'K'}}}}
  });
}

// ---- Per-tab chatbot ----
async function sendTabChat(tabId){
  // tabId is like 'Leads', 'Marketing', 'Goals', 'Schedule', 'Reports', 'Dashboard'
  const tabKey = tabId === 'Dashboard' ? 'dashboard' : tabId.toLowerCase();
  const input = document.getElementById('chat'+tabId+'Input');
  const msgs = document.getElementById('chat'+tabId);
  if(!input||!msgs) return;
  const msg = input.value.trim();
  if(!msg) return;
  input.value = '';
  msgs.insertAdjacentHTML('beforeend', `<div class="cm user">${esc(msg)}</div>`);
  msgs.scrollTop = msgs.scrollHeight;
  const typing = document.createElement('div');
  typing.className = 'cm-typing';
  typing.textContent = 'Thinking...';
  msgs.appendChild(typing);
  msgs.scrollTop = msgs.scrollHeight;
  try {
    const groupKey = tabId === 'Dashboard' ? 'leads' : tabKey;
    const system = GROUPS[groupKey]?.system || 'You are a helpful SmartOps Foundry assistant. Be concise.';
    const res = await fetch('/api/chat/help', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, system })
    });
    const data = await res.json();
    typing.remove();
    msgs.insertAdjacentHTML('beforeend', `<div class="cm bot">${esc(data.reply || 'Sorry, I could not process that.')}</div>`);
  } catch (e) {
    typing.remove();
    msgs.insertAdjacentHTML('beforeend', `<div class="cm bot">Connection error. Please try again.</div>`);
  }
  msgs.scrollTop = msgs.scrollHeight;
}

// ---- Edit request modal ----
function openEditModal(){document.getElementById('editModal').classList.add('show');document.getElementById('editText').focus();}
function closeEditModal(){document.getElementById('editModal').classList.remove('show');document.getElementById('editText').value='';}
async function submitEditRequest(){
  const text=document.getElementById('editText').value.trim();
  if(!text){closeEditModal();return;}
  try{
    const cid=localStorage.getItem('sof_clientId');
    if(cid){
      await fetch(`/api/agency/clients/${cid}/messages`,{
        method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',
        body:JSON.stringify({type:'edit_request',channel:'none',body:text,status:'pending'})
      });
    }
  }catch(e){}
  closeEditModal();
  const toast=document.createElement('div');
  toast.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--emerald);color:#fff;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:500;z-index:300;box-shadow:0 4px 16px rgba(16,185,129,.3)';
  toast.textContent='✓ Request sent! Your account manager will handle it.';
  document.body.appendChild(toast);
  setTimeout(()=>toast.remove(),3000);
}
