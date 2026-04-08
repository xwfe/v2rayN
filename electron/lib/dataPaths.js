const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

let rootDir;
let preferenceFile;
let preferences = {};

function initialize(app) {
  const userData = app.getPath('userData');
  preferenceFile = path.join(userData, 'v2rayn-electron.json');
  preferences = readPreferences();

  const savedRoot = preferences.dataRoot;
  const resolved = resolveRoot(savedRoot, userData);
  setDataRootInternal(resolved, false);

  if (savedRoot !== resolved) {
    preferences.dataRoot = resolved;
    savePreferences();
  }

  return rootDir;
}

function resolveRoot(preferred, userDataPath) {
  const fallback = path.join(userDataPath, 'v2rayN');
  const envDir = process.env.V2RAYN_DATA_DIR;
  const repoDataLocal = path.resolve(process.cwd(), 'v2rayn-data');
  const repoDataParent = path.resolve(process.cwd(), '..', 'v2rayn-data');
  const legacyPortableDir = process.cwd();
  const homeDir = typeof os.homedir === 'function' ? os.homedir() : null;
  const homeConfigDir = homeDir ? path.join(homeDir, '.config', 'v2rayN') : null;

  const candidates = [preferred, envDir, repoDataLocal, repoDataParent, legacyPortableDir, fallback, homeConfigDir]
    .filter(Boolean)
    .map((candidate) => path.resolve(candidate));

  for (const candidate of candidates) {
    if (hasExistingConfig(candidate)) {
      return candidate;
    }
  }

  return candidates[0] ?? fallback;
}

function hasExistingConfig(dir) {
  try {
    const cfgDir = path.join(dir, 'guiConfigs');
    if (fs.existsSync(path.join(cfgDir, 'guiNConfig.json'))) {
      return true;
    }
    return fs.existsSync(cfgDir);
  } catch {
    return false;
  }
}

function ensureStructure(dir) {
  const cfgDir = path.join(dir, 'guiConfigs');
  fs.mkdirSync(cfgDir, { recursive: true });
}

function readPreferences() {
  if (!preferenceFile) {
    return {};
  }
  try {
    const raw = fs.readFileSync(preferenceFile, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function savePreferences() {
  if (!preferenceFile) {
    return;
  }
  fs.mkdirSync(path.dirname(preferenceFile), { recursive: true });
  fs.writeFileSync(preferenceFile, JSON.stringify(preferences, null, 2));
}

function setDataRootInternal(dir, persist = true) {
  if (!dir) {
    return rootDir;
  }
  const normalized = path.resolve(dir);
  ensureStructure(normalized);
  rootDir = normalized;
  if (persist) {
    preferences.dataRoot = normalized;
    savePreferences();
  }
  return rootDir;
}

function setCustomDataRoot(dir) {
  return setDataRootInternal(dir, true);
}

function getDataRoot() {
  return rootDir;
}

function getConfigFilePath() {
  return path.join(rootDir, 'guiConfigs', 'guiNConfig.json');
}

function getDatabasePath() {
  return path.join(rootDir, 'guiConfigs', 'guiNDB.db');
}

module.exports = {
  initialize,
  getDataRoot,
  getConfigFilePath,
  getDatabasePath,
  setCustomDataRoot
};
