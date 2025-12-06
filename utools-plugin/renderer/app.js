const {
  createApp,
  ref,
  reactive,
  computed,
  watch,
  onMounted,
  onUnmounted
} = window.Vue;

const bridge = window.v2raynBridge ?? {};

const callBridge = async (method, ...args) => {
  const fn = bridge?.[method];
  if (typeof fn !== 'function') {
    throw new Error('Node 调度器尚未就绪');
  }
  return await fn(...args);
};

const createForm = (core) => ({
  exec: core?.executable ?? core?.relativeExecutable ?? '',
  args: core?.argsLine ?? '',
  autoStart: Boolean(core?.autoStart),
  dirty: false
});

const ensureLogBucket = (logs, logCursor, scope) => {
  if (!logs[scope]) {
    logs[scope] = [];
  }
  if (logCursor[scope] === undefined) {
    logCursor[scope] = 0;
  }
};

const appendEntry = (logs, logCursor, scope, entry) => {
  ensureLogBucket(logs, logCursor, scope);
  const bucket = logs[scope];
  bucket.push(entry);
  if (bucket.length > 500) {
    bucket.splice(0, bucket.length - 500);
  }
  logCursor[scope] = entry.id;
};

const template = `
  <div class="app-wrapper">
    <header class="app-header">
      <div class="brand">
        <img src="../assets/logo.svg" alt="v2rayN" />
        <div>
          <h1>v2rayN 多核心调度</h1>
          <p>Node.js 调度器 + Electron 渲染 · uTools 插件</p>
        </div>
      </div>
      <div class="header-actions">
        <a class="link" href="https://github.com/2dust/v2rayN/wiki" target="_blank" rel="noreferrer">官方 Wiki</a>
        <button class="primary" @click="startAll" :disabled="isLoading">启动全部核心</button>
        <button class="ghost" @click="stopAll">停止全部</button>
        <button @click="refreshAll">刷新状态</button>
      </div>
    </header>

    <section class="info-banner">
      <p>
        将 v2rayN 生成的 Xray / sing-box / Clash / Hysteria 等配置放入 <code>cores</code> 目录，
        并在下方为每个核心设置可执行文件和参数，即可复现 Wiki 中的多核心方案。
      </p>
    </section>

    <main class="layout">
      <section class="card core-panel">
        <div class="card-header">
          <strong>核心列表</strong>
          <span class="muted">
            <template v-if="hasCores">{{ runningCount }}/{{ cores.length }} 运行中</template>
            <template v-else>0/0 运行中</template>
          </span>
        </div>
        <div class="core-list" v-if="hasCores">
          <article
            class="core-card"
            :class="{ running: core.running }"
            v-for="core in cores"
            :key="core.id"
          >
            <header>
              <div>
                <div><strong>{{ core.name }}</strong></div>
                <small class="muted">{{ core.category }}</small>
              </div>
              <span class="badge" :class="core.running ? 'running' : 'stopped'">
                {{ core.running ? '运行中' : '已停止' }}
              </span>
            </header>
            <p>
              {{ core.description }}
              <a v-if="core.doc" :href="core.doc" target="_blank" rel="noreferrer">文档</a>
            </p>
            <div class="field-group" v-if="forms[core.id]">
              <div class="field">
                <label>可执行文件</label>
                <input
                  type="text"
                  v-model="forms[core.id].exec"
                  @input="markFormDirty(core.id)"
                  placeholder="绝对或相对路径"
                />
              </div>
              <div class="field">
                <label>启动参数</label>
                <input
                  type="text"
                  v-model="forms[core.id].args"
                  @input="markFormDirty(core.id)"
                  placeholder="示例: run -c configs/xray.json"
                />
              </div>
              <div class="field checkbox-inline">
                <input
                  type="checkbox"
                  :id="'auto-' + core.id"
                  v-model="forms[core.id].autoStart"
                  @change="markFormDirty(core.id)"
                />
                <label :for="'auto-' + core.id">随插件启动</label>
              </div>
            </div>
            <small class="muted" v-if="core.configHint">{{ core.configHint }}</small>
            <div class="core-actions">
              <button @click="saveCore(core.id)" :disabled="!forms[core.id]">保存配置</button>
              <button class="primary" @click="startSingleCore(core)">
                {{ core.running ? '重新启动' : '启动' }}
              </button>
              <button class="ghost" @click="stopSingleCore(core)" :disabled="!core.running">停止</button>
            </div>
          </article>
        </div>
        <div class="muted" v-else>未检测到核心，请编辑 backend/cores.config.json。</div>
      </section>

      <section class="card log-panel">
        <div class="card-header">
          <strong>日志控制台</strong>
          <div class="card-actions">
            <select v-model="activeLogScope">
              <option v-for="scope in logScopes" :key="scope.value" :value="scope.value">
                {{ scope.label }}
              </option>
            </select>
            <button class="ghost" @click="manualRefreshLogs">刷新</button>
            <button class="ghost" @click="clearLogs">清空</button>
          </div>
        </div>
        <div class="log-view">
          <div v-if="!displayLogs.length" class="muted">暂无日志</div>
          <div v-else>
            <div class="log-line" v-for="entry in displayLogs" :key="entry.id + '-' + entry.coreId">
              <span class="tag">[{{ formatTime(entry.timestamp) }} {{ entry.coreId ?? 'core' }}]</span>
              <span :class="'level-' + (entry.level ? entry.level.toLowerCase() : 'info')">
                {{ entry.message }}
              </span>
            </div>
          </div>
        </div>
      </section>
    </main>

    <div
      class="toast"
      :class="{ show: toast.show, success: toast.type === 'success', error: toast.type === 'error' }"
      role="status"
    >
      {{ toast.message }}
    </div>
  </div>
`;

const app = createApp({
  template,
  setup() {
    const cores = ref([]);
    const forms = reactive({});
    const logs = reactive({ all: [] });
    const logCursor = reactive({ all: 0 });
    const activeLogScope = ref('all');
    const toast = reactive({ show: false, message: '', type: 'info' });
    const isLoading = ref(false);

    let pollTimer = null;
    let toastTimer = null;

    const showToast = (message, type = 'info') => {
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
    const hasCores = computed(() => cores.value.length > 0);
    const logScopes = computed(() => {
      const result = [{ value: 'all', label: '全部核心' }];
      cores.value.forEach((core) => {
        result.push({ value: core.id, label: core.name || core.id });
      });
      return result;
    });
    const displayLogs = computed(() => logs[activeLogScope.value] ?? []);

    const formatTime = (timestamp) => {
      if (!timestamp) {
        return '--:--:--';
      }
      return new Date(timestamp).toLocaleTimeString();
    };

    const syncForms = (list = []) => {
      const ids = new Set(list.map((item) => item.id));
      Object.keys(forms).forEach((key) => {
        if (!ids.has(key)) {
          delete forms[key];
        }
      });
      list.forEach((core) => {
        if (!forms[core.id] || !forms[core.id].dirty) {
          forms[core.id] = createForm(core);
        }
      });
    };

    const markFormDirty = (id) => {
      if (forms[id]) {
        forms[id].dirty = true;
      }
    };

    const loadCores = async () => {
      isLoading.value = true;
      try {
        const list = (await callBridge('listCores')) ?? [];
        cores.value = list;
        syncForms(list);
      } catch (error) {
        showToast(error.message, 'error');
      } finally {
        isLoading.value = false;
      }
    };

    const saveCore = async (id) => {
      const form = forms[id];
      if (!form) {
        return;
      }
      const payload = {
        executable: form.exec?.trim() ? form.exec.trim() : null,
        argsLine: form.args?.trim() ? form.args.trim() : null,
        autoStart: Boolean(form.autoStart)
      };
      try {
        const result = await callBridge('updateCoreConfig', id, payload);
        if (result?.success) {
          const snapshot = result.data;
          forms[id] = createForm(snapshot ?? cores.value.find((core) => core.id === id));
          showToast(result.message, 'success');
          await loadCores();
        } else {
          showToast(result?.message ?? '保存失败', 'error');
        }
      } catch (error) {
        showToast(error.message, 'error');
      }
    };

    const startSingleCore = async (core) => {
      if (!core) {
        return;
      }
      const method = core.running ? 'restartCore' : 'startCore';
      try {
        const result = await callBridge(method, core.id);
        showToast(result?.message ?? '操作完成', result?.success ? 'success' : 'error');
        await loadCores();
      } catch (error) {
        showToast(error.message, 'error');
      }
    };

    const stopSingleCore = async (core) => {
      if (!core?.running) {
        return;
      }
      try {
        const result = await callBridge('stopCore', core.id);
        showToast(result?.message ?? '已停止', result?.success ? 'success' : 'error');
        await loadCores();
      } catch (error) {
        showToast(error.message, 'error');
      }
    };

    const startAll = async () => {
      try {
        const result = await callBridge('startAll');
        const successCount = result?.results?.filter((item) => item.success).length ?? 0;
        showToast(`启动完成：${successCount}/${cores.value.length}`, result?.success ? 'success' : 'error');
        await loadCores();
      } catch (error) {
        showToast(error.message, 'error');
      }
    };

    const stopAll = async () => {
      try {
        await callBridge('stopAll');
        showToast('已发送全部停止命令', 'success');
        await loadCores();
      } catch (error) {
        showToast(error.message, 'error');
      }
    };

    const refreshAll = async () => {
      await loadCores();
      await refreshLogs(activeLogScope.value);
    };

    const pushLogEntry = (entry) => {
      if (!entry || entry.id === undefined) {
        return;
      }
      appendEntry(logs, logCursor, 'all', entry);
      appendEntry(logs, logCursor, entry.coreId ?? 'unknown', entry);
    };

    const refreshLogs = async (scope = activeLogScope.value) => {
      ensureLogBucket(logs, logCursor, scope);
      const cursor = logCursor[scope] ?? 0;
      try {
        const entries = await callBridge('readLogs', scope, cursor);
        if (entries?.length) {
          entries.forEach((entry) => {
            appendEntry(logs, logCursor, scope, entry);
            if (scope === 'all') {
              appendEntry(logs, logCursor, entry.coreId ?? 'unknown', entry);
            } else {
              appendEntry(logs, logCursor, 'all', entry);
            }
          });
        }
      } catch (error) {
        showToast(error.message, 'error');
      }
    };

    const manualRefreshLogs = () => {
      refreshLogs(activeLogScope.value);
    };

    const clearLogs = () => {
      const scope = activeLogScope.value;
      ensureLogBucket(logs, logCursor, scope);
      logs[scope] = [];
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

    const handleLogEvent = (event) => pushLogEntry(event.detail);
    const handleStatusEvent = (event) => {
      if (Array.isArray(event.detail)) {
        cores.value = event.detail;
        syncForms(event.detail);
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
      window.addEventListener('v2rayn:core-log', handleLogEvent);
      window.addEventListener('v2rayn:core-status', handleStatusEvent);
      window.addEventListener('v2rayn:enter', handleEnter);
      window.addEventListener('v2rayn:leave', handleLeave);
      loadCores();
      refreshLogs('all');
      startPolling();
    });

    onUnmounted(() => {
      window.removeEventListener('v2rayn:core-log', handleLogEvent);
      window.removeEventListener('v2rayn:core-status', handleStatusEvent);
      window.removeEventListener('v2rayn:enter', handleEnter);
      window.removeEventListener('v2rayn:leave', handleLeave);
      stopPolling();
      if (toastTimer) {
        clearTimeout(toastTimer);
      }
    });

    watch(activeLogScope, (scope) => {
      ensureLogBucket(logs, logCursor, scope);
      refreshLogs(scope);
    });

    watch(cores, (list) => {
      syncForms(list ?? []);
      if (activeLogScope.value !== 'all' && !list.some((core) => core.id === activeLogScope.value)) {
        activeLogScope.value = 'all';
      }
    });

    return {
      cores,
      forms,
      toast,
      isLoading,
      runningCount,
      hasCores,
      logScopes,
      activeLogScope,
      displayLogs,
      formatTime,
      markFormDirty,
      saveCore,
      startSingleCore,
      stopSingleCore,
      startAll,
      stopAll,
      refreshAll,
      manualRefreshLogs,
      clearLogs
    };
  }
});

app.mount('#app');
