import { contextBridge, ipcRenderer } from 'electron';
import { ContentPack, HistoryGame, PackSummary, Settings, StorageApi } from '../shared/types';

const api: StorageApi = {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: Settings) => ipcRenderer.invoke('settings:save', settings),
  listPacks: (): Promise<PackSummary[]> => ipcRenderer.invoke('packs:list'),
  getPack: (packId: string): Promise<ContentPack | null> => ipcRenderer.invoke('packs:get', packId),
  savePack: (pack: ContentPack): Promise<ContentPack> => ipcRenderer.invoke('packs:save', pack),
  deletePack: (packId: string): Promise<boolean> => ipcRenderer.invoke('packs:delete', packId),
  importPackFromDialog: (): Promise<ContentPack | null> => ipcRenderer.invoke('packs:import-dialog'),
  exportPackToDialog: (packId: string): Promise<boolean> => ipcRenderer.invoke('packs:export-dialog', packId),
  loadActivePacks: (): Promise<ContentPack[]> => ipcRenderer.invoke('packs:load-active'),
  appendHistory: (entry: HistoryGame): Promise<boolean> => ipcRenderer.invoke('history:append', entry),
  readHistory: (): Promise<HistoryGame[]> => ipcRenderer.invoke('history:read')
};

contextBridge.exposeInMainWorld('storageApi', api);
