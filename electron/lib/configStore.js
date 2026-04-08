const fs = require('node:fs');
const path = require('node:path');
const dataPaths = require('./dataPaths');
const { createDefaultConfig } = require('./defaults');
const { mergeWithDefaults } = require('./utils');

async function ensureConfigDirectory() {
  const dir = path.dirname(dataPaths.getConfigFilePath());
  await fs.promises.mkdir(dir, { recursive: true });
}

async function readConfig() {
  const filePath = dataPaths.getConfigFilePath();
  try {
    const raw = await fs.promises.readFile(filePath, 'utf8');
    const config = JSON.parse(raw);
    return mergeWithDefaults(createDefaultConfig(), config);
  } catch (error) {
    if (error.code === 'ENOENT') {
      const defaults = createDefaultConfig();
      await writeConfig(defaults);
      return defaults;
    }
    throw error;
  }
}

async function writeConfig(config) {
  await ensureConfigDirectory();
  const filePath = dataPaths.getConfigFilePath();
  const content = JSON.stringify(config, null, 2);
  await fs.promises.writeFile(filePath, content, 'utf8');
  return config;
}

async function setDefaultServer(indexId) {
  const cfg = await readConfig();
  cfg.IndexId = indexId ?? '';
  await writeConfig(cfg);
  return cfg;
}

module.exports = {
  readConfig,
  writeConfig,
  setDefaultServer
};
