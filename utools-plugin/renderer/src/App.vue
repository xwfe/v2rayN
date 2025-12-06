<template>
  <div class="app-wrapper">
    <header class="app-header">
      <div class="brand">
        <img :src="logoUrl" alt="v2rayN" />
        <div>
          <h1>v2rayN 多核心调度</h1>
          <p>Node 调度器 · 贴近桌面版体验</p>
        </div>
      </div>
      <div class="header-actions">
        <a class="link" href="https://github.com/2dust/v2rayN/wiki" target="_blank" rel="noreferrer">官方 Wiki</a>
        <button class="primary" :disabled="isBusy" @click="startAll">启动全部核心</button>
        <button class="ghost" @click="stopAll">停止全部</button>
        <button @click="refreshAll">刷新状态</button>
      </div>
    </header>

    <section class="info-banner">
      <p>
        按照桌面版 v2rayN 习惯管理多核心与订阅：左侧为节点核心，右侧为订阅源；支持自动启动、批量刷新及日志追踪。
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
              <button class="ghost" @click="stopSelected" :disabled="!selectedCore || !selectedCore.running">停止</button>
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
                  <th style="width: 90px;">自动启动</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="core in filteredCores" :key="core.id" :class="{ active: core.id === selectedCoreId }" @click="selectCore(core.id)">
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
                    <small class="muted">{{ core.executable || core.relativeExecutable || '未配置' }}</small>
                  </td>
                  <td>
                    <span class="badge auto" v-if="core.autoStart">自动</span>
                    <span class="muted" v-else>手动</span>
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
          <div v-if="selectedCore && selectedForm" class="detail-wrapper">
            <div class="detail-header">
              <div>
                <h3>{{ selectedCore.name }}</h3>
                <div class="detail-meta">
                  <span class="badge" :class="selectedCore.running ? 'running' : 'stopped'">
                    {{ selectedCore.running ? '运行中' : '已停止' }}
                  </span>
                  <span class="badge auto" v-if="selectedForm.autoStart">自动启动</span>
                  <span class="muted">{{ selectedCore.category || '未知类型' }}</span>
                </div>
              </div>
              <div class="detail-actions">
                <button class="ghost" @click="openDoc(selectedCore.doc)" :disabled="!selectedCore.doc">查看文档</button>
                <button class="ghost" @click="resetForm" :disabled="!selectedForm.dirty">重置更改</button>
                <button class="primary" @click="saveSelected" :disabled="!selectedForm.dirty">保存配置</button>
              </div>
            </div>
            <div class="detail-form">
              <div class="field">
                <label>可执行文件</label>
                <input v-model="selectedForm.exec" @input="markDirty" placeholder="绝对或相对路径" />
              </div>
              <div class="field">
                <label>启动参数</label>
                <input v-model="selectedForm.args" @input="markDirty" placeholder="示例: run -c configs/xray.json" />
              </div>
              <div class="field">
                <label>自动启动</label>
                <label class="checkbox-inline">
                  <input type="checkbox" v-model="selectedForm.autoStart" @change="markDirty" />
                  <span>uTools 打开时自动启动该核心</span>
                </label>
              </div>
              <small class="muted" v-if="selectedCore.configHint">提示：{{ selectedCore.configHint }}</small>
            </div>
          </div>
          <div v-else class="muted">请选择左侧的核心以进行配置。</div>
        </section>
      </div>

      <section class="panel subscription-panel">
        <div class="panel-header">
          <strong>订阅管理</strong>
          <span class="muted">{{ subscriptions.length }} 个源</span>
        </div>
        <div class="subscription-layout">
          <div class="subscription-list">
            <div class="toolbar">
              <input v-model.trim="subKeyword" placeholder="搜索订阅名称 / 地址" />
              <div class="toolbar-actions">
                <button class="ghost" @click="beginCreateSubscription">新增</button>
                <button class="ghost" :disabled="!selectedSubscription" @click="refreshSelectedSubscription">刷新</button>
                <button class="ghost" :disabled="!subscriptions.length" @click="refreshAllSubscriptions">全部刷新</button>
              </div>
            </div>
            <div class="subscription-table-wrapper" v-if="filteredSubscriptions.length">
              <table class="subscription-table">
                <thead>
                  <tr>
                    <th>名称</th>
                    <th>状态</th>
                    <th>上次更新</th>
                    <th>节点数</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="sub in filteredSubscriptions"
                    :key="sub.id"
                    :class="{ active: sub.id === selectedSubscriptionId && !isCreatingSubscription }"
                    @click="selectSubscription(sub.id)"
                  >
                    <td>
                      <div>{{ sub.remarks }}</div>
                      <small class="muted">{{ sub.url }}</small>
                    </td>
                    <td>
                      <span class="badge" :class="sub.enabled ? 'running' : 'stopped'">
                        {{ sub.enabled ? '启用' : '停用' }}
                      </span>
                    </td>
                    <td>
                      <small class="muted">{{ sub.lastUpdated ? formatTime(sub.lastUpdated) : '未更新' }}</small>
                    </td>
                    <td>{{ sub.latestCount ?? 0 }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="muted" v-else>暂无订阅记录，点击右上角“新增”即可创建。</div>
          </div>

          <div class="subscription-detail" v-if="showSubscriptionForm">
            <h3>{{ isCreatingSubscription ? '新增订阅' : selectedSubscription?.remarks }}</h3>
            <div class="detail-meta">
              <span class="badge" :class="subscriptionForm.enabled ? 'running' : 'stopped'">
                {{ subscriptionForm.enabled ? '启用' : '停用' }}
              </span>
              <span class="muted" v-if="selectedSubscription?.lastError">错误：{{ selectedSubscription.lastError }}</span>
            </div>
            <div class="detail-form">
              <div class="field">
                <label>名称</label>
                <input v-model="subscriptionForm.remarks" @input="markSubscriptionDirty" placeholder="请输入订阅备注" />
              </div>
              <div class="field">
                <label>订阅地址</label>
                <input v-model="subscriptionForm.url" @input="markSubscriptionDirty" placeholder="https://..." />
              </div>
              <div class="field">
                <label>状态</label>
                <label class="checkbox-inline">
                  <input type="checkbox" v-model="subscriptionForm.enabled" @change="markSubscriptionDirty" />
                  <span>启用该订阅源</span>
                </label>
              </div>
              <div class="field">
                <label>代理请求</label>
                <label class="checkbox-inline">
                  <input type="checkbox" v-model="subscriptionForm.useProxy" @change="markSubscriptionDirty" />
                  <span>通过代理拉取</span>
                </label>
              </div>
              <div class="field" v-if="selectedSubscription?.latestPreview?.length">
                <label>最新节点（示例）</label>
                <div class="preview-list">
                  <code v-for="line in selectedSubscription.latestPreview" :key="line">{{ line }}</code>
                </div>
              </div>
            </div>
            <div class="detail-actions">
              <button class="ghost" @click="refreshSelectedSubscription" :disabled="isCreatingSubscription">刷新</button>
              <button class="ghost" @click="deleteSubscription" :disabled="isCreatingSubscription || !selectedSubscription">删除</button>
              <button class="primary" @click="saveSubscription" :disabled="!subscriptionFormDirty">保存</button>
            </div>
          </div>
          <div class="muted" v-else>请选择订阅或点击“新增”创建新的订阅源。</div>
        </div>
      </section>

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

type SubscriptionForm = {
  remarks: string;
  url: string;
  enabled: boolean;
  useProxy: boolean;
  dirty: boolean;
};

type ToastState = {
  show: boolean;
  message: string;
  type: 'info' | 'success' | 'error';
};

const bridge = window.v2raynBridge;

const cores = ref<CoreSnapshot[]>([]);
const subscriptions = ref<SubscriptionItem[]>([]);
const forms = reactive<Record<string, CoreForm>>({});
const logs = reactive<Record<string, LogEntryDto[]>>({ all: [] });
const logCursor = reactive<Record<string, number>>({ all: 0 });

const keyword = ref('');
const subKeyword = ref('');
const selectedCoreId = ref<string | null>(null);
const selectedSubscriptionId = ref<string | null>(null);
const isCreatingSubscription = ref(false);

const subscriptionForm = reactive<SubscriptionForm>({ remarks: '', url: '', enabled: true, useProxy: false, dirty: false });
const toast = reactive<ToastState>({ show: false, message: '', type: 'info' });
const isBusy = ref(false);
const activeLogScope = ref('all');

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
const enabledSubscriptionCount = computed(() => subscriptions.value.filter((sub) => sub.enabled).length);
const lastLog = computed(() => (logs.all.length ? logs.all[logs.all.length - 1] : null));

const summaryCards = computed(() => [
  {
    title: '运行中的核心',
    value: cores.value.length ? `${runningCount.value}/${cores.value.length}` : '0',
    hint: runningCount.value ? '保持运行，代理链路正常' : '全部核心已停止'
  },
  {
    title: '自动启动',
    value: cores.value.length ? `${autoStartCount.value}/${cores.value.length}` : '0',
    hint: '与桌面端一致的启动策略'
  },
  {
    title: '订阅源',
    value: subscriptions.value.length ? `${enabledSubscriptionCount.value}/${subscriptions.value.length}` : '0',
    hint: '启用 / 全部订阅源数量'
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

const filteredSubscriptions = computed(() => {
  if (!subKeyword.value.trim()) {
    return subscriptions.value;
  }
  const kw = subKeyword.value.trim().toLowerCase();
  return subscriptions.value.filter((item) => {
    return item.remarks.toLowerCase().includes(kw) || item.url.toLowerCase().includes(kw);
  });
});

const logScopes = computed(() => {
  const scopes = [{ value: 'all', label: '全部日志' }];
  cores.value.forEach((core) => scopes.push({ value: core.id, label: core.name }));
  subscriptions.value.forEach((sub) => scopes.push({ value: `subscription-${sub.id}`, label: `订阅-${sub.remarks}` }));
  return scopes;
});

const displayLogs = computed(() => logs[activeLogScope.value] ?? []);

const selectedCore = computed(() => (selectedCoreId.value ? cores.value.find((core) => core.id === selectedCoreId.value) ?? null : null));
const selectedForm = computed(() => (selectedCoreId.value ? forms[selectedCoreId.value] ?? null : null));
const selectedSubscription = computed(() => (selectedSubscriptionId.value ? subscriptions.value.find((item) => item.id === selectedSubscriptionId.value) ?? null : null));
const showSubscriptionForm = computed(() => isCreatingSubscription.value || Boolean(selectedSubscription.value));
const subscriptionFormDirty = computed(() => subscriptionForm.dirty && subscriptionForm.url.trim().length > 0);

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
  await loadSubscriptions();
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

const formatTime = (timestamp: number | string | Date | undefined | null) => {
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
    loadSubscriptions();
    refreshLogs('all');
  }, 6000);
};

const stopPolling = () => {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
};

const defaultSubscriptionForm = () => ({
  remarks: '',
  url: '',
  enabled: true,
  useProxy: false,
  dirty: false
});

const fillSubscriptionForm = (item?: SubscriptionItem | null) => {
  if (!item) {
    Object.assign(subscriptionForm, defaultSubscriptionForm());
    return;
  }
  Object.assign(subscriptionForm, {
    remarks: item.remarks,
    url: item.url,
    enabled: item.enabled,
    useProxy: item.useProxy,
    dirty: false
  });
};

const loadSubscriptions = async () => {
  try {
    const list = await callBridge<SubscriptionItem[]>('listSubscriptions');
    subscriptions.value = list;
    if (!list.length) {
      selectedSubscriptionId.value = null;
      activeLogScope.value = 'all';
      isCreatingSubscription.value = false;
      fillSubscriptionForm();
      return;
    }
    if (isCreatingSubscription.value) {
      return;
    }
    if (!selectedSubscriptionId.value || !list.some((sub) => sub.id === selectedSubscriptionId.value)) {
      selectedSubscriptionId.value = list[0].id;
      fillSubscriptionForm(list[0]);
    } else {
      const current = list.find((sub) => sub.id === selectedSubscriptionId.value);
      if (current) {
        fillSubscriptionForm(current);
      }
    }
  } catch (error) {
    showToast((error as Error).message, 'error');
  }
};

const beginCreateSubscription = () => {
  isCreatingSubscription.value = true;
  selectedSubscriptionId.value = null;
  activeLogScope.value = 'all';
  Object.assign(subscriptionForm, defaultSubscriptionForm(), { dirty: true });
};

const selectSubscription = (id: string) => {
  isCreatingSubscription.value = false;
  selectedSubscriptionId.value = id;
  const item = subscriptions.value.find((sub) => sub.id === id) ?? null;
  fillSubscriptionForm(item);
  ensureLogBucket(`subscription-${id}`);
  activeLogScope.value = `subscription-${id}`;
};

const markSubscriptionDirty = () => {
  subscriptionForm.dirty = true;
};

const saveSubscription = async () => {
  const remarks = subscriptionForm.remarks.trim();
  const url = subscriptionForm.url.trim();
  if (!url) {
    showToast('请填写订阅地址', 'error');
    return;
  }
  const payload = {
    remarks,
    url,
    enabled: subscriptionForm.enabled,
    useProxy: subscriptionForm.useProxy
  };
  try {
    if (isCreatingSubscription.value || !selectedSubscriptionId.value) {
      const created = await callBridge<SubscriptionItem>('createSubscription', payload);
      showToast('订阅已创建', 'success');
      isCreatingSubscription.value = false;
      selectedSubscriptionId.value = created.id;
    } else {
      await callBridge('updateSubscription', selectedSubscriptionId.value, payload);
      showToast('订阅已更新', 'success');
    }
    subscriptionForm.dirty = false;
    await loadSubscriptions();
  } catch (error) {
    showToast((error as Error).message, 'error');
  }
};

const deleteSubscription = async () => {
  if (!selectedSubscriptionId.value || isCreatingSubscription.value) {
    return;
  }
  try {
    await callBridge('deleteSubscription', selectedSubscriptionId.value);
    showToast('订阅已删除', 'success');
    selectedSubscriptionId.value = subscriptions.value.find((sub) => sub.id !== selectedSubscriptionId.value)?.id ?? null;
    await loadSubscriptions();
  } catch (error) {
    showToast((error as Error).message, 'error');
  }
};

const refreshSelectedSubscription = async () => {
  if (!selectedSubscriptionId.value) {
    showToast('请选择订阅', 'error');
    return;
  }
  try {
    await callBridge('refreshSubscription', selectedSubscriptionId.value);
    showToast('订阅已刷新', 'success');
    await loadSubscriptions();
  } catch (error) {
    showToast((error as Error).message, 'error');
  }
};

const refreshAllSubscriptions = async () => {
  if (!subscriptions.value.length) {
    return;
  }
  try {
    await callBridge('refreshAllSubscriptions');
    showToast('已刷新所有订阅', 'success');
    await loadSubscriptions();
  } catch (error) {
    showToast((error as Error).message, 'error');
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

const handleSubscriptionsEvent = (event: Event) => {
  const detail = (event as CustomEvent<SubscriptionItem[]>).detail;
  if (!Array.isArray(detail)) {
    return;
  }
  subscriptions.value = detail;
  if (!detail.length) {
    if (!isCreatingSubscription.value) {
      selectedSubscriptionId.value = null;
      fillSubscriptionForm();
    }
    return;
  }
  if (isCreatingSubscription.value) {
    return;
  }
  if (!selectedSubscriptionId.value) {
    selectSubscription(detail[0].id);
    return;
  }
  if (!detail.some((item) => item.id === selectedSubscriptionId.value)) {
    const fallback = detail[0]?.id;
    if (fallback) {
      selectSubscription(fallback);
    } else {
      selectedSubscriptionId.value = null;
      fillSubscriptionForm();
    }
  } else {
    const current = detail.find((item) => item.id === selectedSubscriptionId.value);
    if (current) {
      fillSubscriptionForm(current);
    }
  }
};

const handleSubscriptionLogEvent = (event: Event) => {
  const detail = (event as CustomEvent<LogEntryDto>).detail;
  if (detail) {
    const scope = detail.coreId ? detail.coreId : 'subscription';
    appendEntry(scope, detail);
    appendEntry('all', detail);
  }
};

const handleEnter = () => {
  loadCores();
  loadSubscriptions();
  refreshLogs('all');
  startPolling();
};

const handleLeave = () => {
  stopPolling();
};

onMounted(() => {
  window.addEventListener('v2rayn:core-log' as any, handleLogEvent as EventListener);
  window.addEventListener('v2rayn:core-status' as any, handleStatusEvent as EventListener);
  window.addEventListener('v2rayn:subscriptions' as any, handleSubscriptionsEvent as EventListener);
  window.addEventListener('v2rayn:subscription-log' as any, handleSubscriptionLogEvent as EventListener);
  window.addEventListener('v2rayn:enter' as any, handleEnter as EventListener);
  window.addEventListener('v2rayn:leave' as any, handleLeave as EventListener);
  loadCores();
  loadSubscriptions();
  refreshLogs('all');
  startPolling();
});

onUnmounted(() => {
  window.removeEventListener('v2rayn:core-log' as any, handleLogEvent as EventListener);
  window.removeEventListener('v2rayn:core-status' as any, handleStatusEvent as EventListener);
  window.removeEventListener('v2rayn:subscriptions' as any, handleSubscriptionsEvent as EventListener);
  window.removeEventListener('v2rayn:subscription-log' as any, handleSubscriptionLogEvent as EventListener);
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

watch(subscriptions, (list) => {
  if (!list.length) {
    selectedSubscriptionId.value = null;
    activeLogScope.value = 'all';
    if (!isCreatingSubscription.value) {
      fillSubscriptionForm();
    }
    return;
  }
  if (!isCreatingSubscription.value && (!selectedSubscriptionId.value || !list.some((item) => item.id === selectedSubscriptionId.value))) {
    selectSubscription(list[0].id);
  }
});
</script>
