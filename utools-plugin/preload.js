const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const DEFAULT_PORT = 47721;
let hostProcess = null;
let configuredPort = DEFAULT_PORT;
let configuredExecutable = null;
let logCursor = 0;
const processLogs = [];

function resolveDefaultExecutable() {
  const binaryName = process.platform === 'win32' ? 'v2rayN.UtoolsHost.exe' : 'v2rayN.UtoolsHost';
  return path.join(__dirname, 'backend', binaryName);
}

function pushLog(message, level = 'info') {
  if (!message) {
    return;
  }
  const entry = {
    id: ++logCursor,
    timestamp: Date.now(),
    level,
    message: message.toString().trim()
  };
  processLogs.push(entry);
  if (processLogs.length > 200) {
    processLogs.shift();
  }
  window.dispatchEvent(new CustomEvent('v2rayn:host-log', { detail: entry }));
}

function readLogs(after = 0) {
  if (!after) {
    return [...processLogs];
  }
  return processLogs.filter((entry) => entry.id > after);
}

function startHost(options = {}) {
  if (hostProcess) {
    pushLog('Host process already running', 'debug');
    return getHostState();
  }

  const candidate = options.executablePath || configuredExecutable || resolveDefaultExecutable();
  if (!fs.existsSync(candidate)) {
    const error = `Host executable not found: ${candidate}`;
    pushLog(error, 'error');
    throw new Error(error);
  }

  configuredPort = Number(options.port) || configuredPort;
  configuredExecutable = candidate;

  const args = [`--port=${configuredPort}`];
  const spawnOptions = {
    cwd: options.workingDirectory || path.dirname(candidate),
    stdio: ['ignore', 'pipe', 'pipe']
  };

  hostProcess = spawn(candidate, args, spawnOptions);
  hostProcess.stdout.on('data', (buffer) => pushLog(buffer.toString(), 'stdout'));
  hostProcess.stderr.on('data', (buffer) => pushLog(buffer.toString(), 'stderr'));
  hostProcess.on('close', (code) => {
    pushLog(`Host process exited with code ${code ?? 'unknown'}.`, 'warn');
    hostProcess = null;
  });
  hostProcess.on('error', (error) => {
    pushLog(`Host process error: ${error.message}`, 'error');
  });

  pushLog(`Host process started on port ${configuredPort}`, 'info');
  return getHostState();
}

function stopHost() {
  if (!hostProcess) {
    pushLog('Host process is not running', 'debug');
    return getHostState();
  }
  hostProcess.kill();
  hostProcess = null;
  pushLog('Host process stopped by user.', 'info');
  return getHostState();
}

function getHostState() {
  return {
    running: Boolean(hostProcess),
    port: configuredPort,
    executable: configuredExecutable,
    pid: hostProcess?.pid ?? null
  };
}

window.v2raynBridge = {
  startHost,
  stopHost,
  getHostState,
  readLogs,
  getDefaultExecutable: resolveDefaultExecutable
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
