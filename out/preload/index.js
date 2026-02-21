"use strict";
const electron = require("electron");
const api = {
  getSettings: () => electron.ipcRenderer.invoke("settings:get"),
  saveSettings: (settings) => electron.ipcRenderer.invoke("settings:save", settings),
  listPacks: () => electron.ipcRenderer.invoke("packs:list"),
  getPack: (packId) => electron.ipcRenderer.invoke("packs:get", packId),
  savePack: (pack) => electron.ipcRenderer.invoke("packs:save", pack),
  deletePack: (packId) => electron.ipcRenderer.invoke("packs:delete", packId),
  importPackFromDialog: () => electron.ipcRenderer.invoke("packs:import-dialog"),
  exportPackToDialog: (packId) => electron.ipcRenderer.invoke("packs:export-dialog", packId),
  loadActivePacks: () => electron.ipcRenderer.invoke("packs:load-active"),
  appendHistory: (entry) => electron.ipcRenderer.invoke("history:append", entry),
  readHistory: () => electron.ipcRenderer.invoke("history:read")
};
electron.contextBridge.exposeInMainWorld("storageApi", api);
