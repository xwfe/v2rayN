const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('v2raynApi', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  listProfiles: () => ipcRenderer.invoke('profiles:list'),
  setDefaultServer: (indexId) => ipcRenderer.invoke('config:set-default', indexId),
  getDataRoot: () => ipcRenderer.invoke('data:get-root'),
  selectDataRoot: () => ipcRenderer.invoke('data:select-root')
});
