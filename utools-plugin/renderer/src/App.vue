<template>
  <div class="app-wrapper">
    <header class="app-header">
      <div class="brand">
        <img :src="logoUrl" alt="v2rayN" />
        <div>
          <h1>v2rayN 多核心调度</h1>
          <p>Node 调度器 · 贴近桌面版 UI 的体验</p>
        </div>
      </div>
      <div class="header-actions">
        <a class="link" href="https://github.com/2dust/v2rayN/wiki" target="_blank" rel="noreferrer">
          官方 Wiki
        </a>
        <button class="primary" :disabled="isBusy" @click="startAll">启动全部核心</button>
        <button class="ghost" @click="stopAll">停止全部</button>
        <button @click="refreshAll">刷新状态</button>
      </div>
    </header>

    <section class="info-banner">
      <p>
        将 v2rayN 生成的 Xray / sing-box / Clash / Hysteria 等配置放入 <code>cores</code> 目录，并可在右侧面板维护执行文件、参数与自动启动策略。
      </p>
    </section>

    <section class="main-panel">
      <div class="summary-grid">
        <div class="summary-card" v-for="card in summaryCards" :key="card.title">
          <strong>{{ card.value }}</strong>
          <span>{{ card.title }}</span>
          <small class="muted">{{ card.hint }}</small>
        </div>
      </div>

      <div class="board-layout">
        <section class="panel">
          <div class="panel-header">
            <strong>核心列表</strong>
            <span class="muted" v-if="cores.length">共 {{ cores.length }} 个核心</span>
          </div>

          <div class="toolbar">
            <input v-model.trim="keyword" placeholder="搜索核心名称 / 描述" />
            <div class="toolbar-actions">
              <button class="ghost" @click="startSelected" :disabled="!selectedCore">启动</button>
              <button class="ghost" @click="restartSelected" :disabled="!selectedCore">重启</button>
              <button class="ghost" @click="stopSelected" :disabled="!selectedCore || !selectedCore?.running">停止</button>
            </div>
          </div>

          <div class="core-table-wrapper" v-if="filteredCores.length">
            <table class="core-table">
              <thead>
                <tr>
                  <th>状态</th>
                  <th>核心名称</th>
                  <th>类型</th>
                  <th>路径</th>
                  <th style="width: 80px;">自动启动</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="core in filteredCores"
                  :key="core.id"
                  :class="{ active: core.id === selectedCoreId }"
                  @click="selectCore(core.id)"
                >
                  <td>
                    <span class="badge" :class="core.running ? 'running' : 'stopped'">
                      {{ core.running ? '运行中' : '已停止' }}
                    </span>
                  </td>
                  <td>
                    <div>{{ core.name }}</div>
                    <small class="muted">{{ core.description }}</small>
                  </td>
                  <td>{{ core.category || '--' }}</td>
                  <td>
                    <small class="muted">
                      {{ core.executable || core.relativeExecutable || '未配置' }}
                    </small>
                  </td>
                  <td>
                    <span class="badge auto" v-if="core.autoStart">自动</span>
                    <span v-else class="muted">手动</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="muted" v-else>未找到匹配的核心，请尝试调整搜索条件。</div>
        </section>

        <section class="panel detail-panel">
          <div class="panel-header">
            <strong>核心详情</strong>
            <span class="muted" v-if="selectedCore">PID：{{ selectedCore.pid ?? '—' }}</span>
          </div>

          <div v-if="selectedCore" class="detail-wrapper">
            <div class="detail-header">
              <div>
                <h3>{{ selectedCore.name }}</h3>
                <div class="detail-meta">
                  <span class="badge" :class="selectedCore.running ? 'running' : 'stopped'">
                    {{ selectedCore.running ? '运行中' : '已停止' }}
                  </span>
                  <span class="badge auto" v-if="selectedForm?.autoStart">自动启动</span>
                  <span class="muted">{{ selectedCore.category || '未知类型' }}</span>
                </div>
              </div>
              <div class="detail-actions">
                <button class="ghost" @click="openDoc(selectedCore.doc)" :disabled="!selectedCore.doc">查看文档</button>
                <button class="ghost" @click="resetForm" :disabled="!selectedForm?.dirty">重置更改</button>
                <button class="primary" @click="saveSelected" :disabled="!selectedForm?.dirty">保存配置</button>
              </div>
            </div>

            <div class="detail-form" v-if="selectedForm">
              <div class="field">
                <label>可执行文件</label>
                <input v-model="selectedForm.exec" @input="markDirty" placeholder="绝对或相对路径" />
              </div>
              <div class="field">
                <label>启动参数</label>
                <input v-model="selectedForm.args" @input="markDirty" placeholder="例如: run -c configs/xray.json" />
              </div>
              <div class="field">
                <label>自动启动</label>
                <div class="detail-meta">
                  <label class="checkbox-inline">
                    <input type="checkbox" v-model="selectedForm.autoStart" @change="markDirty" />
                    <span>uTools 打开时自动启动该核心</span>
                  </label>
                </div>
              </div>
              <small class="muted" v-if="selectedCore.configHint">提示：{{ selectedCore.configHint }}</small>
            </div>
          </div>
          <div v-else class="muted">请选择左侧的核心以进行配置。</div>
        </section>
      </div>

      <section class="panel logs-panel">
        <div class="panel-header">
          <strong>日志控制台</strong>
          <span class="muted">{{ displayLogs.length }} 条记录</span>
        </div>
        <div class="log-toolbar">
          <select v-model="activeLogScope">
            <option v-for="scope in logScopes" :key="scope.value" :value="scope.value">{{ scope.label }}</option>
          </select>
          <button class="ghost" @click="manualRefreshLogs">刷新日志</button>
          <button class="ghost" @click="clearLogs">清空日志</button>
        </div>
        <div class="log-view">
          <div v-if="!displayLogs.length" class="muted">暂无日志</div>
          <div v-else>
            <div class="log-line" v-for="entry in displayLogs" :key="entry.id + entry.coreId">
              <span class="tag">[{{ formatTime(entry.timestamp) }} {{ entry.coreId ?? 'core' }}]</span>
              <span :class="'level-' + (entry.level ? entry.level.toLowerCase() : 'info')">{{ entry.message }}</span>
            </div>
          </div>
        </div>
      </section>
    </section>

    <div class="toast" :class="{ show: toast.show, success: toast.type === 'success', error: toast.type === 'error' }">{{ toast.message }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import logoUrl from './assets/logo.svg';

type CoreForm = {
  exec: string;
  args: string;
  autoStart: boolean;
  dirty: boolean;
};

type ToastState = {
  show: boolean;
  message: string;
  type: 'info' | 'success' | 'error';
};

const bridge = window.v2raynBridge;

const cores = ref<CoreSnapshot[]>([]);
const forms = reactive<Record<string, CoreForm>>({});
const logs = reactive<Record<string, LogEntryDto[]>>({ all: [] });
const logCursor = reactive<Record<string, number>>({ all: 0 });
const keyword = ref('');
const selectedCoreId = ref<string | null>(null);
const activeLogScope = ref('all');
const toast = reactive<ToastState>({ show: false, message: '', type: 'info' });
const isBusy = ref(false);

let pollTimer: ReturnType<typeof setInterval> | null = null;
let toastTimer: ReturnType<typeof setTimeout> | null = null;

const callBridge = async <T = unknown>(method: keyof V2rayNBridge, ...args: unknown[]): Promise<T> => {
  if (!bridge || typeof bridge[method] !== 'function') {
    throw new Error('Node 调度器尚未就绪');
  }
  return (await bridge[method](...(args as never[]))) as T;
};

const showToast = (message: string, type: ToastState['type'] = 'info') => {
  toast.message = message;
  toast.type = type;
  toast.show = true;
  if (toastTimer) {
    clearTimeout(toastTimer);
  }
  toastTimer = setTimeout(() => {
    toast.show = false;
  }, 2400);
};

const runningCount = computed(() => cores.value.filter((core) => core.running).length);
const autoStartCount = computed(() => cores.value.filter((core) => core.autoStart).length);
const lastLog = computed(() => (logs.all.length ? logs.all[logs.all.length - 1] : null));

const summaryCards = computed(() => [
  {
    title: '运行中的核心',
    value: cores.value.length ? `${runningCount.value}/${cores.value.length}` : '0',
    hint: runningCount.value ? '保持运行，保证代理链路正常' : '全部核心已停止'
  },
  {
    title: '自动启动',
    value: cores.value.length ? `${autoStartCount.value}/${cores.value.length}` : '0',
    hint: '与桌面端一致的启动策略'
  },
  {
    title: '最新日志',
    value: lastLog.value ? formatTime(lastLog.value.timestamp) : '--:--:--',
    hint: lastLog.value?.message ?? '暂无日志'
  }
]);

const filteredCores = computed(() => {
  if (!keyword.value.trim()) {
    return cores.value;
  }
  const kw = keyword.value.trim().toLowerCase();
  return cores.value.filter((core) => {
    return (
      core.name.toLowerCase().includes(kw) ||
      (core.description && core.description.toLowerCase().includes(kw)) ||
      (core.category && core.category.toLowerCase().includes(kw))
    );
  });
});

const logScopes = computed(() => {
  const scopes = [{ value: 'all', label: '全部核心' }];
  cores.value.forEach((core) => scopes.push({ value: core.id, label: core.name }));
  return scopes;
});

const displayLogs = computed(() => logs[activeLogScope.value] ?? []);

const selectedCore = computed(() => (selectedCoreId.value ? cores.value.find((core) => core.id === selectedCoreId.value) ?? null : null));
const selectedForm = computed(() => (selectedCoreId.value ? forms[selectedCoreId.value] ?? null : null));

const ensureLogBucket = (scope: string) => {
  if (!logs[scope]) {
    logs[scope] = [];
  }
  if (logCursor[scope] === undefined) {
    logCursor[scope] = 0;
  }
};

const appendEntry = (scope: string, entry: LogEntryDto) => {
  ensureLogBucket(scope);
  logs[scope].push(entry);
  if (logs[scope].length > 500) {
    logs[scope].splice(0, logs[scope].length - 500);
  }
  logCursor[scope] = entry.id;
};

const syncForms = (list: CoreSnapshot[]) => {
  const ids = new Set(list.map((core) => core.id));
  Object.keys(forms).forEach((id) => {
    if (!ids.has(id)) {
      delete forms[id];
    }
  });
  list.forEach((core) => {
    if (!forms[core.id] || !forms[core.id].dirty) {
      forms[core.id] = {
        exec: core.executable ?? core.relativeExecutable ?? '',
        args: core.argsLine ?? '',
        autoStart: Boolean(core.autoStart),
        dirty: false
      };
    }
  });
};

const selectCore = (id: string | null) => {
  selectedCoreId.value = id;
  if (id) {
    ensureLogBucket(id);
    activeLogScope.value = id;
  } else {
    activeLogScope.value = 'all';
  }
};

const markDirty = () => {
  if (selectedCoreId.value && forms[selectedCoreId.value]) {
    forms[selectedCoreId.value].dirty = true;
  }
};

const loadCores = async () => {
  isBusy.value = true;
  try {
    const data = await callBridge<CoreSnapshot[]>('listCores');
    cores.value = data;
    syncForms(data);
    if (!selectedCoreId.value && data.length) {
      selectCore(data[0].id);
    } else if (selectedCoreId.value && !data.some((core) => core.id === selectedCoreId.value)) {
      selectCore(data[0]?.id ?? null);
    }
  } catch (error) {
    showToast((error as Error).message, 'error');
  } finally {
    isBusy.value = false;
  }
};

const saveSelected = async () => {
  if (!selectedCoreId.value || !selectedForm.value) {
    return;
  }
  const form = selectedForm.value;
  const payload = {
    executable: form.exec?.trim() ? form.exec.trim() : null,
    argsLine: form.args?.trim() ? form.args.trim() : null,
    autoStart: form.autoStart
  };
  try {
    const result = await callBridge<BridgeResult<CoreSnapshot>>('updateCoreConfig', selectedCoreId.value, payload);
    showToast(result.message ?? '配置已更新', result.success ? 'success' : 'error');
    await loadCores();
  } catch (error) {
    showToast((error as Error).message, 'error');
  }
};

const resetForm = () => {
  if (!selectedCore.value || !selectedCoreId.value) {
    return;
  }
  forms[selectedCoreId.value] = {
    exec: selectedCore.value.executable ?? selectedCore.value.relativeExecutable ?? '',
    args: selectedCore.value.argsLine ?? '',
    autoStart: Boolean(selectedCore.value.autoStart),
    dirty: false
  };
};

const openDoc = (doc?: string) => {
  if (doc) {
    window.open(doc, '_blank');
  }
};

const startSingle = async (core: CoreSnapshot | null, action: 'startCore' | 'restartCore') => {
  if (!core) {
    return;
  }
  try {
    const result = await callBridge<BridgeResult>(action, core.id);
    showToast(result.message ?? '操作完成', result.success ? 'success' : 'error');
    await loadCores();
  } catch (error) {
    showToast((error as Error).message, 'error');
  }
};

const stopSingle = async (core: CoreSnapshot | null) => {
  if (!core?.id) {
    return;
  }
  try {
    const result = await callBridge<BridgeResult>('stopCore', core.id);
    showToast(result.message ?? '已停止', result.success ? 'success' : 'error');
    await loadCores();
  } catch (error) {
    showToast((error as Error).message, 'error');
  }
};

const startSelected = () => startSingle(selectedCore.value, selectedCore.value?.running ? 'restartCore' : 'startCore');
const restartSelected = () => startSingle(selectedCore.value, 'restartCore');
const stopSelected = () => stopSingle(selectedCore.value);

const startAll = async () => {
  try {
    const result = await callBridge<BridgeResult>('startAll');
    showToast(result.message ?? '已发送启动命令', result.success ? 'success' : 'error');
    await loadCores();
  } catch (error) {
    showToast((error as Error).message, 'error');
  }
};

const stopAll = async () => {
  try {
    await callBridge('stopAll');
    showToast('已发送全部停止命令', 'success');
    await loadCores();
  } catch (error) {
    showToast((error as Error).message, 'error');
  }
};

const refreshAll = async () => {
  await loadCores();
  await refreshLogs(activeLogScope.value);
};

const handleFetchedEntries = (scope: string, entries: LogEntryDto[]) => {
  entries.forEach((entry) => appendEntry(scope, entry));
  if (scope === 'all') {
    entries.forEach((entry) => appendEntry(entry.coreId ?? 'unknown', entry));
  }
};

const refreshLogs = async (scope: string) => {
  ensureLogBucket(scope);
  const cursor = logCursor[scope] ?? 0;
  try {
    const entries = await callBridge<LogEntryDto[]>('readLogs', scope, cursor);
    if (entries?.length) {
      handleFetchedEntries(scope, entries);
    }
  } catch (error) {
    showToast((error as Error).message, 'error');
  }
};

const manualRefreshLogs = () => refreshLogs(activeLogScope.value);

const clearLogs = () => {
  const scope = activeLogScope.value;
  logs[scope] = [];
  logCursor[scope] = 0;
};

const formatTime = (timestamp: number | Date | undefined | null) => {
  if (!timestamp) {
    return '--:--:--';
  }
  return new Date(timestamp).toLocaleTimeString();
};

const pushLogEntry = (entry: LogEntryDto) => {
  if (!entry || entry.id === undefined) {
    return;
  }
  appendEntry('all', entry);
  appendEntry(entry.coreId ?? 'unknown', entry);
};

const startPolling = () => {
  if (pollTimer) {
    return;
  }
  pollTimer = setInterval(() => {
    loadCores();
    refreshLogs('all');
  }, 6000);
};

const stopPolling = () => {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
};

const handleLogEvent = (event: Event) => {
  const detail = (event as CustomEvent<LogEntryDto>).detail;
  if (detail) {
    pushLogEntry(detail);
  }
};

const handleStatusEvent = (event: Event) => {
  const detail = (event as CustomEvent<CoreSnapshot[]>).detail;
  if (Array.isArray(detail)) {
    cores.value = detail;
    syncForms(detail);
  }
};

const handleEnter = () => {
  loadCores();
  refreshLogs('all');
  startPolling();
};

const handleLeave = () => {
  stopPolling();
};

onMounted(() => {
  window.addEventListener('v2rayn:core-log' as any, handleLogEvent as EventListener);
  window.addEventListener('v2rayn:core-status' as any, handleStatusEvent as EventListener);
  window.addEventListener('v2rayn:enter' as any, handleEnter as EventListener);
  window.addEventListener('v2rayn:leave' as any, handleLeave as EventListener);
  loadCores();
  refreshLogs('all');
  startPolling();
});

onUnmounted(() => {
  window.removeEventListener('v2rayn:core-log' as any, handleLogEvent as EventListener);
  window.removeEventListener('v2rayn:core-status' as any, handleStatusEvent as EventListener);
  window.removeEventListener('v2rayn:enter' as any, handleEnter as EventListener);
  window.removeEventListener('v2rayn:leave' as any, handleLeave as EventListener);
  stopPolling();
  if (toastTimer) {
    clearTimeout(toastTimer);
  }
});

watch(activeLogScope, (scope) => {
  ensureLogBucket(scope);
  refreshLogs(scope);
});

watch(cores, (list) => {
  if (!list.length) {
    selectCore(null);
    return;
  }
  if (!selectedCoreId.value || !list.some((core) => core.id === selectedCoreId.value)) {
    selectCore(list[0].id);
  }
});
</script>
