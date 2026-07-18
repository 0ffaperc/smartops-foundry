// ===== Command Center JS =====
const API_BASE = 'http://127.0.0.1:8642';
const API_KEY = 'f413f14d2084ceb4503ff13e00a75793ef2361899e296938a19cf0906fd65b3d';
const BACKEND = 'http://127.0.0.1:8787';

// ===== Example Data =====
const AGENCY = {
  totalClients: 4, activeClients: 3, totalRevenue: 28450, monthlyRevenue: 7125,
  activeJobs: 12, completedJobs: 87, automationsRun: 342, pendingTasks: 6,
  revenueData: [4200, 4800, 5100, 5600, 6200, 6500, 6900, 7125],
  revenueLabels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug'],
  jobsData: [4,6,3,8,5,7,4,9,6,8,5,7,9,6],
  jobsLabels: ['','','','','','','','','','','','','',''],
  clientTypes: { HVAC: 1, YouTube: 1, Trading: 1, RealEstate: 1 },
};

const CLIENTS = [
  {
    id: 'summit-air', name: 'Summit Air HVAC', niche: 'HVAC', plan: 'Premium ($1,200/mo)',
    revenue: 8400, goal: 12000, tasks: [
      {text:'Follow up on quote for Johnson residence',done:false,priority:'high'},
      {text:'Send review request to completed appointments',done:true,priority:'medium'},
      {text:'Daily ops report generation',done:true,priority:'low'},
      {text:'Schedule appointment reminder calls',done:false,priority:'high'},
      {text:'Update CRM with new webform leads',done:false,priority:'medium'},
    ],
    goals: [
      {name:'Increase monthly revenue to $12K',progress:70,color:'#4f46e5'},
      {name:'Get 50 Google reviews',progress:34,color:'#10b981'},
      {name:'Automate 80% of follow-ups',progress:85,color:'#f59e0b'},
    ],
    services: { 'Missed Call Textback':30, 'Quote Follow-ups':25, 'Review Requests':20, 'Daily Reports':15, 'Appointment Reminders':10 },
    jobs: [
      {name:'Quote follow-up batch',type:'SMS',date:'Jul 15',status:'Completed',value:'$2,400'},
      {name:'Review request blast',type:'Email',date:'Jul 14',status:'Completed',value:'$1,200'},
      {name:'Daily ops report',type:'Report',date:'Jul 15',status:'Completed',value:'$300'},
      {name:'Appointment reminders',type:'SMS',date:'Jul 15',status:'In Progress',value:'$450'},
      {name:'New lead intake',type:'CRM',date:'Jul 15',status:'Pending',value:'$600'},
    ],
  },
  {
    id: 'clip-builder', name: 'ClipBuilder Media', niche: 'YouTube', plan: 'Growth ($800/mo)',
    revenue: 5600, goal: 8000, tasks: [
      {text:'Process 5 football clips for editing',done:false,priority:'high'},
      {text:'Upload 3 finished clips to YouTube',done:true,priority:'medium'},
      {text:'Analyze trending UFC content',done:false,priority:'medium'},
      {text:'Update thumbnail templates',done:true,priority:'low'},
    ],
    goals: [
      {name:'Reach 10K subscribers',progress:62,color:'#4f46e5'},
      {name:'Publish 30 clips/month',progress:80,color:'#10b981'},
      {name:'Monetize channel',progress:45,color:'#f59e0b'},
    ],
    services: { 'Clip Editing':40, 'Trend Research':20, 'Thumbnail Design':15, 'SEO Optimization':15, 'Channel Management':10 },
    jobs: [
      {name:'Football montage edit',type:'Video',date:'Jul 15',status:'Completed',value:'$800'},
      {name:'UFC trend analysis',type:'Research',date:'Jul 14',status:'Completed',value:'$400'},
      {name:'Streaming clip batch',type:'Video',date:'Jul 15',status:'In Progress',value:'$600'},
    ],
  },
  {
    id: 'trading-academy', name: 'Perc Trading Academy', niche: 'Trading', plan: 'Elite ($1,500/mo)',
    revenue: 10500, goal: 15000, tasks: [
      {text:'Update ICT liquidity model study notes',done:false,priority:'high'},
      {text:'Record weekly market review',done:true,priority:'high'},
      {text:'Backtest new MSS strategy',done:false,priority:'medium'},
      {text:'Send weekly newsletter',done:false,priority:'medium'},
    ],
    goals: [
      {name:'Build 20-model backtest journal',progress:75,color:'#4f46e5'},
      {name:'Launch mentorship program',progress:50,color:'#10b981'},
      {name:'Publish trading course',progress:30,color:'#f59e0b'},
    ],
    services: { 'Market Analysis':35, 'Backtesting':25, 'Content Creation':20, 'Mentorship':20 },
    jobs: [
      {name:'Weekly market review',type:'Analysis',date:'Jul 15',status:'Completed',value:'$1,500'},
      {name:'Model V3 backtest',type:'Research',date:'Jul 14',status:'Completed',value:'$800'},
      {name:'Newsletter distribution',type:'Email',date:'Jul 15',status:'Pending',value:'$500'},
    ],
  },
  {
    id: 'realty-group', name: 'Summit Realty Group', niche: 'RealEstate', plan: 'Starter ($500/mo)',
    revenue: 3950, goal: 6000, tasks: [
      {text:'Automate listing notifications',done:false,priority:'medium'},
      {text:'Follow up with 3 new leads',done:true,priority:'high'},
    ],
    goals: [
      {name:'Close 5 deals this quarter',progress:40,color:'#4f46e5'},
      {name:'Build agent portal',progress:20,color:'#10b981'},
    ],
    services: { 'Lead Management':50, 'Listing Alerts':30, 'Email Campaigns':20 },
    jobs: [
      {name:'Lead follow-up batch',type:'SMS',date:'Jul 15',status:'Completed',value:'$500'},
      {name:'Listing alert setup',type:'Automation',date:'Jul 14',status:'Completed',value:'$300'},
    ],
  },
];

let charts = {};

// ===== Page Navigation =====
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  document.querySelector(`.nav-item[data-page="${name}"]`).classList.add('active');
  if (name === 'chat') document.getElementById('chat-input')?.focus();
}

// ===== Agency Dashboard =====
function renderAgencyStats() {
  const stats = [
    {label:'Total Clients',value:AGENCY.totalClients,delta:'+1 this month',up:true,icon:'🏢',bg:'var(--accent-bg)',color:'var(--accent)'},
    {label:'Monthly Revenue',value:'$'+AGENCY.monthlyRevenue.toLocaleString(),delta:'+12.5% MoM',up:true,icon:'💰',bg:'var(--green-bg)',color:'var(--green)'},
    {label:'Active Jobs',value:AGENCY.activeJobs,delta:'3 due today',up:false,icon:'⚡',bg:'var(--amber-bg)',color:'var(--amber)'},
    {label:'Completed Jobs',value:AGENCY.completedJobs,delta:'+18 this week',up:true,icon:'✅',bg:'var(--sky-bg)',color:'var(--sky)'},
  ];
  document.getElementById('agency-stats').innerHTML = stats.map(s => `
    <div class="stat-card">
      <div class="icon-box" style="background:${s.bg};color:${s.color}">${s.icon}</div>
      <div class="label">${s.label}</div>
      <div class="value">${s.value}</div>
      <div class="delta ${s.up?'up':'down'}">${s.up?'▲':'▼'} ${s.delta}</div>
    </div>`).join('');
}

function renderAgencyCharts() {
  Chart.defaults.font.family = 'Inter, sans-serif';
  Chart.defaults.color = '#6b7280';

  // Revenue line chart
  charts.rev = new Chart(document.getElementById('chart-revenue'), {
    type: 'line',
    data: {
      labels: AGENCY.revenueLabels,
      datasets: [{
        label: 'Revenue ($)', data: AGENCY.revenueData,
        borderColor: '#4f46e5', backgroundColor: 'rgba(79,70,229,0.08)',
        fill: true, tension: 0.35, borderWidth: 2.5, pointRadius: 4, pointBackgroundColor: '#4f46e5',
      }]
    },
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
      scales:{y:{grid:{color:'#f0f2f7'},ticks:{callback:v=>'$'+v/1000+'k'}}} }
  });

  // Client distribution doughnut
  charts.clients = new Chart(document.getElementById('chart-clients'), {
    type: 'doughnut',
    data: {
      labels: Object.keys(AGENCY.clientTypes),
      datasets: [{ data: Object.values(AGENCY.clientTypes),
        backgroundColor: ['#4f46e5','#10b981','#f59e0b','#0ea5e9'], borderWidth:0 }]
    },
    options: { responsive:true, maintainAspectRatio:false, cutout:'65%',
      plugins:{legend:{position:'bottom',labels:{padding:14,usePointStyle:true}}} }
  });

  // Jobs bar chart
  charts.jobs = new Chart(document.getElementById('chart-jobs'), {
    type: 'bar',
    data: {
      labels: AGENCY.jobsLabels,
      datasets: [{ label:'Jobs', data:AGENCY.jobsData,
        backgroundColor:'#4f46e5', borderRadius:6, barThickness:18 }]
    },
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
      scales:{y:{grid:{color:'#f0f2f7'},beginAtZero:true}} }
  });

  // Automation activity
  charts.auto = new Chart(document.getElementById('chart-automations'), {
    type: 'line',
    data: {
      labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
      datasets: [{
        label:'Automations Run', data:[42,38,51,47,55,30,28],
        borderColor:'#10b981', backgroundColor:'rgba(16,185,129,0.08)',
        fill:true, tension:0.35, borderWidth:2.5, pointRadius:3,
      }]
    },
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
      scales:{y:{grid:{color:'#f0f2f7'},beginAtZero:true}} }
  });
}

function renderAgencyTable() {
  const tbody = document.querySelector('#agency-client-table tbody');
  tbody.innerHTML = CLIENTS.map(c => `
    <tr>
      <td><strong>${c.name}</strong></td>
      <td>${c.niche}</td>
      <td>${c.plan}</td>
      <td>$${c.revenue.toLocaleString()}</td>
      <td><span class="pill ${c.id==='realty-group'?'amber':'green'}">${c.id==='realty-group'?'Onboarding':'Active'}</span></td>
    </tr>`).join('');
}

// ===== Client Dashboard =====
function renderClientSelector() {
  document.getElementById('client-selector').innerHTML =
    CLIENTS.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

function loadClientDashboard(id) {
  const c = CLIENTS.find(x => x.id === id);
  if (!c) return;

  // Stats
  const taskDone = c.tasks.filter(t=>t.done).length;
  const stats = [
    {label:'Total Revenue',value:'$'+c.revenue.toLocaleString(),delta:`${Math.round(c.revenue/c.goal*100)}% of goal`,up:true,icon:'💰',bg:'var(--green-bg)',color:'var(--green)'},
    {label:'Revenue Goal',value:'$'+c.goal.toLocaleString(),delta:'$'+(c.goal-c.revenue).toLocaleString()+' to go',up:false,icon:'🎯',bg:'var(--accent-bg)',color:'var(--accent)'},
    {label:'Tasks Done',value:`${taskDone}/${c.tasks.length}`,delta:taskDone<c.tasks.length?(c.tasks.length-taskDone)+' pending':'All done!',up:taskDone===c.tasks.length,icon:'✅',bg:'var(--sky-bg)',color:'var(--sky)'},
    {label:'Jobs This Month',value:c.jobs.length,delta:c.jobs.filter(j=>j.status==='Completed').length+' completed',up:true,icon:'⚡',bg:'var(--amber-bg)',color:'var(--amber)'},
  ];
  document.getElementById('client-stats').innerHTML = stats.map(s => `
    <div class="stat-card">
      <div class="icon-box" style="background:${s.bg};color:${s.color}">${s.icon}</div>
      <div class="label">${s.label}</div>
      <div class="value">${s.value}</div>
      <div class="delta ${s.up?'up':'down'}">${s.up?'▲':'▼'} ${s.delta}</div>
    </div>`).join('');

  // Revenue vs goal
  if (charts.clientRev) charts.clientRev.destroy();
  charts.clientRev = new Chart(document.getElementById('chart-client-rev'), {
    type: 'bar',
    data: {
      labels: ['Current Revenue','Remaining to Goal','Goal'],
      datasets: [{ data:[c.revenue, c.goal-c.revenue, c.goal],
        backgroundColor:['#10b981','#fbbf24','#e2e6ef'], borderRadius:8, barThickness:50 }]
    },
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
      scales:{y:{grid:{color:'#f0f2f7'},ticks:{callback:v=>'$'+v/1000+'k'}}} }
  });

  // Services
  if (charts.clientSvc) charts.clientSvc.destroy();
  charts.clientSvc = new Chart(document.getElementById('chart-client-services'), {
    type: 'doughnut',
    data: {
      labels: Object.keys(c.services),
      datasets: [{ data: Object.values(c.services),
        backgroundColor:['#4f46e5','#10b981','#f59e0b','#0ea5e9','#8b5cf6','#ec4899'], borderWidth:0 }]
    },
    options: { responsive:true, maintainAspectRatio:false, cutout:'60%',
      plugins:{legend:{position:'bottom',labels:{padding:10,usePointStyle:true,font:{size:11}}} } }
  });

  // Goals
  document.getElementById('client-goals').innerHTML = c.goals.map(g => `
    <div style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px">
        <span>${g.name}</span><strong style="color:${g.color}">${g.progress}%</strong>
      </div>
      <div class="progress-bar"><div class="fill" style="width:${g.progress}%;background:${g.color}"></div></div>
    </div>`).join('');

  // Tasks
  document.getElementById('client-tasks').innerHTML = c.tasks.map((t,i) => `
    <div class="task-item ${t.done?'done':''}">
      <div class="check" onclick="toggleTask('${c.id}',${i})">${t.done?'✓':''}</div>
      <span class="task-text">${t.text}</span>
      <span class="task-meta">${t.priority}</span>
    </div>`).join('');

  // Jobs table
  document.querySelector('#client-jobs-table tbody').innerHTML = c.jobs.map(j => {
    const pill = j.status==='Completed'?'green':j.status==='In Progress'?'sky':'amber';
    return `<tr>
      <td><strong>${j.name}</strong></td>
      <td>${j.type}</td>
      <td>${j.date}</td>
      <td><span class="pill ${pill}">${j.status}</span></td>
      <td>${j.value}</td>
    </tr>`;
  }).join('');
}

function toggleTask(cid, idx) {
  const c = CLIENTS.find(x=>x.id===cid);
  c.tasks[idx].done = !c.tasks[idx].done;
  loadClientDashboard(cid);
}

// ===== Tasks Page =====
function renderAllTasks() {
  const allTasks = CLIENTS.flatMap(c => c.tasks.map(t => ({...t, client:c.name})));
  document.getElementById('all-tasks').innerHTML = allTasks.map((t,i) => `
    <div class="task-item ${t.done?'done':''}">
      <div class="check" onclick="toggleAllTask(${i})">${t.done?'✓':''}</div>
      <span class="task-text">${t.text}</span>
      <span class="task-meta">${t.client}</span>
    </div>`).join('');

  const allJobs = CLIENTS.flatMap(c => c.jobs.map(j => ({...j, client:c.name})));
  document.querySelector('#all-jobs-table tbody').innerHTML = allJobs.map(j => {
    const pill = j.status==='Completed'?'green':j.status==='In Progress'?'sky':'amber';
    return `<tr>
      <td>${j.client}</td>
      <td><strong>${j.name}</strong></td>
      <td>${j.type}</td>
      <td>${j.date}</td>
      <td><span class="pill ${pill}">${j.status}</span></td>
      <td>${j.value}</td>
    </tr>`;
  }).join('');
}

let _allTasksCache = null;
function toggleAllTask(i) {
  if (!_allTasksCache) {
    _allTasksCache = CLIENTS.flatMap(c => c.tasks.map(t => ({...t, client:c.name})));
  }
  _allTasksCache[i].done = !_allTasksCache[i].done;
  renderAllTasks();
}

// ===== Init =====
renderAgencyStats();
renderAgencyCharts();
renderAgencyTable();
renderClientSelector();
loadClientDashboard('summit-air');
renderAllTasks();
