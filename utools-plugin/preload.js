const path = require('path');
const CoreManager = require('./backend/coreManager');
const SubscriptionManager = require('./backend/subscriptionManager');

const manager = new CoreManager({
  rootDir: __dirname,
  configPath: path.join(__dirname, 'backend', 'cores.config.json')
});

const subscriptionManager = new SubscriptionManager({ rootDir: __dirname });
let subscriptionLogSeq = 0;

manager.on('log', (entry) => {
  window.dispatchEvent(new CustomEvent('v2rayn:core-log', { detail: entry }));
});

manager.on('status', (snapshot) => {
  window.dispatchEvent(new CustomEvent('v2rayn:core-status', { detail: snapshot }));
});

subscriptionManager.on('change', (items) => {
  window.dispatchEvent(new CustomEvent('v2rayn:subscriptions', { detail: items }));
});

subscriptionManager.on('log', (entry) => {
  const detail = {
    id: ++subscriptionLogSeq,
    coreId: entry.scope ?? 'subscription',
    level: entry.level ?? 'info',
    message: entry.message,
    timestamp: Date.now()
  };
  window.dispatchEvent(new CustomEvent('v2rayn:subscription-log', { detail }));
});

window.v2raynBridge = {
  listCores: () => manager.listCores(),
  startCore: (id) => manager.startCore(id),
  stopCore: (id) => manager.stopCore(id),
  restartCore: (id) => manager.restartCore(id),
  startAll: () => manager.startAll(),
  stopAll: () => manager.stopAll(),
  updateCoreConfig: (id, payload) => manager.updateCoreConfig(id, payload),
  readLogs: (coreId = 'all', after = 0) => manager.readLogs(coreId, after),
  listSubscriptions: () => subscriptionManager.list(),
  createSubscription: (payload) => subscriptionManager.create(payload),
  updateSubscription: (id, payload) => subscriptionManager.update(id, payload),
  deleteSubscription: (id) => subscriptionManager.remove(id),
  refreshSubscription: (id) => subscriptionManager.refresh(id),
  refreshAllSubscriptions: () => subscriptionManager.refreshAll()
};

window.exports = {
  v2rayn: {
    enter(action) {
      window.dispatchEvent(new CustomEvent('v2rayn:enter', { detail: action }));
    },
    leave() {
      window.dispatchEvent(new Event('v2rayn:leave'));
    }
  }
};
