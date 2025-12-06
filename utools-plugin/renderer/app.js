const bridge = window.v2raynBridge ?? {};

const elements = {
  coreList: document.getElementById('coreList'),
  coreCounter: document.getElementById('coreCounter'),
  startAllBtn: document.getElementById('startAllBtn'),
  stopAllBtn: document.getElementById('stopAllBtn'),
  refreshBtn: document.getElementById('refreshBtn'),
  logScope: document.getElementById('logScope'),
  logView: document.getElementById('logView'),
  refreshLogsBtn: document.getElementById('refreshLogsBtn'),
  clearLogsBtn: document.getElementById('clearLogsBtn'),
  toast: document.getElementById('toast')
};

const state = {
  cores: [],
  logs: { all: [] },
  logCursor: { all: 0 },
  activeLogScope: 'all',
  pollTimer: null
};

const html = {
  escape(text) {
    return `${text ?? ''}`
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },
  formatTime(timestamp) {
    if (!timestamp) {
      return '--:--:--';
    }
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  }
};

async function callBridge(method, ...args) {
  if (typeof bridge[method] !== 'function') {
    throw new Error('Node 调度器尚未就绪');
  }
  return bridge[method](...args);
}

function showToast(message, type = 'info') {
  if (!elements.toast) {
    return;
  }
  elements.toast.textContent = message;
  elements.toast.className = `toast show ${type}`;
  setTimeout(() => {
    elements.toast.classList.remove('show');
  }, 2500);
}

async function loadCores() {
  try {
    const cores = await callBridge('listCores');
    state.cores = cores ?? [];
    renderCores();
    updateLogScopeOptions();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function renderCores() {
  if (!state.cores.length) {
    elements.coreList.innerHTML = '<p class="muted">未检测到核心，请编辑 backend/cores.config.json。</p>';
    elements.coreCounter.textContent = '0/0 运行中';
    return;
  }

  const running = state.cores.filter((core) => core.running).length;
  elements.coreCounter.textContent = `${running}/${state.cores.length} 运行中`;

  elements.coreList.innerHTML = state.cores
    .map((core) => {
      const badgeCls = core.running ? 'badge running' : 'badge stopped';
      const badgeText = core.running ? '运行中' : '已停止';
      const docLink = core.doc ? `<a href="${html.escape(core.doc)}" target="_blank" rel="noreferrer">文档</a>` : '';
      return `
        <article class="core-card ${core.running ? 'running' : ''}" data-core="${core.id}">
          <header>
            <div>
              <div><strong>${html.escape(core.name)}</strong></div>
              <small class="muted">${html.escape(core.category ?? '')}</small>
            </div>
            <span class="${badgeCls}">${badgeText}</span>
          </header>
          <p>${html.escape(core.description ?? '')} ${docLink}</p>
          <div class="field-group">
            <div class="field">
              <label>可执行文件</label>
              <input type="text" class="core-exec" value="${html.escape(core.executable ?? core.relativeExecutable ?? '')}" placeholder="绝对或相对路径" />
            </div>
            <div class="field">
              <label>启动参数</label>
              <input type="text" class="core-args" value="${html.escape(core.argsLine ?? '')}" placeholder="示例: run -c configs/xray.json" />
            </div>
            <div class="field checkbox-inline">
              <input type="checkbox" class="core-autostart" id="auto-${core.id}" ${core.autoStart ? 'checked' : ''} />
              <label for="auto-${core.id}">随插件启动</label>
            </div>
          </div>
          ${core.configHint ? `<small class="muted">${html.escape(core.configHint)}</small>` : ''}
          <div class="core-actions">
            <button data-action="save">保存配置</button>
            <button data-action="start" class="primary">${core.running ? '重新启动' : '启动'}</button>
            <button data-action="stop" class="ghost" ${core.running ? '' : 'disabled'}>停止</button>
          </div>
        </article>
      `;
    })
    .join('');
}

function updateLogScopeOptions() {
  const current = state.activeLogScope;
  const options = ['all', ...state.cores.map((core) => core.id)];
  elements.logScope.innerHTML = options
    .map((value) => {
      const label = value === 'all' ? '全部核心' : state.cores.find((core) => core.id === value)?.name ?? value;
      const selected = value === current ? 'selected' : '';
      return `<option value="${value}" ${selected}>${html.escape(label)}</option>`;
    })
    .join('');
  if (!options.includes(current)) {
    state.activeLogScope = 'all';
  }
}

function pushLogEntry(entry) {
  if (!entry || !entry.id) {
    return;
  }
  const scope = entry.coreId ?? 'unknown';
  addLogToScope('all', entry);
  addLogToScope(scope, entry);
  if (state.activeLogScope === 'all' || state.activeLogScope === scope) {
    renderLogs();
  }
}

function addLogToScope(scope, entry) {
  const bucket = state.logs[scope] ?? [];
  bucket.push(entry);
  state.logs[scope] = bucket.slice(-500);
  state.logCursor[scope] = entry.id;
}

async function refreshLogs(scope = state.activeLogScope) {
  try {
    const cursor = state.logCursor[scope] ?? 0;
    const entries = await callBridge('readLogs', scope, cursor);
    if (entries?.length) {
      entries.forEach((entry) => addLogToScope(scope, entry));
      if (state.activeLogScope === scope) {
        renderLogs();
      }
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function renderLogs() {
  const buffer = state.logs[state.activeLogScope] ?? [];
  if (!buffer.length) {
    elements.logView.innerHTML = '<span class="muted">暂无日志</span>';
    return;
  }
  elements.logView.innerHTML = buffer
    .map((entry) => {
      const time = html.formatTime(entry.timestamp);
      const scope = entry.coreId ?? 'core';
      const level = entry.level?.toLowerCase() ?? 'info';
      return `<div class="log-line"><span class="tag">[${time} ${html.escape(scope)}]</span><span class="level-${level}">${html.escape(entry.message)}</span></div>`;
    })
    .join('');
  elements.logView.scrollTop = elements.logView.scrollHeight;
}

async function handleSave(id, card) {
  const execInput = card.querySelector('.core-exec');
  const argsInput = card.querySelector('.core-args');
  const autoCheckbox = card.querySelector('.core-autostart');
  try {
    const execValue = execInput?.value?.trim() ?? '';
    const argsValue = argsInput?.value?.trim() ?? '';
    const payload = {
      executable: execValue.length ? execValue : null,
      argsLine: argsValue.length ? argsValue : null,
      autoStart: Boolean(autoCheckbox?.checked)
    };
    const result = await callBridge('updateCoreConfig', id, payload);
    if (result?.success) {
      showToast(result.message, 'success');
      await loadCores();
    } else {
      showToast(result?.message ?? '保存失败', 'error');
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleStart(id) {
  const core = state.cores.find((item) => item.id === id);
  const method = core?.running ? 'restartCore' : 'startCore';
  try {
    const result = await callBridge(method, id);
    showToast(result?.message ?? '操作完成', result?.success ? 'success' : 'error');
    await loadCores();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleStop(id) {
  try {
    const result = await callBridge('stopCore', id);
    showToast(result?.message ?? '已停止', result?.success ? 'success' : 'error');
    await loadCores();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleStartAll() {
  try {
    const result = await callBridge('startAll');
    const successCount = result?.results?.filter((item) => item.success).length ?? 0;
    showToast(`启动完成：${successCount}/${state.cores.length}`, result?.success ? 'success' : 'error');
    await loadCores();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleStopAll() {
  try {
    await callBridge('stopAll');
    showToast('已发送全部停止命令', 'success');
    await loadCores();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function clearLogs(scope = state.activeLogScope) {
  state.logs[scope] = [];
  renderLogs();
}

function startPolling() {
  if (state.pollTimer) {
    return;
  }
  state.pollTimer = setInterval(() => {
    loadCores();
    refreshLogs(state.activeLogScope);
  }, 6000);
}

function stopPolling() {
  if (state.pollTimer) {
    clearInterval(state.pollTimer);
    state.pollTimer = null;
  }
}

function bindEvents() {
  elements.coreList.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) {
      return;
    }
    const action = button.dataset.action;
    if (!action || button.disabled) {
      return;
    }
    const card = button.closest('.core-card');
    const id = card?.dataset.core;
    if (!id) {
      return;
    }
    if (action === 'save') {
      handleSave(id, card);
    } else if (action === 'start') {
      handleStart(id);
    } else if (action === 'stop') {
      handleStop(id);
    }
  });

  elements.startAllBtn.addEventListener('click', handleStartAll);
  elements.stopAllBtn.addEventListener('click', handleStopAll);
  elements.refreshBtn.addEventListener('click', () => {
    loadCores();
    refreshLogs(state.activeLogScope);
  });

  elements.logScope.addEventListener('change', (event) => {
    state.activeLogScope = event.target.value;
    refreshLogs(state.activeLogScope);
    renderLogs();
  });

  elements.refreshLogsBtn.addEventListener('click', () => refreshLogs(state.activeLogScope));
  elements.clearLogsBtn.addEventListener('click', () => clearLogs(state.activeLogScope));

  window.addEventListener('v2rayn:core-log', (event) => pushLogEntry(event.detail));
  window.addEventListener('v2rayn:core-status', (event) => {
    if (Array.isArray(event.detail)) {
      state.cores = event.detail;
      renderCores();
      updateLogScopeOptions();
    }
  });

  window.addEventListener('v2rayn:enter', () => {
    loadCores();
    refreshLogs('all');
    startPolling();
  });

  window.addEventListener('v2rayn:leave', () => {
    stopPolling();
  });
}

async function bootstrap() {
  bindEvents();
  await loadCores();
  updateLogScopeOptions();
  await refreshLogs('all');
  renderLogs();
  startPolling();
}

bootstrap();
