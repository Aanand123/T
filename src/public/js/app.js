const api = {
  token: localStorage.getItem('token') || null,
  botId: localStorage.getItem('botId') || null,
  async request(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    const res = await fetch(path, { ...options, headers });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Request failed');
    return res.json();
  }
};

const app = document.getElementById('app');

function card(html) { return `<div class="card">${html}</div>`; }

function renderLogin() {
  app.innerHTML = `<div class="container">${card(`
    <h2>Admin Login</h2><p class="muted">Secure JWT authentication.</p>
    <input id="u" placeholder="Username" /><br/><br/>
    <input id="p" type="password" placeholder="Password" /><br/><br/>
    <button id="login">Login</button>
  `)}</div>`;
  document.getElementById('login').onclick = async () => {
    const data = await api.request('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: u.value, password: p.value }) });
    api.token = data.token; localStorage.setItem('token', data.token); boot();
  };
}

async function boot() {
  if (!api.token) return renderLogin();

  const bots = await api.request('/api/admin/bots');
  if (!api.botId && bots[0]) { api.botId = bots[0]._id; localStorage.setItem('botId', api.botId); }

  const d = await api.request(`/api/admin/dashboard${api.botId ? `?botId=${api.botId}` : ''}`);
  const leaderboard = api.botId ? await api.request(`/api/admin/leaderboard/${api.botId}`) : [];

  app.innerHTML = `<div class="container">
    <div class="topbar card">
      <select id="botSelect"><option value="">Select bot</option>${bots.map(b=>`<option value="${b._id}" ${b._id===api.botId?'selected':''}>${b.name||b.botUsername||b._id}</option>`).join('')}</select>
      <button class="secondary" id="refresh">Refresh</button>
      <button class="secondary" id="logout">Logout</button>
    </div>
    <div class="row">
      ${card(`<h3>Total Bots</h3><h1>${d.totalBots}</h1>`)}
      ${card(`<h3>Active Bots</h3><h1>${d.activeBots}</h1>`)}
      ${card(`<h3>Total Users</h3><h1>${d.totalUsers}</h1>`)}
      ${card(`<h3>Joined Users</h3><h1>${d.joinedUsers}</h1>`)}
      ${card(`<h3>Completed Users</h3><h1>${d.completedUsers}</h1>`)}
    </div>
    <div class="row">
      ${card(`<h3>Bot Manager</h3>
        <input id="botName" placeholder="Bot Name"/><br/><br/>
        <input id="botToken" placeholder="Telegram Bot Token"/><br/><br/>
        <button id="addBot">Add Bot</button><br/><br/>
        <table class="table"><tr><th>Name</th><th>Status</th><th>Action</th></tr>
        ${bots.map(b=>`<tr><td>${b.name||b.botUsername||'-'}</td><td>${b.status}</td><td>
          <button data-toggle="${b._id}" class="secondary">${b.status==='active'?'Disable':'Enable'}</button>
          <button data-del="${b._id}" class="secondary">Delete</button></td></tr>`).join('')}</table>`)}
      ${card(`<h3>Recent Users</h3><table class="table"><tr><th>User</th><th>Joined</th><th>Completed</th></tr>
          ${d.recentUsers.map(u=>`<tr><td>${u.firstName||''} @${u.username||'-'}</td><td>${u.joined?'✅':'❌'}</td><td>${u.completed?'✅':'❌'}</td></tr>`).join('')}
      </table><h3>Top Referrers</h3><ol>${leaderboard.map(x=>`<li>${x.firstName||x.username||x.userId} (${x.inviteCount})</li>`).join('')}</ol>`)}
    </div>
    ${api.botId ? renderBotTools() : ''}
  </div>`;

  botSelect.onchange = () => { api.botId = botSelect.value; localStorage.setItem('botId', api.botId); boot(); };
  refresh.onclick = boot;
  logout.onclick = () => { localStorage.clear(); location.reload(); };
  addBot.onclick = async () => { await api.request('/api/admin/bots', { method: 'POST', body: JSON.stringify({ name: botName.value, token: botToken.value }) }); boot(); };

  document.querySelectorAll('[data-toggle]').forEach((el) => el.onclick = async () => {
    const id = el.dataset.toggle; const b = bots.find(x=>x._id===id);
    await api.request(`/api/admin/bots/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: b.status==='active'?'disabled':'active' }) }); boot();
  });
  document.querySelectorAll('[data-del]').forEach((el) => el.onclick = async () => {
    await api.request(`/api/admin/bots/${el.dataset.del}`, { method: 'DELETE' }); if (api.botId===el.dataset.del) api.botId=null; boot();
  });

  bindBotTools();
}

function renderBotTools() {
  return `<div class="row">
    ${card(`<h3>Message Editor</h3><textarea id="messages" rows="10" placeholder='{"welcome":"..."}'></textarea><br/><br/><button id="saveMessages">Save Settings</button>`)}
    ${card(`<h3>Channel Manager</h3><input id="chId" placeholder="Channel ID (-100...)"/><br/><br/><input id="chUser" placeholder="Username"/><br/><br/><input id="chUrl" placeholder="Channel URL"/><br/><br/><button id="addCh">Add Channel</button><div id="chList"></div>`)}
    ${card(`<h3>Agent Manager</h3><input id="agentOne" placeholder="Single number"/><br/><br/><button id="addAgent">Add Number</button><br/><br/><textarea id="agentBulk" rows="6" placeholder="Bulk numbers, one per line"></textarea><br/><br/><button id="bulkAgent">Bulk Add</button><br/><br/><button id="clearAgent" class="secondary">Clear All</button><div id="agentList"></div>`)}
    ${card(`<h3>Broadcast</h3><textarea id="bcText" rows="4" placeholder="Broadcast message"></textarea><br/><br/><input id="bcImg" placeholder="Optional image URL"/><br/><br/><button id="sendBc">Send Broadcast</button><br/><br/><div class="progress"><div class="bar" id="bcBar"></div></div><p id="bcStat" class="muted"></p>`)}
  </div>`;
}

async function bindBotTools() {
  if (!api.botId) return;
  const settings = await api.request(`/api/admin/settings/${api.botId}`);
  const channels = await api.request(`/api/admin/channels/${api.botId}`);
  const agents = await api.request(`/api/admin/agents/${api.botId}`);

  messages.value = JSON.stringify(settings, null, 2);
  chList.innerHTML = `<table class="table">${channels.map(c=>`<tr><td>${c.channelId}</td><td>${c.username||'-'}</td><td>
    <button data-up="${c._id}" class="secondary">↑</button><button data-down="${c._id}" class="secondary">↓</button><button data-rmch="${c._id}" class="secondary">Del</button></td></tr>`).join('')}</table>`;
  agentList.innerHTML = `<table class="table">${agents.slice(0,20).map(a=>`<tr><td>${a.number}</td><td>${a.used?'USED':'FREE'}</td><td><button data-rmag="${a._id}" class="secondary">Del</button></td></tr>`).join('')}</table>`;

  saveMessages.onclick = async () => { await api.request(`/api/admin/settings/${api.botId}`, { method:'PUT', body: messages.value }); alert('Saved'); };
  addCh.onclick = async () => { await api.request(`/api/admin/channels/${api.botId}`, { method:'POST', body: JSON.stringify({ channelId: chId.value, username: chUser.value, url: chUrl.value }) }); boot(); };
  addAgent.onclick = async () => { await api.request(`/api/admin/agents/${api.botId}`, { method:'POST', body: JSON.stringify({ number: agentOne.value }) }); boot(); };
  bulkAgent.onclick = async () => { await api.request(`/api/admin/agents/${api.botId}/bulk`, { method:'POST', body: JSON.stringify({ lines: agentBulk.value }) }); boot(); };
  clearAgent.onclick = async () => { await api.request(`/api/admin/agents/${api.botId}`, { method:'DELETE' }); boot(); };

  document.querySelectorAll('[data-rmch]').forEach(el => el.onclick = async () => { await api.request(`/api/admin/channels/${api.botId}/${el.dataset.rmch}`, { method:'DELETE' }); boot(); });
  document.querySelectorAll('[data-rmag]').forEach(el => el.onclick = async () => { await api.request(`/api/admin/agents/${api.botId}/${el.dataset.rmag}`, { method:'DELETE' }); boot(); });
  document.querySelectorAll('[data-up],[data-down]').forEach(el => el.onclick = async () => {
    const ordered = [...channels]; const idx = ordered.findIndex(c => c._id === (el.dataset.up || el.dataset.down));
    const swap = el.dataset.up ? idx - 1 : idx + 1; if (swap < 0 || swap >= ordered.length) return;
    [ordered[idx], ordered[swap]] = [ordered[swap], ordered[idx]];
    await api.request(`/api/admin/channels/${api.botId}/reorder`, { method:'POST', body: JSON.stringify({ items: ordered.map(o => ({ id: o._id })) }) });
    boot();
  });

  sendBc.onclick = async () => {
    const { jobId } = await api.request(`/api/admin/broadcast/${api.botId}`, { method:'POST', body: JSON.stringify({ text: bcText.value, imageUrl: bcImg.value }) });
    const sse = new EventSource(`/api/admin/broadcast/${jobId}/stream`, { withCredentials: false });
    sse.onmessage = (event) => {
      const p = JSON.parse(event.data);
      bcBar.style.width = `${p.percent}%`;
      bcStat.textContent = `${p.percent}% | Success ${p.success} | Failed ${p.failed}`;
      if (p.percent >= 100) sse.close();
    };
  };
}

boot().catch((e)=>{ app.innerHTML = `<div class='container'>${card(`<h3>Error</h3><pre>${e.message}</pre>`)}</div>`; });
