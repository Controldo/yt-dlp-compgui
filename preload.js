const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ytDlpCompGui', {
  loadHelp: () => ipcRenderer.invoke('help:load'),
  runCommand: (payload) => ipcRenderer.invoke('yt:run', payload),
  saveConfig: (payload) => ipcRenderer.invoke('config:save', payload),
});