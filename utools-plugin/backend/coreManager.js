const { spawn } = require('child_process');
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const ConfigStore = require('./configStore');
const { parseArgsLine, formatArgs, resolvePath, compactObject } = require('./utils');

class CoreManager extends EventEmitter {
  constructor(options) {
    super();
    this.rootDir = options.rootDir;
    this.configPath = options.configPath;
    this.statePath = path.join(path.dirname(this.configPath), 'core-state.json');
    this.store = new ConfigStore(this.statePath);
    this.logSeq = 0;
    this.allLogs = [];
    this.logs = new Map();
    this.processes = new Map();
    this.cores = [];

    this.#loadConfig();
    this.bootstrapAutoStart();

    process.once('exit', () => {
      this.stopAll();
    });
    ['SIGINT', 'SIGTERM'].forEach((signal) => {
      process.on(signal, () => {
        this.stopAll();
        process.exit();
      });
    });
  }

  #loadConfig() {
    try {
      if (!fs.existsSync(this.configPath)) {
        throw new Error('cores.config.json not found');
      }
      const raw = fs.readFileSync(this.configPath, 'utf-8');
      const parsed = JSON.parse(raw || '{}');
      this.cores = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.cores)
          ? parsed.cores
          : [];
    } catch (error) {
      console.error('[CoreManager] Failed to load config', error);
      this.cores = [];
    }
  }

  #resolveBinary(core) {
    if (!core) {
      return null;
    }
    if (core.binaries && typeof core.binaries === 'object') {
      return core.binaries[process.platform] ?? core.binaries.default ?? null;
    }
    return core.exec ?? null;
  }

  #normalizeArgs(args) {
    if (Array.isArray(args)) {
      return args.map((item) => `${item}`.trim()).filter(Boolean);
    }
    if (typeof args === 'string') {
      return parseArgsLine(args);
    }
    return [];
  }

  #descriptor(id) {
    const base = this.cores.find((core) => core.id === id);
    if (!base) {
      return null;
    }
    const override = this.store.getOverride(id) ?? {};
    const exec = override.exec ?? this.#resolveBinary(base);
    const descriptor = {
      ...base,
      exec,
      args: this.#normalizeArgs(override.args ?? base.args ?? []),
      cwd: override.cwd ?? base.cwd ?? path.dirname(exec ?? '') ?? this.rootDir,
      env: {
        ...(base.env ?? {}),
        ...(override.env ?? {})
      },
      configPath: override.configPath ?? base.configPath,
      autoStart: typeof override.autoStart === 'boolean' ? override.autoStart : Boolean(base.autoStart)
    };
    descriptor.argsLine = formatArgs(descriptor.args);
    return descriptor;
  }

  #snapshot(id) {
    const descriptor = this.#descriptor(id);
    if (!descriptor) {
      return null;
    }
    const runtime = this.processes.get(id);
    const executable = descriptor.exec ? resolvePath(this.rootDir, descriptor.exec) : null;
    return {
      id,
      name: descriptor.name,
      category: descriptor.category,
      description: descriptor.description,
      doc: descriptor.doc,
      configHint: descriptor.configHint,
      autoStart: descriptor.autoStart,
      executable,
      relativeExecutable: descriptor.exec,
      cwd: descriptor.cwd ? resolvePath(this.rootDir, descriptor.cwd) : path.dirname(executable ?? this.rootDir),
      args: descriptor.args,
      argsLine: descriptor.argsLine,
      running: Boolean(runtime),
      pid: runtime?.proc?.pid ?? null,
      startedAt: runtime?.startedAt ?? null
    };
  }

  async listCores() {
    return this.listCoresSync();
  }

  listCoresSync() {
    return this.cores.map((core) => this.#snapshot(core.id)).filter(Boolean);
  }

  async startCore(id) {
    const descriptor = this.#descriptor(id);
    if (!descriptor) {
      return { success: false, message: `未找到核心 ${id}` };
    }
    if (this.processes.has(id)) {
      return { success: false, message: `${descriptor.name} 已在运行` };
    }
    const executable = descriptor.exec ? resolvePath(this.rootDir, descriptor.exec) : null;
    if (!executable || !fs.existsSync(executable)) {
      return { success: false, message: `找不到可执行文件: ${executable ?? descriptor.exec}` };
    }
    const cwd = descriptor.cwd ? resolvePath(this.rootDir, descriptor.cwd) : path.dirname(executable);
    const args = descriptor.args ?? [];
    try {
      const child = spawn(executable, args, {
        cwd,
        env: { ...process.env, ...descriptor.env },
        windowsHide: true
      });
      const meta = { proc: child, descriptor, startedAt: new Date() };
      this.processes.set(id, meta);
      child.stdout.on('data', (buffer) => this.#recordLog(id, buffer.toString(), 'stdout'));
      child.stderr.on('data', (buffer) => this.#recordLog(id, buffer.toString(), 'stderr'));
      child.on('close', (code) => {
        this.processes.delete(id);
        this.#recordLog(id, `${descriptor.name} 已退出 (${code ?? '0'})`, 'info');
        this.emitStatus();
      });
      child.on('error', (error) => {
        this.#recordLog(id, `进程错误: ${error.message}`, 'error');
      });
      this.#recordLog(id, `启动 ${descriptor.name} -> ${executable}`, 'info');
      this.emitStatus();
      return { success: true, message: `${descriptor.name} 已启动`, data: this.#snapshot(id) };
    } catch (error) {
      this.#recordLog(id, error.message, 'error');
      return { success: false, message: error.message };
    }
  }

  async stopCore(id) {
    const runtime = this.processes.get(id);
    const descriptor = this.#descriptor(id);
    if (!runtime) {
      return { success: false, message: `${descriptor?.name ?? id} 未在运行` };
    }
    const { proc } = runtime;
    return await new Promise((resolve) => {
      let settled = false;
      const finalize = (success, message) => {
        if (settled) {
          return;
        }
        settled = true;
        this.#recordLog(id, message, success ? 'info' : 'warn');
        this.emitStatus();
        resolve({ success, message, data: this.#snapshot(id) });
      };
      const timer = setTimeout(() => {
        if (!proc.killed) {
          try {
            proc.kill('SIGKILL');
          } catch (error) {
            finalize(false, error.message);
            return;
          }
        }
        finalize(true, `${descriptor?.name ?? id} 已停止 (强制)`);
      }, 5000);

      proc.once('close', (code) => {
        clearTimeout(timer);
        this.processes.delete(id);
        finalize(true, `${descriptor?.name ?? id} 已停止 (code: ${code ?? '0'})`);
      });

      try {
        const killed = proc.kill();
        if (!killed) {
          clearTimeout(timer);
          finalize(false, `${descriptor?.name ?? id} 停止失败`);
        }
      } catch (error) {
        clearTimeout(timer);
        finalize(false, error.message);
      }
    });
  }

  async restartCore(id) {
    await this.stopCore(id);
    return this.startCore(id);
  }

  async startAll() {
    const results = [];
    for (const core of this.cores) {
      const result = await this.startCore(core.id);
      results.push({ id: core.id, ...result });
    }
    const success = results.every((item) => item.success);
    return { success, results };
  }

  async stopAll() {
    const promises = Array.from(this.processes.keys()).map((id) => this.stopCore(id));
    const results = await Promise.allSettled(promises);
    return { success: true, results };
  }

  async updateCoreConfig(id, payload = {}) {
    const descriptor = this.#descriptor(id);
    if (!descriptor) {
      return { success: false, message: `未找到核心 ${id}` };
    }
    const override = compactObject({
      exec: payload.executable ?? payload.exec,
      cwd: payload.cwd,
      configPath: payload.configPath,
      autoStart: typeof payload.autoStart === 'boolean' ? payload.autoStart : undefined
    });
    if (Array.isArray(payload.args)) {
      override.args = payload.args;
    } else if (typeof payload.argsLine === 'string') {
      override.args = parseArgsLine(payload.argsLine);
    } else if (payload.argsLine === null) {
      override.args = null;
    }
    this.store.setOverride(id, override);
    const snapshot = this.#snapshot(id);
    this.emitStatus();
    return { success: true, message: `${descriptor.name} 配置已更新`, data: snapshot };
  }

  async readLogs(coreId = 'all', after = 0) {
    const buffer = coreId === 'all' ? this.allLogs : this.logs.get(coreId) ?? [];
    if (after > 0) {
      return buffer.filter((entry) => entry.id > after);
    }
    return buffer.slice();
  }

  bootstrapAutoStart() {
    setTimeout(async () => {
      for (const core of this.cores) {
        const descriptor = this.#descriptor(core.id);
        if (descriptor?.autoStart) {
          const runtime = this.processes.get(core.id);
          if (!runtime) {
            await this.startCore(core.id);
          }
        }
      }
    }, 300);
  }

  emitStatus() {
    this.emit('status', this.listCoresSync());
  }

  #recordLog(coreId, raw, level) {
    if (raw === undefined || raw === null) {
      return;
    }
    const lines = `${raw}`.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    lines.forEach((line) => {
      const entry = {
        id: ++this.logSeq,
        coreId,
        level,
        message: line,
        timestamp: Date.now()
      };
      this.allLogs.push(entry);
      if (this.allLogs.length > 800) {
        this.allLogs.shift();
      }
      const buffer = this.logs.get(coreId) ?? [];
      buffer.push(entry);
      if (buffer.length > 400) {
        buffer.shift();
      }
      this.logs.set(coreId, buffer);
      this.emit('log', entry);
    });
  }
}

module.exports = CoreManager;
