const fs = require('fs');
const path = require('path');

class ConfigStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = { overrides: {} };
    this.#ensureFile();
  }

  #ensureFile() {
    try {
      if (!fs.existsSync(this.filePath)) {
        fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
        fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
      }
      const raw = fs.readFileSync(this.filePath, 'utf-8') || '{}';
      const parsed = JSON.parse(raw);
      this.data = {
        overrides: parsed.overrides ?? {}
      };
    } catch (error) {
      console.error('[ConfigStore]', error);
      this.data = { overrides: {} };
    }
  }

  #save() {
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
  }

  getOverride(id) {
    return this.data.overrides[id] ?? null;
  }

  setOverride(id, payload) {
    if (!payload || typeof payload !== 'object') {
      return;
    }
    this.data.overrides[id] = {
      ...(this.data.overrides[id] ?? {}),
      ...payload
    };
    this.#save();
  }

  removeOverride(id) {
    if (this.data.overrides[id]) {
      delete this.data.overrides[id];
      this.#save();
    }
  }
}

module.exports = ConfigStore;
