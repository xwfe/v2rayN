const path = require('path');
const CoreManager = require('./backend/coreManager');

const manager = new CoreManager({
  rootDir: __dirname,
  configPath: path.join(__dirname, 'backend', 'cores.config.json')
});

manager.on('log', (entry) => {
  window.dispatchEvent(new CustomEvent('v2rayn:core-log', { detail: entry }));
});

manager.on('status', (snapshot) => {
  window.dispatchEvent(new CustomEvent('v2rayn:core-status', { detail: snapshot }));
});

window.v2raynBridge = {
  listCores: () => manager.listCores(),
  startCore: (id) => manager.startCore(id),
  stopCore: (id) => manager.stopCore(id),
  restartCore: (id) => manager.restartCore(id),
  startAll: () => manager.startAll(),
  stopAll: () => manager.stopAll(),
  updateCoreConfig: (id, payload) => manager.updateCoreConfig(id, payload),
  readLogs: (coreId = 'all', after = 0) => manager.readLogs(coreId, after)
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
