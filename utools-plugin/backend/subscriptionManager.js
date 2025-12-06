const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { randomUUID } = require('crypto');

class SubscriptionManager extends EventEmitter {
  constructor(options) {
    super();
    this.rootDir = options.rootDir;
    this.filePath = path.join(this.rootDir, 'backend', 'subscriptions.json');
    this.data = { items: [] };
    this.#load();
  }

  #load() {
    try {
      if (!fs.existsSync(this.filePath)) {
        this.#save();
        return;
      }
      const raw = fs.readFileSync(this.filePath, 'utf-8') || '{}';
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        this.data.items = parsed;
      } else if (Array.isArray(parsed.items)) {
        this.data.items = parsed.items;
      }
    } catch (error) {
      console.error('[SubscriptionManager] Failed to load file', error);
      this.data = { items: [] };
    }
  }

  #save() {
    try {
      const folder = path.dirname(this.filePath);
      if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify({ items: this.data.items }, null, 2));
    } catch (error) {
      console.error('[SubscriptionManager] Failed to save file', error);
    }
  }

  #emitChange() {
    this.emit('change', this.list());
  }

  list() {
    return this.data.items.map((item) => ({ ...item }));
  }

  create(payload = {}) {
    const url = (payload.url || '').trim();
    if (!url) {
      throw new Error('订阅地址不能为空');
    }
    const id = randomUUID();
    const item = {
      id,
      remarks: payload.remarks?.trim() || `订阅-${this.data.items.length + 1}`,
      url,
      enabled: payload.enabled !== undefined ? Boolean(payload.enabled) : true,
      useProxy: Boolean(payload.useProxy),
      lastUpdated: null,
      lastError: null,
      latestCount: 0,
      latestPreview: []
    };
    this.data.items.push(item);
    this.#save();
    this.#emitChange();
    this.emit('log', { message: `新增订阅：${item.remarks}`, level: 'info', scope: `subscription-${item.id}` });
    return item;
  }

  update(id, payload = {}) {
    const item = this.data.items.find((sub) => sub.id === id);
    if (!item) {
      throw new Error('未找到订阅');
    }
    if (payload.remarks !== undefined) {
      item.remarks = payload.remarks.trim() || item.remarks;
    }
    if (payload.url !== undefined) {
      const url = payload.url.trim();
      if (!url) {
        throw new Error('订阅地址不能为空');
      }
      item.url = url;
    }
    if (payload.enabled !== undefined) {
      item.enabled = Boolean(payload.enabled);
    }
    if (payload.useProxy !== undefined) {
      item.useProxy = Boolean(payload.useProxy);
    }
    this.#save();
    this.#emitChange();
    this.emit('log', { message: `更新订阅：${item.remarks}`, level: 'info', scope: `subscription-${item.id}` });
    return item;
  }

  remove(id) {
    const index = this.data.items.findIndex((sub) => sub.id === id);
    if (index < 0) {
      throw new Error('未找到订阅');
    }
    const [removed] = this.data.items.splice(index, 1);
    this.#save();
    this.#emitChange();
    this.emit('log', { message: `删除订阅：${removed.remarks}`, level: 'warn', scope: `subscription-${removed.id}` });
    return removed;
  }

  async refresh(id) {
    const item = this.data.items.find((sub) => sub.id === id);
    if (!item) {
      throw new Error('未找到订阅');
    }
    try {
      await this.#fetchAndUpdate(item);
      item.lastError = null;
    } catch (error) {
      item.lastError = error.message;
      this.emit('log', { message: `更新订阅失败：${item.remarks} - ${error.message}`, level: 'error', scope: `subscription-${item.id}` });
      throw error;
    } finally {
      this.#save();
      this.#emitChange();
    }
    return item;
  }

  async refreshAll() {
    for (const item of this.data.items) {
      if (!item.enabled) {
        continue;
      }
      try {
        await this.#fetchAndUpdate(item);
        item.lastError = null;
      } catch (error) {
        item.lastError = error.message;
        this.emit('log', { message: `更新订阅失败：${item.remarks} - ${error.message}`, level: 'error', scope: `subscription-${item.id}` });
      }
    }
    this.#save();
    this.#emitChange();
    return this.list();
  }

  async #fetchAndUpdate(item) {
    if (!item.url) {
      throw new Error('订阅地址为空');
    }
    this.emit('log', { message: `更新订阅：${item.remarks}`, level: 'info', scope: `subscription-${item.id}` });
    const response = await fetch(item.url, {
      method: 'GET',
      headers: { 'User-Agent': 'v2rayN-uTools/1.0' }
    });
    if (!response.ok) {
      throw new Error(`请求失败: ${response.status}`);
    }
    const body = await response.text();
    const normalized = this.#normalizeSubscription(body);
    const lines = normalized
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    item.latestCount = lines.length;
    item.latestPreview = lines.slice(0, 10);
    item.lastUpdated = new Date().toISOString();
    item.lastError = null;
  }

  #normalizeSubscription(content) {
    const trimmed = content.trim();
    if (!trimmed) {
      return '';
    }
    const base64Like = /^[A-Za-z0-9+/=\r\n]+$/;
    if (base64Like.test(trimmed)) {
      try {
        const decoded = Buffer.from(trimmed, 'base64').toString('utf-8');
        if (decoded.replace(/[^\x00-\x7F]+/g, '').length === decoded.length) {
          return decoded;
        }
      } catch {
        // ignore and fallback to original
      }
    }
    return trimmed;
  }
}

module.exports = SubscriptionManager;
