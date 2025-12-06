const bridge = window.v2raynBridge ?? {};
const STORAGE_KEY = 'v2rayn-utools-settings';

const elements = {
  portInput: document.getElementById('portInput'),
  pathInput: document.getElementById('pathInput'),
  saveConfigBtn: document.getElementById('saveConfigBtn'),
  startHostBtn: document.getElementById('startHostBtn'),
  stopHostBtn: document.getElementById('stopHostBtn'),
  reloadCoreBtn: document.getElementById('reloadCoreBtn'),
  refreshStatusBtn: document.getElementById('refreshStatusBtn'),
  refreshProfilesBtn: document.getElementById('refreshProfilesBtn'),
  profileFilter: document.getElementById('profileFilter'),
  profileList: document.getElementById('profileList'),
  profilesEmpty: document.getElementById('profilesEmpty'),
  statusContent: document.getElementById('statusContent'),
  logView: document.getElementById('logView'),
  clearLogsBtn: document.getElementById('clearLogsBtn'),
  toast: document.getElementById('toast'),
  connectionBadge: document.getElementById('connectionBadge')
};

const state = {
  settings: loadSettings(),
  status: null,
  hostState: getHostState(),
  profiles: [],
  logs: [],
  lastServerLogId: 0,
  lastProcessLogId: 0,
  pollTimer: null
};

function loadSettings() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      port: parsed.port || 47721,
      executable: parsed.executable || getDefaultExecutable()
    };
  } catch (error) {
    console.warn('Failed to load settings', error);
    return { port: 47721, executable: getDefaultExecutable() };
  }
}

function saveSettings() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings));
}

function getDefaultExecutable() {
  return typeof bridge.getDefaultExecutable === 'function'
    ? bridge.getDefaultExecutable()
    : '';
}

function getHostState() {
  return typeof bridge.getHostState === 'function' ? bridge.getHostState() : { running: false };
}

function updateConnectionBadge(online) {
  elements.connectionBadge.textContent = online ? '已连接' : '已断开';
  elements.connectionBadge.classList.toggle('online', online);
}

function applySettingsToInputs() {
  elements.portInput.value = state.settings.port;
  elements.pathInput.value = state.settings.executable || '';
}

applySettingsToInputs();
updateConnectionBadge(false);

async function api(path, options = {}) {
  const target = `http://127.0.0.1:${state.settings.port}${path}`;
  const config = {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    ...options
  };
  try {
    if (config.body && typeof config.body !== 'string') {
      config.body = JSON.stringify(config.body);
    }
    const response = await fetch(target, config);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.message || '请求失败');
    }
    return response.json();
  } catch (error) {
    throw new Error(`无法连接宿主：${error.message}`);
  }
}

function showToast(message, type = 'info') {
  elements.toast.textContent = message;
  elements.toast.classList.remove('show', 'error', 'success');
  if (type === 'error') {
    elements.toast.classList.add('error');
  } else if (type === 'success') {
    elements.toast.classList.add('success');
  }
  elements.toast.classList.add('show');
  setTimeout(() => elements.toast.classList.remove('show'), 2600);
}

async function refreshStatus() {
  try {
    state.status = await api('/api/status');
    renderStatus();
    updateConnectionBadge(true);
  } catch (error) {
    state.status = null;
    renderStatus(error.message);
    updateConnectionBadge(false);
  }
}

async function refreshProfiles() {
  const keyword = elements.profileFilter.value.trim();
  const query = keyword ? `?q=${encodeURIComponent(keyword)}` : '';
  try {
    state.profiles = await api(`/api/profiles${query}`);
    renderProfiles();
  } catch (error) {
    state.profiles = [];
    renderProfiles();
    showToast(error.message, 'error');
  }
}

async function refreshLogs() {
  try {
    const serverLogs = await api(`/api/logs?after=${state.lastServerLogId}`);
    if (serverLogs.length) {
      state.lastServerLogId = serverLogs.at(-1).id;
    }
    const processLogs =
      typeof bridge.readLogs === 'function' ? bridge.readLogs(state.lastProcessLogId) : [];
    if (processLogs.length) {
      state.lastProcessLogId = processLogs.at(-1).id;
    }

    const normalized = [
      ...serverLogs.map((log) => ({
        id: `service-${log.id}`,
        source: 'Service',
        timestamp: log.timestamp,
        level: log.level || 'info',
        message: log.message
      })),
      ...processLogs.map((log) => ({
        id: `process-${log.id}`,
        source: 'Process',
        timestamp: log.timestamp,
        level: log.level || 'info',
        message: log.message
      }))
    ];

    if (normalized.length) {
      state.logs.push(...normalized);
      state.logs = state.logs.slice(-400);
      renderLogs();
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function renderStatus(errorMessage) {
  if (errorMessage) {
    elements.statusContent.innerHTML = `<p class="muted">${errorMessage}</p>`;
    return;
  }

  if (!state.status) {
    elements.statusContent.innerHTML = '<p class="muted">无法获取宿主状态。</p>';
    return;
  }

  const rows = [
    {
      label: '核心状态',
      value: state.status.coreRunning ? '运行中' : '已停止',
      badge: state.status.coreRunning ? 'online' : 'offline'
    },
    {
      label: '当前节点',
      value: state.status.activeProfileRemarks ? `${state.status.activeProfileRemarks}` : '未选择节点'
    },
    {
      label: 'Socks 端口',
      value: state.status.socksPort
    },
    {
      label: '状态端口',
      value: state.status.statePort
    },
    {
      label: '上次更新',
      value: new Date(state.status.updatedAt).toLocaleTimeString()
    }
  ];

  elements.statusContent.innerHTML = rows
    .map((row) => {
      const badge = row.badge
        ? `<span class="status-badge ${row.badge}">${row.value}</span>`
        : `<span>${row.value}</span>`;
      return `<div class="status-row"><span>${row.label}</span>${badge}</div>`;
    })
    .join('');
}

function renderProfiles() {
  elements.profileList.innerHTML = '';
  elements.profilesEmpty.style.display = state.profiles.length ? 'none' : 'block';
  if (!state.profiles.length) {
    return;
  }

  elements.profileList.innerHTML = state.profiles
    .map((profile) => {
      return `
        <li class="profile-item ${profile.isActive ? 'active' : ''}">
          <div>
            <div><strong>${profile.remarks}</strong></div>
            <div class="profile-meta">${profile.address}:${profile.port} · ${profile.configType}</div>
          </div>
          <div class="profile-actions">
            <span class="profile-meta">${profile.delay || ''}</span>
            <button class="ghost activate-btn" data-id="${profile.indexId}">
              ${profile.isActive ? '当前' : '设为默认'}
            </button>
          </div>
        </li>`;
    })
    .join('');
}

function renderLogs() {
  if (!state.logs.length) {
    elements.logView.textContent = '暂无日志';
    return;
  }

  const lines = state.logs
    .map((log) => {
      const level = log.level?.toLowerCase() || 'info';
      const time = new Date(log.timestamp || Date.now()).toLocaleTimeString();
      return `<div class="log-line"><span class="tag">[${time} ${log.source}]</span><span class="level-${level}">${log.message}</span></div>`;
    })
    .join('');

  elements.logView.innerHTML = lines;
  elements.logView.scrollTop = elements.logView.scrollHeight;
}

async function handleActivate(indexId) {
  try {
    const result = await api(`/api/profiles/${indexId}/activate`, { method: 'POST' });
    showToast(result.message, 'success');
    await refreshStatus();
    await refreshProfiles();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function startHost() {
  if (typeof bridge.startHost !== 'function') {
    showToast('当前环境不支持启动宿主', 'error');
    return;
  }
  try {
    const executable = state.settings.executable || getDefaultExecutable();
    state.settings.executable = executable;
    elements.pathInput.value = executable;
    saveSettings();
    bridge.startHost({
      port: state.settings.port,
      executablePath: executable
    });
    state.hostState = bridge.getHostState?.() ?? state.hostState;
    showToast('宿主已启动', 'success');
    refreshStatus();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function stopHost() {
  if (typeof bridge.stopHost !== 'function') {
    showToast('当前环境不支持停止宿主', 'error');
    return;
  }
  bridge.stopHost();
  state.hostState = bridge.getHostState?.() ?? state.hostState;
  showToast('宿主已停止', 'success');
  updateConnectionBadge(false);
}

async function reloadCore() {
  try {
    const result = await api('/api/core/reload', { method: 'POST' });
    showToast(result.message, 'success');
    await refreshStatus();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function startPolling() {
  if (state.pollTimer) {
    return;
  }
  state.pollTimer = setInterval(() => {
    refreshStatus();
    refreshProfiles();
    refreshLogs();
  }, 5000);
}

function stopPolling() {
  if (!state.pollTimer) {
    return;
  }
  clearInterval(state.pollTimer);
  state.pollTimer = null;
}

// Event bindings

elements.profileList.addEventListener('click', (event) => {
  const target = event.target;
  if (target.classList.contains('activate-btn')) {
    const indexId = target.getAttribute('data-id');
    if (indexId) {
      handleActivate(indexId);
    }
  }
});

elements.saveConfigBtn.addEventListener('click', () => {
  state.settings.port = Number(elements.portInput.value) || 47721;
  state.settings.executable = elements.pathInput.value.trim();
  saveSettings();
  showToast('配置已保存', 'success');
});

elements.startHostBtn.addEventListener('click', startHost);

elements.stopHostBtn.addEventListener('click', stopHost);

elements.reloadCoreBtn.addEventListener('click', reloadCore);

elements.refreshStatusBtn.addEventListener('click', () => {
  refreshStatus();
  refreshLogs();
});

elements.refreshProfilesBtn.addEventListener('click', refreshProfiles);

elements.clearLogsBtn.addEventListener('click', () => {
  state.logs = [];
  elements.logView.textContent = '日志已清空';
});

window.addEventListener('v2rayn:enter', () => {
  refreshStatus();
  refreshProfiles();
  refreshLogs();
  startPolling();
});

window.addEventListener('v2rayn:leave', () => {
  stopPolling();
});

window.addEventListener('v2rayn:host-log', (event) => {
  const entry = event.detail;
  if (!entry) {
    return;
  }
  state.logs.push({
    id: `process-${entry.id}`,
    source: 'Process',
    timestamp: entry.timestamp,
    level: entry.level,
    message: entry.message
  });
  state.logs = state.logs.slice(-400);
  renderLogs();
});

refreshStatus();
refreshProfiles();
refreshLogs();
startPolling();
