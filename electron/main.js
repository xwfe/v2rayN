const path = require('node:path');
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const dataPaths = require('./lib/dataPaths');
const configStore = require('./lib/configStore');
const profileStore = require('./lib/profileStore');

let mainWindow;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 960,
    minHeight: 640,
    title: 'v2rayN Electron',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  await mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  if (!app.isPackaged && process.env.V2RAYN_ELECTRON_DEVTOOLS === '1') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

function registerIpcHandlers() {
  ipcMain.handle('config:get', async () => {
    return configStore.readConfig();
  });

  ipcMain.handle('profiles:list', async () => {
    const [config, profileResult] = await Promise.all([
      configStore.readConfig(),
      profileStore.fetchProfiles()
    ]);
    const defaultId = config.IndexId ?? '';
    return {
      profiles: profileResult.profiles.map((item) => ({
        ...item,
        isDefault: item.IndexId === defaultId
      })),
      meta: profileResult.meta,
      defaultIndexId: defaultId
    };
  });

  ipcMain.handle('config:set-default', async (_event, indexId) => {
    await configStore.setDefaultServer(indexId);
    return { ok: true };
  });

  ipcMain.handle('data:get-root', async () => {
    return { root: dataPaths.getDataRoot() };
  });

  ipcMain.handle('data:select-root', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select v2rayN data directory',
      properties: ['openDirectory', 'createDirectory']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }

    const target = result.filePaths[0];
    dataPaths.setCustomDataRoot(target);
    return {
      root: dataPaths.getDataRoot()
    };
  });
}

app.whenReady().then(async () => {
  dataPaths.initialize(app);
  registerIpcHandlers();
  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
